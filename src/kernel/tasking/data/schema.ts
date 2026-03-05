import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Persisted task records that mirror the bunqueue job lifecycle
 * but survive process restarts.
 *
 * The `id` column matches the bunqueue job ID so the two can be correlated.
 */
export const tasks = sqliteTable("tasks", {
  /** Unique identifier, same as the bunqueue job ID. */
  id: text("id").primaryKey(),
  /** The task payload type, e.g. `"inbound_message"` or `"cronjob"`. */
  type: text("type").notNull(),
  /** Current lifecycle status: pending → running → completed | failed. */
  status: text("status").notNull().default("pending"),
  /** The full task payload serialised as JSON. */
  payload: text("payload", { mode: "json" }).notNull(),
  /** Epoch milliseconds when the task was created. */
  created_at: integer("created_at").notNull(),
  /** Epoch milliseconds when the task was last updated. */
  updated_at: integer("updated_at").notNull(),
});
