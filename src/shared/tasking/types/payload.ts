import { z } from "zod";

import { UserMessage } from "../../messaging";

/**
 * Payload for an inbound user message task.
 */
export const InboundMessageTaskPayload = z.object({
  type: z.literal("inbound_message"),
  message: UserMessage,
});
export interface InboundMessageTaskPayload extends z.infer<
  typeof InboundMessageTaskPayload
> {}

/**
 * Payload for a scheduled instruction task.
 * Describes "what to do" — the schedule is stored separately via {@link TaskSchedule}.
 */
export const ScheduledTaskPayload = z.object({
  type: z.literal("scheduled_task"),
  /** The instruction string sent to the agent. */
  instruction: z.string(),
  /** Optional working directory for the session. Falls back to config.paths.home. */
  cwd: z.string().optional(),
  /** Optional project name this task belongs to. */
  project_name: z.string().optional(),
});
export interface ScheduledTaskPayload extends z.infer<
  typeof ScheduledTaskPayload
> {}

/**
 * Describes "when" a scheduled task should run.
 * Either `at`/`delay` (one-shot) or `pattern`/`every` (recurring) must be provided.
 */
export const TaskSchedule = z
  .object({
    /** Epoch milliseconds for one-shot execution at a specific time. */
    at: z.number().int().positive().optional(),
    /** Delay in milliseconds before one-shot execution (converted to `at` on registration). 0 means immediate. */
    delay: z.number().int().nonnegative().optional(),
    /** Cron expression, e.g. `"0 3 * * *"`. */
    pattern: z.string().optional(),
    /** Interval in milliseconds between executions. */
    every: z.number().int().positive().optional(),
    /** Maximum number of executions. */
    limit: z.number().int().positive().optional(),
    /** Whether to execute immediately on registration. */
    immediately: z.boolean().optional(),
    /** Internal: bunqueue job ID for one-shot delayed jobs. */
    _job_id: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasOneShot = data.at !== undefined || data.delay !== undefined;
      const hasRecurring =
        data.pattern !== undefined || data.every !== undefined;
      const hasImmediate = data.immediately === true && !hasOneShot && !hasRecurring;
      if (hasImmediate) return true;
      if (hasOneShot && hasRecurring) return false;
      if (!hasOneShot && !hasRecurring) return false;
      if (hasOneShot && data.at !== undefined && data.delay !== undefined)
        return false;
      return true;
    },
    {
      message:
        "Provide exactly one: 'at' or 'delay' (one-shot), 'pattern'/'every' (recurring), or 'immediately: true' (run once now); 'at' and 'delay' are mutually exclusive",
    },
  );
export interface TaskSchedule extends z.infer<typeof TaskSchedule> {}

/**
 * Discriminated union of all supported task payloads.
 */
export const TaskPayload = z.discriminatedUnion("type", [
  InboundMessageTaskPayload,
  ScheduledTaskPayload,
]);
export type TaskPayload =
  | InboundMessageTaskPayload
  | ScheduledTaskPayload;
