# Tasking Design

Task scheduling, routing, and execution via Bunqueue. Provides per-session serial execution, cron job scheduling, and handler-based task dispatch.

## Design Goals

- **Per-session serialization**: Tasks for the same `session_id` execute in FIFO order to avoid agent state conflicts.
- **Cross-session parallelism**: Multiple sessions can process tasks concurrently.
- **Handler injection**: TaskDispatcher does not know sessions or agents; execution logic is injected via `route()`.
- **Cron scheduling**: Support repeatable tasks with cron expressions, deduplicated by session ID.

## Architecture

```
TaskDispatcher
    ├── Queue (bunqueue)     → task storage, scheduling
    ├── Worker (bunqueue)    → job consumption
    ├── _handlers            → type → handler map
    └── _sessionLocks        → per-session promise chain
```

- **Queue name**: `agentara:tasks`
- **Backend**: Bunqueue in embedded mode; database at `$AGENTARA_HOME/data/agentara.db`

## Task Payload Schema

All payloads extend a base with `session_id`. The `type` field discriminates unions.

### BaseTaskPayload

- `session_id`: string — Identifies the session; used for serial execution and scheduler deduplication.

### InboundMessageTaskPayload

- `type`: `"inbound_message"`
- `session_id`: string
- `message`: UserMessage — The user message sent to the agent.

### CronjobTaskPayload

- `type`: `"cronjob"`
- `session_id`: string — Also used as bunqueue scheduler ID for deduplication.
- `instruction`: string — Instruction sent to the agent.
- `cron_pattern`: string — Cron expression, e.g. `"0 3 * * *"`.

### TaskPayload

Discriminated union of `InboundMessageTaskPayload | CronjobTaskPayload`.

## API

### TaskDispatcher

| Method | Description |
|--------|-------------|
| `route(type, handler)` | Register handler for a task type. Must be called before `start`. Throws if type already registered. |
| `dispatch(payload)` | Enqueue a task. Returns bunqueue job ID. |
| `scheduleCronjob(payload)` | Add or update a cron scheduler. Same `session_id` updates without duplicate. |
| `removeCronjob(sessionId)` | Remove cron scheduler by session ID. |
| `start()` | Start the worker. Call once at startup. |
| `stop()` | Gracefully shut down worker and queue. |

### TaskDispatcherOptions

- `concurrency`: number (default: 4) — Number of concurrent job slots; controls cross-session parallelism.

### TaskHandler

```ts
type TaskHandler<P extends TaskPayload> = (payload: P) => Promise<void>;
```

Handlers receive the payload for their type. Errors thrown propagate to the worker; Bunqueue handles retries per `config.tasking.max_retries`.

## Per-Session Serial Execution

Tasks for the same `session_id` run serially (FIFO) via `_sessionLocks`:

1. On job pickup: get or create `previous` promise for the session.
2. `current = previous.then(() => handler(payload))`.
3. Store `current` in `_sessionLocks`, await it.
4. When done, if no newer lock exists for the session, remove the entry.

This runs entirely in-process; no distributed locking needed.

## Configuration

`config.tasking`:

- `max_retries`: number (default: 1) — Max attempts per job before marked failed.

## Bunqueue Embedded Mode

Embedded mode runs queue and worker in the same process. Several settings are adjusted:

- **Stall detection**: Disabled. Jobs waiting in `_sessionLocks` have stale heartbeats; stall detection would wrongly evict them.
- **useLocks**: false. Locks target TCP-mode; embedded has no heartbeat renewal. `_sessionLocks` hold times (wait + process) can exceed default lock TTL.
- **removeOnComplete / removeOnFail**: Limits kept to avoid unbounded growth.

## Dependencies

- `bunqueue/client` — Queue, Worker, Job
- `config` (from `@/shared`) — `config.tasking.max_retries`, `config.paths`
- `createLogger` (from `@/shared`) — Logging

## Kernel Integration

Kernel creates the TaskDispatcher, registers handlers (e.g. `inbound_message`), and calls `start()` during bootstrap. Handlers receive payloads and use SessionManager to resolve sessions and execute agent runs.

## File Layout

```
src/
├── shared/tasking/
│   ├── index.ts
│   └── types/
│       ├── index.ts
│       └── payload.ts       # TaskPayload schemas
└── kernel/tasking/
    ├── index.ts
    └── task-dispatcher.ts
```
