-- Backfill channel_id from channel_type for legacy sessions.
-- Uses the default Feishu channel ID; adjust if your config differs.
UPDATE `sessions` SET `channel_id` = '9e3eae94-fe88-4043-af40-e7f88943a370'
WHERE `channel_id` IS NULL AND `channel_type` = 'feishu';
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_type` text NOT NULL,
	`cwd` text NOT NULL,
	`channel_id` text,
	`first_message` text NOT NULL DEFAULT '',
	`last_message_created_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "agent_type", "cwd", "channel_id", "first_message", "last_message_created_at", "created_at", "updated_at") SELECT "id", "agent_type", "cwd", "channel_id", "first_message", "last_message_created_at", "created_at", "updated_at" FROM `sessions`;
--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
