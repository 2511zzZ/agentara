import type { Job } from "bunqueue/client";
import { Queue, Worker } from "bunqueue/client";
import { desc, eq } from "drizzle-orm";

import type { DrizzleDB } from "@/data";
import type { CronjobTaskPayload, Task, TaskPayload, Logger } from "@/shared";
import { config, createLogger } from "@/shared";

import { tasks } from "./data";

const QUEUE_NAME = "agentara:tasks";

/** Scheduler info type extracted from the bunqueue Queue API. */
type SchedulerInfo = Awaited<ReturnType<Queue["getJobSchedulers"]>>[number];

/**
 * A function that processes a task payload of a specific type.
 * Errors thrown inside are caught by {@link TaskDispatcher}.
 */
export type TaskHandler<P extends TaskPayload = TaskPayload> = (
  // eslint-disable-next-line no-unused-vars
  payload: P,
) => Promise<void>;

/**
 * Options for creating a {@link TaskDispatcher}.
 */
export interface TaskDispatcherOptions {
  /**
   * Number of concurrent job slots in the bunqueue Worker.
   * Controls cross-session parallelism. Defaults to 4.
   */
  concurrency?: number;

  /**
   * The Drizzle database instance used to persist task lifecycle.
   */
  db: DrizzleDB;
}

/**
 * Manages task queuing, routing, and execution via bunqueue.
 *
 * Provides handler registration via {@link route}, per-session serial
 * execution (FIFO), and cron job scheduling. The dispatcher itself does
 * not know about sessions or agents — execution logic is injected via
 * {@link route}.
 */
export class TaskDispatcher {
  private _concurrency: number;
  private _db: DrizzleDB;
  private _queue: Queue<TaskPayload>;
  private _worker: Worker<TaskPayload> | undefined;
  private _handlers: Map<string, TaskHandler>;
  /** Per-session promise chain for serial execution. */
  private _sessionLocks: Map<string, Promise<void>>;
  private _logger: Logger;

  constructor(options: TaskDispatcherOptions) {
    this._concurrency = options.concurrency ?? 4;
    this._db = options.db;
    this._handlers = new Map();
    this._sessionLocks = new Map();
    this._logger = createLogger("task-dispatcher");
    this._queue = new Queue<TaskPayload>(QUEUE_NAME, {
      embedded: true,
      defaultJobOptions: { attempts: config.tasking.max_retries },
    });
    // Stall detection is designed for distributed worker crash recovery.
    // In embedded (single-process) mode it is counterproductive: jobs waiting
    // in the _sessionLocks chain have a stale lastHeartbeat even though they
    // are actively queued, so the detector wrongly removes them from the
    // processing shard and causes "Job not found" errors on ack/fail.
    this._queue.setStallConfig({ enabled: false });
  }

  /**
   * Register a handler for a specific task type.
   * Must be called before {@link start}.
   * Throws if a handler for the given type is already registered.
   * @param type - The task payload type to handle.
   * @param handler - The async function that processes the payload.
   */
  route<T extends TaskPayload["type"]>(
    type: T,
    handler: TaskHandler<Extract<TaskPayload, { type: T }>>,
  ): this {
    if (this._handlers.has(type)) {
      throw new Error(`Handler already registered for task type: ${type}`);
    }
    this._handlers.set(type, handler as TaskHandler);
    return this;
  }

  /**
   * Dispatch a task for processing.
   * @param payload - The task payload to enqueue.
   * @returns The bunqueue job ID.
   */
  async dispatch(payload: TaskPayload): Promise<string> {
    const job = await this._queue.add(payload.type, payload);
    const now = Date.now();
    this._db
      .insert(tasks)
      .values({
        id: job.id,
        type: payload.type,
        status: "pending",
        payload,
        created_at: now,
        updated_at: now,
      })
      .run();
    return job.id;
  }

  /**
   * Register or update a cron job scheduler.
   * Calling this again with the same {@link CronjobTaskPayload.session_id}
   * updates the schedule without creating duplicates.
   * @param payload - The cronjob task payload.
   */
  async scheduleCronjob(payload: CronjobTaskPayload): Promise<void> {
    await this._queue.upsertJobScheduler(
      payload.session_id,
      { pattern: payload.cron_pattern },
      { name: "cronjob", data: payload },
    );
    this._logger.info(
      { session_id: payload.session_id, cron_pattern: payload.cron_pattern },
      "cronjob scheduled",
    );
  }

  /**
   * Remove a cron job scheduler by its session_id.
   * @param sessionId - The session_id (scheduler ID) to remove.
   */
  async removeCronjob(sessionId: string): Promise<void> {
    await this._queue.removeJobScheduler(sessionId);
    this._logger.info({ session_id: sessionId }, "cronjob removed");
  }

  /**
   * Query tasks across every state, sorted by creation time descending.
   * Unlike bunqueue's in-memory query, this reads from the persisted
   * `tasks` table and survives process restarts.
   * @param limit - Maximum number of tasks to return. Defaults to 50.
   * @returns An array of tasks in reverse chronological order.
   */
  queryTasks({ limit = 50 }: { limit?: number } = {}): Task[] {
    return this._db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.created_at))
      .limit(limit)
      .all() as Task[];
  }

  /**
   * Get all registered cronjob schedulers.
   * @returns An array of scheduler info for every active cronjob.
   */
  async getCronjobs(): Promise<SchedulerInfo[]> {
    return this._queue.getJobSchedulers();
  }

  /**
   * Start the worker. Must be called once during app startup.
   */
  async start() {
    this._worker = new Worker<TaskPayload>(
      QUEUE_NAME,
      (job) => this._processJob(job),
      {
        embedded: true,
        concurrency: this._concurrency,
        // Locks are TCP-mode only; embedded mode has no heartbeat to renew
        // them. With _sessionLocks chaining, hold time = wait + processing,
        // which easily exceeds DEFAULT_LOCK_TTL (30 s). Disable locks since
        // embedded mode uses subscription-based stall detection instead.
        useLocks: false,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    );
    this._worker.on("error", (err) => {
      this._logger.error({ err }, "worker error");
    });
    this._logger.info(
      "Task dispatcher started with concurrency: " + this._concurrency,
    );
  }

  /**
   * Gracefully shut down the worker and queue.
   */
  async stop(): Promise<void> {
    if (this._worker) {
      await this._worker.close();
    }
    this._queue.close();
    this._logger.info("task dispatcher stopped");
  }

  /**
   * Process a job from the queue. Acquires a per-session lock so that
   * tasks for the same session_id execute serially in FIFO order.
   */
  private async _processJob(job: Job<TaskPayload>): Promise<void> {
    const payload = job.data;
    const sessionId = payload.session_id;

    const previous = this._sessionLocks.get(sessionId) ?? Promise.resolve();

    const current = previous.then(async () => {
      const handler = this._handlers.get(payload.type);
      if (!handler) {
        this._logger.warn(
          { session_id: sessionId, type: payload.type },
          "no handler registered for task type",
        );
        return;
      }
      this._updateTaskStatus(job.id, "running");
      try {
        await handler(payload);
        await job.updateProgress(100);
        this._updateTaskStatus(job.id, "completed");
      } catch (err) {
        this._updateTaskStatus(job.id, "failed");
        this._logger.error(
          { session_id: sessionId, type: payload.type, err },
          "task failed",
        );
        throw err;
      }
    });

    this._sessionLocks.set(sessionId, current);
    await current;

    if (this._sessionLocks.get(sessionId) === current) {
      this._sessionLocks.delete(sessionId);
    }
  }

  /**
   * Update the status of a task in the database.
   */
  private _updateTaskStatus(id: string, status: string): void {
    this._db
      .update(tasks)
      .set({ status, updated_at: Date.now() })
      .where(eq(tasks.id, id))
      .run();
  }
}
