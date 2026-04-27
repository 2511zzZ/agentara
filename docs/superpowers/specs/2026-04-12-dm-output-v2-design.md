# DM Output V2

## Problem

V1 (send DM first, then stream agent output in thread) had poor UX:
- The instruction text as DM was confusing (e.g. "send jojo a message" looked like a new task)
- Streaming updates in a thread under a notification felt noisy
- For simple tasks like reminders, the agent tried to re-execute what the DM already delivered

## Design

### Flow

```
Scheduled/Instant task triggered
  → Create session (cwd = workspace / payload.cwd)
  → session.run() — wait for agent to complete
  → If result contains [SKIPPED], do nothing
  → sendDirectMessage(result) — send full result card as DM to owner via open_id
  → reply_in_thread under that DM to create thread + map thread_id → session_id
  → User can continue conversation in the thread
```

### `sendDirectMessage` Redesign

Change the signature from `sendDirectMessage(content: string)` to accept an `AssistantMessage`, matching `postMessage`:

```typescript
async sendDirectMessage(
  message: Omit<AssistantMessage, "id">,
): Promise<AssistantMessage>
```

The implementation is nearly identical to `postMessage`, except:
- `receive_id_type: "open_id"` instead of `"chat_id"`
- `receive_id: ownerOpenId` instead of `chatId`

Everything else — card rendering, reply_in_thread for thread creation, thread-session mapping, file attachments — is reused from `postMessage`.

### Interface Changes

Update `MessageChannel` and `MessageGateway` interfaces:

```typescript
// MessageChannel
sendDirectMessage(
  message: Omit<AssistantMessage, "id">,
): Promise<AssistantMessage>;

// MessageGateway — takes explicit channelId since session may not exist yet
sendDirectMessage(
  channelId: string,
  message: Omit<AssistantMessage, "id">,
): Promise<AssistantMessage>;
```

### Handler Changes

#### `_handleScheduledTask`

```
1. Create synthetic UserMessage (channel_id = default)
2. Resolve session (cwd = config.paths.workspace)
3. session.run(userMessage) → get assistantMessage
4. If [SKIPPED], return
5. sendDirectMessage(channelId, assistantMessage) → DM sent, thread created, thread mapped to session
```

#### `_handleInstantTask`

Same pattern, using `payload.cwd` for session cwd.

### [SKIPPED] Handling

Since the DM is sent after the agent completes, [SKIPPED] is handled cleanly — simply don't send the DM.

### Thread Continuity

`sendDirectMessage` calls `reply_in_thread` on its own DM (same as `postMessage` does today), which creates a thread. The `thread_id` from the reply is mapped to `session_id` via `_mapThreadToSession()`. When the user later replies in that thread, the inbound handler resolves the same session and continues the conversation.

## Files to Change

| File | Change |
|------|--------|
| `src/shared/messaging/message-channel.ts` | Update `sendDirectMessage` signature |
| `src/shared/messaging/message-gateway.ts` | Update `sendDirectMessage` signature |
| `src/community/feishu/messaging/message-channel.ts` | Rewrite `sendDirectMessage` to mirror `postMessage` with `open_id` |
| `src/kernel/messaging/multi-channel-message-gateway.ts` | Update `sendDirectMessage` to pass `AssistantMessage` |
| `src/kernel/kernel.ts` | Rewrite `_handleScheduledTask` and `_handleInstantTask`: run first, then DM |
