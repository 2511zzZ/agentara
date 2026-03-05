# Architecture

📯 Agentara is a project to build a 7x24h personal assistant for myself. The core is Claude Code as a SuperAgent.

# Technology Stack

- **Backend**: Bun, TypeScript, Zod, Hono, Bunqueue, Pino, Day.js, EventEmitter3
- **Frontend**: TypeScript, Zod, React, Shadcn, Tailwind, React Query
- **Database**: SQLite (Reused from Bun's builtin SQLite)

# Conventions

- Provide comprehensive tsdoc for all classes, interfaces, functions, and variables.
- All event emitter should extend from `EventEmitter3`.
- All private members' name should begin with an underscore.
- In a class, sort the members with the following order:
  - constructors
  - public fields
  - protected fields
  - private fields
  - public static functions
  - public functions
  - protected functions
  - private functions
- For all entities:
  - Zod first, TypeScript second
  - Lowercase with underscore naming convention is used for the fields.
  - All entities should be defined in Zod schemas, and both Zod schema as well as **named** TypeScript interface should be provided.

```typescript
/**
 * tsdoc for User here.
 */
export const User = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  auth_token: z.string(),
  secondary_auth_tokens: z.array(z.string()),
});
export interface User extends z.infer<typeof User> {}

/**
 * tsdoc for UserGroup here.
 */
export const UserGroup = z.object({
  id: z.string(),
  name: z.string(),
  users: z.array(User),
});
export interface UserGroup extends z.infer<typeof UserGroup> {}
```

# Overview

## BootLoader & Environment

BootLoader ensures **safety** and **isolation**: Kernel starts only when integrity verification passes.

- **Flow**: `bootstrap()` → `_verifyIntegrity()` (ensure dirs and config) → `_igniteKernel()` (dynamic import Kernel)
- **AGENTARA_HOME**: Defaults to `~/.agentara` when unset
- **config.yaml**: If missing, auto-generate and continue
- **Directories**: See `src/shared/config/paths.ts` — workspace, sessions, memory, data (SQLite), etc.
- **Note**: Port/host via `AGENTARA_SERVICE_PORT` and `AGENTARA_SERVICE_HOST`; log level via `AGENTARA_LOG_LEVEL`

---

## Kernel

Lazy-creation singleton. Loaded by BootLoader after integrity verification.

- **SessionManager**: Creates or resumes sessions
- **TaskDispatcher**: Queues, routes, and executes tasks via Bunqueue
- **start()**: Starts the task dispatcher worker
- Access instance via `kernel` from `@/src/kernel`

---

## Configuration (config.yaml)

- **Strong typing**: Use Zod for schema validation at runtime, underscore naming convention is used for the fields.
- **Current fields**:
  - `default_agent`: string, e.g. `"claude-code"`
  - `agent_model`: string, default `"claude-sonnet-4-6"`
- **Removed from config**: `log_level` — use `AGENTARA_LOG_LEVEL` env var instead
- **Env override**: Environment variables override config values where applicable
- **Hot reload**: Preferably supported (to be implemented)

---

## Logging

- **Library**: Pino only
- **Levels**: Follow Pino levels (`trace`, `debug`, `info`, `warn`, `error`)

---

## AgentRunner & Session

### AgentRunner

Wrapper around the underlying agent. Callers interact via streaming only.

- **Interface**: `stream(message, options?)` → `AsyncIterableIterator<AssistantMessage | SystemMessage>`
- **AgentRunOptions**: `{ isNewSession: boolean, cwd: string }`
- **type**: Readonly string identifying the runner (e.g. `"claude-code"`)

No `run()` at this layer — it is implemented at the Session level.

### Session

Unifies different AgentRunner implementations. Callers use Session, not AgentRunner directly.

- **run()**: Streams until completion, returns the last message
- **stream()**: Exposes streaming output

Session abstracts which AgentRunner is used; implementation can be swapped without changing caller code.

### SessionManager

Creates or resumes Session instances. Callers obtain Session via SessionManager.

- **resolveSession(sessionId)**: Creates if file missing, resumes if file exists
- **createSession(sessionId?)**: Creates new session (throws if already exists)
- **resumeSession(sessionId)**: Resumes existing session (throws if not found)
- **existsSession(sessionId)**: Returns whether session file exists

SessionManager maintains session `.jsonl` files. No concurrency, no caching.

---

### Session Storage

Sessions are stored as **files** under `config.paths.sessions` (`$AGENTARA_HOME/sessions/{session_id}.jsonl`).

- **File naming**: `{session_id}.jsonl` — resolved via `config.paths.resolveSessionFilePath(session_id)`
- **Existence check**: A session exists iff the path returned by `resolveSessionFilePath(session_id)` is an existing file
- **Content**: Every message (user, assistant, system) appended as JSONL (one JSON object per line)

---

## Tasking (TaskDispatcher & Bunqueue)

TaskDispatcher manages task queuing, routing, and execution via Bunqueue (embedded mode).

- **Queue**: `agentara:tasks`, SQLite-backed
- **Per-session serial**: Same `session_id` runs serially (FIFO)
- **Concurrency**: Cross-session slots (default 4)
- **Handlers**: `route(type, handler)` before `start()` — e.g. `inbound_message` → session.run()
- **Cron**: `scheduleCronjob()`, `removeCronjob(sessionId)` — session_id as scheduler ID

**Payloads** (`src/shared/tasking/types/payload.ts`): `inbound_message` (session_id, message) | `cronjob` (session_id, instruction, cron_pattern). Config: `config.tasking.max_retries`.

---

## Hono API

**TODO**: Endpoints, request/response schemas, and error handling — to be defined later.

Planned capabilities (from README):

- Trigger Inbound message task, return task ID
- List current Tasks
- List current Repeatable Tasks

---

## Project Structure

### Layout

```
src/
├── shared/      # Cross-layer types, utilities, conventions
│   ├── agents/       # AgentRunner interface, AgentRunOptions, etc.
│   ├── messaging/    # Message types, tool types, role definitions
│   ├── tasking/      # TaskPayload types (inbound_message, cronjob)
│   ├── utils/        # Pure utilities (e.g. UUID)
│   └── logging/      # Pino
├── kernel/      # Core orchestration (Kernel, SessionManager, TaskDispatcher)
│   ├── agents/       # createAgentRunner factory
│   ├── sessioning/   # Session, SessionManager
│   └── tasking/      # TaskDispatcher
├── server/      # Hono server (RESTful API)
├── community/   # Provider implementations (one subdir per provider)
│   └── anthropic/    # ClaudeAgentRunner, etc.
└── boot-loader/   # Bootstrap → verify integrity → ignite Kernel
```

`workspace/` lives at project root as the default workspace template; it is copied to `$AGENTARA_HOME/workspace` on first run.

### Layer Guidelines

- **shared** — Side-effect-free shared definitions
  - Put here: Interfaces, Zod schemas, message types, pure utils, logging config
  - Do not put here: Business logic, external calls, dependencies on kernel/community
- **kernel** — Core orchestration & lifecycle
  - Put here: Session, AgentRunner factory, session storage, task scheduling (Bunqueue)
  - Do not put here: Provider-specific implementations, protocol parsing, hardcoding community modules
- **community** — Provider/model implementations
  - Put here: Runners implementing shared interfaces, provider API calls, protocol adapters
  - Do not put here: Orchestration, Session concepts, dependencies on other community modules

**Dependency flow**: `community` → `shared`; `kernel` → `shared` + `community`. `shared` must not depend on `kernel` or `community`.

---

## Open Topics

| Topic                 | Status |
| --------------------- | ------ |
| Hono API spec         | TODO   |
| Q3.4 Diary format     | Clarify if needed (date headers, message structure) |
