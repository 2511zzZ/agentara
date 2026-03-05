import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Persisted session records that track session metadata across restarts.
 *
 * Message content is still stored in `.jsonl` files — this table only
 * holds the session envelope (who, where, when).
 */
export const sessions = sqliteTable("sessions", {
  /** Unique session identifier. */
  id: text("id").primaryKey(),
  /** The agent runner type, e.g. `"claude-code"`. */
  agent_type: text("agent_type").notNull(),
  /** Working directory the session was created with. */
  cwd: text("cwd").notNull(),
  /** Epoch milliseconds of the most recent message, or null if no messages yet. */
  last_message_created_at: integer("last_message_created_at"),
  /** Epoch milliseconds when the session was created. */
  created_at: integer("created_at").notNull(),
  /** Epoch milliseconds when the session was last updated. */
  updated_at: integer("updated_at").notNull(),
});
