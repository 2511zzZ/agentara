import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Maps Feishu thread IDs to Agentara session IDs.
 *
 * Each row represents a single Feishu message thread that has been
 * associated with a session. The in-memory cache in
 * {@link FeishuMessageChannel} is the hot path; this table is the
 * durable fallback that survives restarts.
 */
export const feishuThreads = sqliteTable("feishu_threads", {
  /** The Feishu thread identifier (unique per conversation thread). */
  thread_id: text("thread_id").primaryKey(),
  /** The channel type that created this mapping (e.g. `"feishu"`). */
  channel_type: text("channel_type").notNull(),
  /** The Agentara session identifier. */
  session_id: text("session_id").notNull(),
  /** Epoch milliseconds when the mapping was created. */
  created_at: integer("created_at").notNull(),
});
