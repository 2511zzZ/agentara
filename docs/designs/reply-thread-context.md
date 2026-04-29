# Reply Thread Context

When a user replies to a Feishu message, the new session should carry the source message context so Claude understands what's being replied to.

## Part 1: Core — UserMessage `replyTo` + Prompt Formatting

### 1.1 Type: ReplyContext

Add to UserMessage as optional field `replyTo?: ReplyContext`.

```typescript
interface ReplyContext {
  messageId: string         // source message ID (parent_id or root_id)
  content: string           // extracted text content of the source message
  sender?: string           // sender name or ID
  replyType: 'parent' | 'root'  // which field provided the ID
  // Future (Part 2):
  // taskId?: string
  // sessionId?: string
}
```

### 1.2 message-channel.ts: Populate `replyTo`

In `_handleMessageReceive`, before creating UserMessage:

1. Extract `parent_id` and `root_id` from event data.
2. Branch logic:
   - Only `parent_id` → normal reply, fetch via `parent_id`, `replyType: 'parent'`
   - Only `root_id` → thread reply, fetch via `root_id`, `replyType: 'root'`
   - Both present → **log warning**, prefer `parent_id`
   - Neither → normal message, skip
3. Call `im.message.get` to fetch source message content.
4. Parse message body — handle text, post, interactive card types, extract readable text.
5. Populate `replyTo` on UserMessage.

**Error handling**: If fetch fails, log warning, leave `replyTo` undefined. Session creation proceeds normally without context.

**Logging** (always, for testing Feishu behavior):
- Raw values of `parent_id`, `root_id`, `thread_id` on every inbound message
- Which branch was taken (normal reply / thread reply / both / neither)
- Fetch result (success + content preview / failure reason)
- New session vs resume session

### 1.3 kernel.ts: Format `replyTo` into Prompt

When passing UserMessage to Claude agent runner, if `replyTo` is present, prepend context:

```xml
<replying_to sender="{sender}">
{source message content}
</replying_to>

{user's reply text}
```

XML tags for clear semantic boundaries — won't be confused with user content.

Applies to both new and resumed sessions. `replyTo` is populated unconditionally at message-channel level; kernel decides usage.

### 1.4 Scope

| Component | Change |
|---|---|
| UserMessage type definition | Add `ReplyContext` interface + `replyTo` optional field |
| message-channel.ts `_handleMessageReceive` | Extract parent_id/root_id, fetch source, populate replyTo |
| message-channel.ts (new helper) | `_fetchSourceMessage(messageId)` — call im.message.get, parse body |
| kernel.ts | Format replyTo into prompt before passing to agent runner |
| Logging | Detailed logs at message-channel + kernel level |

## Part 2: Skill — Message-Task Mapping (Independent)

A skill that wraps feishu-cli for outbound message sending, maintaining a message_id ↔ task/session mapping. Gateway layer is untouched.

### 2.1 Scope

Covers **proactive push messages only** — instant task output, scheduled task output, pulse, daily review, etc. NOT gateway-level session replies (those stay in message-channel.ts as-is).

### 2.2 Mapping Storage

Skill-managed local storage (file or sqlite):

```
message_id → { session_id, task_id, channel_id, timestamp }
```

Written after each outbound message sent via the skill.

### 2.3 Send Message

Wraps feishu-cli send commands. After successful send, records the mapping.

All existing proactive push paths (feishu-dm, task output routing, etc.) should migrate to use this skill.

### 2.4 Reverse Lookup

Given a `message_id` (from Part 1's `replyTo.messageId`), look up the originating task/session.

**Lazy**: Only triggered when user explicitly asks about task details or when deeper context is needed. Not called automatically on every reply.

### 2.5 Logging

- Outbound: log message_id, session_id, task_id on write
- Reverse lookup: log hit/miss, matched task_id/session_id

## Migration

After Part 1 + Part 2 are validated:
- Remove old `_mapThreadToSession` logic in message-channel.ts (outbound thread binding)
- Tracked in: `tasks/2026-04-29-remove-old-thread-session-binding.md`

## Implementation Order

1. **Part 1** first — core capability, independent of Part 2
2. **Part 2** after Part 1 is validated — skill layer, no core changes
3. **Migration** after both are stable
