-- reference_url was NOT NULL but the script creation form sends null when the
-- field is empty. The field is optional — all display pages guard it with &&.

ALTER TABLE viral_analyses ALTER COLUMN reference_url DROP NOT NULL;
