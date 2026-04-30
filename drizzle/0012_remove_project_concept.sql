ALTER TABLE scheduled_tasks ADD channel_id text;
ALTER TABLE scheduled_tasks DROP COLUMN project_name;
ALTER TABLE sessions DROP COLUMN project_name;
