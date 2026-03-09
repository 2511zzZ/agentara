CREATE TABLE `feishu_threads` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`channel_type` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` integer NOT NULL
);
