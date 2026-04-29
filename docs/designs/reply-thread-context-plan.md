# Reply Thread Context — Part 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user replies to a Feishu message and triggers a new session, carry the source message content as context so Claude understands what's being replied to.

**Architecture:** Extend UserMessage with an optional `replyTo` field (Zod schema). In the Feishu message channel, detect `parent_id`/`root_id` from inbound events, fetch the source message via Feishu API, and populate `replyTo`. In the kernel, format `replyTo` into XML-tagged context prepended to the user's message content before passing to the agent runner.

**Tech Stack:** TypeScript, Zod, @larksuiteoapi/node-sdk, pino logging, bun:test

**Spec:** `docs/designs/reply-thread-context.md`

---

### Task 1: Add ReplyContext Type and Extend UserMessage Schema

**Files:**
- Modify: `src/shared/messaging/types/message.ts:45-57`

- [ ] **Step 1: Add ReplyContext Zod schema and extend UserMessage**

In `src/shared/messaging/types/message.ts`, add the ReplyContext schema before the UserMessage definition, then extend UserMessage:

```typescript
/**
 * Context from the message being replied to.
 */
export const ReplyContext = z.object({
  messageId: z.string(),
  content: z.string(),
  sender: z.string().optional(),
  replyType: z.enum(["parent", "root"]),
});
export interface ReplyContext extends z.infer<typeof ReplyContext> {}
```

Then extend the UserMessage schema — add `replyTo` after the `channel_id` field:

```typescript
export const UserMessage = BaseMessage.extend({
  role: z.literal("user"),
  channel_id: z.string().optional(),
  replyTo: ReplyContext.optional(),
  content: z.array(
    z.discriminatedUnion("type", [
      TextMessageContent,
      ImageUrlMessageContent,
      ToolResultMessageContent,
    ]),
  ),
});
```

- [ ] **Step 2: Verify type correctness**

Run: `bunx tsc --noEmit`
Expected: No type errors. Existing code should compile fine since `replyTo` is optional.

- [ ] **Step 3: Commit**

```bash
git add src/shared/messaging/types/message.ts
git commit -m "feat: add ReplyContext type to UserMessage schema"
```

---

### Task 2: Add Source Message Fetching Helper

**Files:**
- Modify: `src/community/feishu/messaging/message-channel.ts`

- [ ] **Step 1: Add `_fetchSourceMessage` private method**

Add this method to the `FeishuMessageChannel` class. Place it near the existing `_parseMessageContent` method for grouping:

```typescript
/**
 * Fetch a message by ID from Feishu and extract readable text content.
 * Returns null if fetch fails or content cannot be extracted.
 */
private async _fetchSourceMessage(
  messageId: string,
): Promise<{ content: string; sender?: string } | null> {
  try {
    const { data } = await this._client.im.message.get({
      path: { message_id: messageId },
    });
    const msg = data?.items?.[0];
    if (!msg) {
      this._logger.warn({ messageId }, "source message not found");
      return null;
    }

    const content = this._extractReadableContent(msg.msg_type, msg.body?.content);
    if (!content) {
      this._logger.warn(
        { messageId, msg_type: msg.msg_type },
        "could not extract readable content from source message",
      );
      return null;
    }

    const sender = msg.sender?.id;
    return { content, sender };
  } catch (err) {
    this._logger.warn({ err, messageId }, "failed to fetch source message");
    return null;
  }
}
```

- [ ] **Step 2: Add `_extractReadableContent` helper**

Add this method to the class. Handles the main Feishu message types:

```typescript
/**
 * Extract human-readable text from Feishu message content.
 * Content is a JSON string whose shape depends on msg_type.
 */
private _extractReadableContent(
  msgType: string | undefined,
  rawContent: string | undefined,
): string | null {
  if (!rawContent) return null;
  try {
    const parsed = JSON.parse(rawContent);

    switch (msgType) {
      case "text":
        return parsed.text ?? null;

      case "post": {
        // Rich text: { "zh_cn": { "title": "...", "content": [[{ "tag": "text", "text": "..." }]] } }
        const locale = parsed.zh_cn ?? parsed.en_us ?? Object.values(parsed)[0];
        if (!locale) return null;
        const parts: string[] = [];
        if (locale.title) parts.push(locale.title);
        for (const paragraph of locale.content ?? []) {
          for (const node of paragraph) {
            if (node.tag === "text") parts.push(node.text);
            else if (node.tag === "a") parts.push(node.text ?? node.href);
            else if (node.tag === "at") parts.push(`@${node.user_name ?? node.user_id}`);
          }
        }
        return parts.join("\n") || null;
      }

      case "interactive":
        // Card message — extract header title as summary
        return parsed.header?.title?.content ?? "[interactive card]";

      default:
        return `[${msgType ?? "unknown"} message]`;
    }
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/community/feishu/messaging/message-channel.ts
git commit -m "feat: add source message fetching helpers for reply context"
```

---

### Task 3: Populate `replyTo` in `_handleMessageReceive`

**Files:**
- Modify: `src/community/feishu/messaging/message-channel.ts:660-692`

- [ ] **Step 1: Refactor `_handleMessageReceive` to extract reply context**

Replace the current `_handleMessageReceive` method (lines 660-692) with:

```typescript
private _handleMessageReceive = async ({
  message: receivedMessage,
}: MessageReceiveEventData) => {
  if (this.config.fallback) {
    const sibling = this._siblings.get(receivedMessage.chat_id);
    if (sibling) {
      this._logger.info(
        { from: this.id, to: sibling.id, chat_id: receivedMessage.chat_id },
        "dispatching to sibling channel",
      );
      sibling.injectMessageEvent({ message: receivedMessage } as MessageReceiveEventData);
      return;
    }
  } else {
    if (receivedMessage.chat_id !== this.config.chatId) return;
  }

  const {
    message_id: messageId,
    thread_id: threadId,
    parent_id: parentId,
    root_id: rootId,
  } = receivedMessage;

  // Log all thread-related fields for debugging Feishu behavior
  this._logger.info(
    { messageId, threadId, parentId, rootId },
    "inbound message thread context",
  );

  const session_id = this._resolveSessionId(threadId);

  // Determine reply source
  let replyTo: ReplyContext | undefined;
  if (parentId && rootId) {
    this._logger.warn(
      { messageId, parentId, rootId },
      "both parent_id and root_id present, using parent_id",
    );
  }

  const sourceMessageId = parentId ?? rootId;
  if (sourceMessageId) {
    const replyType = parentId ? "parent" : "root";
    this._logger.info(
      { messageId, sourceMessageId, replyType },
      "fetching source message for reply context",
    );

    const source = await this._fetchSourceMessage(sourceMessageId);
    if (source) {
      replyTo = {
        messageId: sourceMessageId,
        content: source.content,
        sender: source.sender,
        replyType,
      };
      this._logger.info(
        {
          messageId,
          sourceMessageId,
          replyType,
          contentPreview: source.content.slice(0, 100),
        },
        "reply context populated",
      );
    }
  }

  const userMessage: UserMessage = {
    id: messageId,
    session_id,
    role: "user",
    content: [
      await this._parseMessageContent(
        messageId,
        receivedMessage.message_type,
        receivedMessage.content,
        receivedMessage.mentions,
      ),
    ],
    ...(replyTo && { replyTo }),
  };

  this.emit("message:inbound", userMessage);
};
```

- [ ] **Step 2: Add ReplyContext import**

At the top of `message-channel.ts`, ensure `ReplyContext` is imported:

```typescript
import { type ReplyContext, type UserMessage, /* ... existing imports ... */ } from "@/shared";
```

Check that `ReplyContext` is re-exported from the shared barrel file (`src/shared/index.ts` or `src/shared/messaging/types/index.ts`). If not, add the export.

- [ ] **Step 3: Verify compilation**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/community/feishu/messaging/message-channel.ts src/shared/
git commit -m "feat: populate replyTo from parent_id/root_id in inbound messages"
```

---

### Task 4: Format `replyTo` into Prompt in Kernel

**Files:**
- Modify: `src/kernel/kernel.ts:268-289`
- Modify: `src/shared/messaging/utils/index.ts:50-86`

- [ ] **Step 1: Add `formatReplyContext` utility function**

In `src/shared/messaging/utils/index.ts`, add a function after `extractTextContent`:

```typescript
/**
 * Format a UserMessage's replyTo context as an XML-tagged prefix.
 * Returns the formatted string, or empty string if no replyTo.
 */
export function formatReplyContext(message: UserMessage): string {
  if (!message.replyTo) return "";
  const sender = message.replyTo.sender ? ` sender="${message.replyTo.sender}"` : "";
  return `<replying_to${sender}>\n${message.replyTo.content}\n</replying_to>\n\n`;
}
```

Ensure this function is re-exported from the barrel file.

- [ ] **Step 2: Prepend reply context in kernel `_handleInboundMessageTask`**

In `src/kernel/kernel.ts`, modify `_handleInboundMessageTask` to transform the message before streaming. After resolving the session and before `_streamToMessage`:

```typescript
private _handleInboundMessageTask = async (
  _taskId: string,
  sessionId: string,
  payload: InboundMessageTaskPayload,
  signal?: AbortSignal,
) => {
  const inboundMessage = payload.message;
  const session = await this._sessionManager.resolveSession(sessionId, {
    channelId: inboundMessage.channel_id,
    firstMessage: inboundMessage,
  });

  // Prepend reply context to message content if present
  const messageForAgent = this._prependReplyContext(inboundMessage);

  const outboundMessage = await this._messageGateway.replyMessage(
    inboundMessage.id,
    {
      role: "assistant",
      session_id: session.id,
      content: [{ type: "thinking", thinking: "Thinking..." }],
    },
    { streaming: true },
  );
  await this._streamToMessage(session, messageForAgent, outboundMessage.id, signal);
};
```

Add the helper method to the Kernel class:

```typescript
private _prependReplyContext(message: UserMessage): UserMessage {
  const prefix = formatReplyContext(message);
  if (!prefix) return message;

  this._logger.info(
    {
      sessionId: message.session_id,
      replyToMessageId: message.replyTo!.messageId,
      replyType: message.replyTo!.replyType,
    },
    "prepending reply context to message",
  );

  // Clone message with context prepended to first text content block
  const newContent = [...message.content];
  const firstTextIdx = newContent.findIndex((c) => c.type === "text");
  if (firstTextIdx >= 0) {
    const original = newContent[firstTextIdx] as { type: "text"; text: string };
    newContent[firstTextIdx] = {
      type: "text",
      text: prefix + original.text,
    };
  } else {
    // No text content — insert as new text block at the beginning
    newContent.unshift({ type: "text", text: prefix.trimEnd() });
  }

  return { ...message, content: newContent };
}
```

- [ ] **Step 3: Add imports in kernel.ts**

```typescript
import { formatReplyContext } from "@/shared";
```

- [ ] **Step 4: Verify compilation**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Manual test**

1. Start Agentara: `bun run dev`
2. In Feishu, reply to an existing Tara message with "test reply context"
3. Check logs for:
   - `inbound message thread context` with parentId/rootId values
   - `fetching source message for reply context`
   - `reply context populated` with content preview
   - `prepending reply context to message`
4. Verify Claude's response shows awareness of the source message

- [ ] **Step 6: Commit**

```bash
git add src/shared/messaging/utils/index.ts src/kernel/kernel.ts
git commit -m "feat: format replyTo context into prompt for Claude"
```

---

### Task 5: Edge Cases and Robustness

**Files:**
- Modify: `src/community/feishu/messaging/message-channel.ts`

- [ ] **Step 1: Handle long source messages**

In `_fetchSourceMessage`, truncate excessively long content to avoid blowing up the prompt:

```typescript
private async _fetchSourceMessage(
  messageId: string,
): Promise<{ content: string; sender?: string } | null> {
  // ... existing fetch logic ...

  const MAX_REPLY_CONTEXT_LENGTH = 2000;
  if (content.length > MAX_REPLY_CONTEXT_LENGTH) {
    this._logger.info(
      { messageId, originalLength: content.length },
      "truncating long source message",
    );
    content = content.slice(0, MAX_REPLY_CONTEXT_LENGTH) + "\n[...truncated]";
  }

  // ... rest of method ...
}
```

- [ ] **Step 2: Verify compilation and test**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/community/feishu/messaging/message-channel.ts
git commit -m "feat: truncate long source messages in reply context"
```

---

### Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | ReplyContext type + UserMessage extension | `src/shared/messaging/types/message.ts` |
| 2 | Source message fetch helpers | `src/community/feishu/messaging/message-channel.ts` |
| 3 | Populate replyTo in inbound handler | `src/community/feishu/messaging/message-channel.ts` |
| 4 | Format replyTo into prompt in kernel | `src/kernel/kernel.ts`, `src/shared/messaging/utils/index.ts` |
| 5 | Edge cases (truncation) | `src/community/feishu/messaging/message-channel.ts` |
