-- Migration: Add planned_date and admin_remarks fields to viral_analyses
-- Date: 2026-01-19
-- Description: Adds support for planned shoot date and admin remarks visible to team members

-- Add planned_date column (date when the shoot is planned)
ALTER TABLE viral_analyses
ADD COLUMN IF NOT EXISTS planned_date DATE;

-- Add admin_remarks column (visible to all team members)
ALTER TABLE viral_analyses
ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

-- Add PLANNED to production_stage enum if not exists
-- Note: PostgreSQL doesn't allow easy modification of enums, so we need to check if it exists first
DO $$
BEGIN
    -- Check if 'PLANNED' value exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'PLANNED'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'production_stage')
    ) THEN
        -- Add PLANNED after PRE_PRODUCTION
        ALTER TYPE production_stage ADD VALUE 'PLANNED' AFTER 'PRE_PRODUCTION';
    END IF;
EXCEPTION
    WHEN others THEN
        -- If enum doesn't exist or other error, ignore
        NULL;
END $$;

-- Add index for planned_date queries (filter by planned date)
CREATE INDEX IF NOT EXISTS idx_viral_analyses_planned_date
ON viral_analyses(planned_date)
WHERE planned_date IS NOT NULL;

-- Comment on new columns
COMMENT ON COLUMN viral_analyses.planned_date IS 'Date when the shoot is planned - setting this moves the script to PLANNED stage';
COMMENT ON COLUMN viral_analyses.admin_remarks IS 'Admin remarks visible to all assigned team members (videographer, editor, posting manager)';
