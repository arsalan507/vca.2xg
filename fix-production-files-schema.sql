-- Fix Production Files Schema and Add Rejection Counter
-- Run this in Supabase SQL Editor

-- 1. Add rejection_count and is_dissolved fields to viral_analyses
ALTER TABLE viral_analyses
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_dissolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dissolution_reason TEXT;

-- 2. Add missing columns to existing production_files table
ALTER TABLE production_files
ADD COLUMN IF NOT EXISTS file_id TEXT,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. Update file_id for existing records (use file_url as fallback)
UPDATE production_files
SET file_id = COALESCE(file_id, file_url)
WHERE file_id IS NULL;

-- 4. Make file_id NOT NULL after populating
ALTER TABLE production_files
ALTER COLUMN file_id SET NOT NULL;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_files_analysis_id ON production_files(analysis_id);
CREATE INDEX IF NOT EXISTS idx_production_files_file_type ON production_files(file_type);
CREATE INDEX IF NOT EXISTS idx_production_files_uploaded_by ON production_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_production_files_is_deleted ON production_files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_viral_analyses_rejection_count ON viral_analyses(rejection_count);
CREATE INDEX IF NOT EXISTS idx_viral_analyses_is_dissolved ON viral_analyses(is_dissolved);

-- 6. Update RLS policies for production_files table (drop old ones first)
DROP POLICY IF EXISTS "Users can view files for assigned projects" ON production_files;
DROP POLICY IF EXISTS "Videographers can upload raw footage" ON production_files;
DROP POLICY IF EXISTS "Editors can upload edited videos" ON production_files;
DROP POLICY IF EXISTS "Posting managers can upload final videos" ON production_files;
DROP POLICY IF EXISTS "Users can delete their own files" ON production_files;
DROP POLICY IF EXISTS "Admins can delete any file" ON production_files;

-- Enable RLS
ALTER TABLE production_files ENABLE ROW LEVEL SECURITY;

-- View files policy (exclude deleted files)
CREATE POLICY "Users can view files for assigned projects"
  ON production_files
  FOR SELECT
  USING (
    is_deleted = FALSE
    AND
    (
      analysis_id IN (
        SELECT analysis_id
        FROM project_assignments
        WHERE user_id = auth.uid()
      )
      OR
      -- Allow admins to view all files
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'ADMIN'
      )
      OR
      -- Allow creator to view their own files
      analysis_id IN (
        SELECT id FROM viral_analyses WHERE user_id = auth.uid()
      )
    )
  );

-- Upload policies
CREATE POLICY "Videographers can upload raw footage"
  ON production_files
  FOR INSERT
  WITH CHECK (
    file_type = 'raw-footage'
    AND
    analysis_id IN (
      SELECT analysis_id
      FROM project_assignments
      WHERE user_id = auth.uid() AND role = 'VIDEOGRAPHER'
    )
  );

CREATE POLICY "Editors can upload edited videos"
  ON production_files
  FOR INSERT
  WITH CHECK (
    file_type = 'edited-video'
    AND
    analysis_id IN (
      SELECT analysis_id
      FROM project_assignments
      WHERE user_id = auth.uid() AND role = 'EDITOR'
    )
  );

CREATE POLICY "Posting managers can upload final videos"
  ON production_files
  FOR INSERT
  WITH CHECK (
    file_type = 'final-video'
    AND
    analysis_id IN (
      SELECT analysis_id
      FROM project_assignments
      WHERE user_id = auth.uid() AND role = 'POSTING_MANAGER'
    )
  );

-- Update/Delete policies
CREATE POLICY "Users can update their own files"
  ON production_files
  FOR UPDATE
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can update any file"
  ON production_files
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Users can delete their own files"
  ON production_files
  FOR DELETE
  USING (uploaded_by = auth.uid());

CREATE POLICY "Admins can delete any file"
  ON production_files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 7. Create trigger to auto-dissolve projects after 5 rejections
CREATE OR REPLACE FUNCTION check_rejection_dissolution()
RETURNS TRIGGER AS $$
BEGIN
  -- If rejection_count reaches 5 or more, mark as dissolved
  IF NEW.rejection_count >= 5 AND NEW.status = 'REJECTED' THEN
    NEW.is_dissolved := TRUE;
    NEW.dissolution_reason := 'Script rejected 5 times - project automatically dissolved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_rejection_dissolution ON viral_analyses;
CREATE TRIGGER trigger_check_rejection_dissolution
  BEFORE UPDATE ON viral_analyses
  FOR EACH ROW
  WHEN (NEW.rejection_count IS DISTINCT FROM OLD.rejection_count)
  EXECUTE FUNCTION check_rejection_dissolution();

-- 8. Create function to increment rejection counter
CREATE OR REPLACE FUNCTION increment_rejection_counter(analysis_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE viral_analyses
  SET
    rejection_count = rejection_count + 1,
    updated_at = NOW()
  WHERE id = analysis_uuid;
END;
$$ LANGUAGE plpgsql;

-- 9. Migrate existing raw_footage_url and edited_video_url to production_files table
-- First, check if data already exists to avoid duplicates
DO $$
BEGIN
  -- Migrate raw footage
  INSERT INTO production_files (
    analysis_id,
    file_type,
    file_name,
    file_url,
    file_id,
    uploaded_by,
    uploaded_at
  )
  SELECT
    id as analysis_id,
    'raw-footage' as file_type,
    'Legacy raw footage' as file_name,
    raw_footage_url as file_url,
    raw_footage_url as file_id,
    user_id as uploaded_by,
    created_at as uploaded_at
  FROM viral_analyses
  WHERE raw_footage_url IS NOT NULL
    AND raw_footage_url != ''
    AND NOT EXISTS (
      SELECT 1 FROM production_files
      WHERE analysis_id = viral_analyses.id
      AND file_type = 'raw-footage'
      AND file_url = viral_analyses.raw_footage_url
    );

  -- Migrate edited videos
  INSERT INTO production_files (
    analysis_id,
    file_type,
    file_name,
    file_url,
    file_id,
    uploaded_by,
    uploaded_at
  )
  SELECT
    id as analysis_id,
    'edited-video' as file_type,
    'Legacy edited video' as file_name,
    edited_video_url as file_url,
    edited_video_url as file_id,
    user_id as uploaded_by,
    created_at as uploaded_at
  FROM viral_analyses
  WHERE edited_video_url IS NOT NULL
    AND edited_video_url != ''
    AND NOT EXISTS (
      SELECT 1 FROM production_files
      WHERE analysis_id = viral_analyses.id
      AND file_type = 'edited-video'
      AND file_url = viral_analyses.edited_video_url
    );
END $$;

-- 10. Add helpful comments
COMMENT ON COLUMN viral_analyses.rejection_count IS 'Number of times script was rejected by admin';
COMMENT ON COLUMN viral_analyses.is_dissolved IS 'True if project dissolved after 5 rejections';
COMMENT ON COLUMN viral_analyses.dissolution_reason IS 'Reason for project dissolution';
COMMENT ON COLUMN production_files.file_id IS 'Google Drive file ID or Supabase Storage path';
COMMENT ON COLUMN production_files.is_deleted IS 'Soft delete flag - TRUE means file is hidden';
COMMENT ON TABLE production_files IS 'Stores multiple files per project (raw footage, edited videos, final videos)';

-- 11. Create view for active (non-dissolved) projects
CREATE OR REPLACE VIEW active_projects AS
SELECT *
FROM viral_analyses
WHERE is_dissolved = FALSE OR is_dissolved IS NULL;

-- Grant access to the view
GRANT SELECT ON active_projects TO authenticated;

-- Success message
DO $$
DECLARE
  rejection_count_exists boolean;
  file_id_exists boolean;
BEGIN
  -- Check what was added
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'viral_analyses' AND column_name = 'rejection_count'
  ) INTO rejection_count_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_files' AND column_name = 'file_id'
  ) INTO file_id_exists;

  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '';

  IF rejection_count_exists THEN
    RAISE NOTICE '✅ Added rejection tracking to viral_analyses:';
    RAISE NOTICE '   - rejection_count (tracks rejections)';
    RAISE NOTICE '   - is_dissolved (auto-set after 5 rejections)';
    RAISE NOTICE '   - dissolution_reason (explains why dissolved)';
  END IF;

  IF file_id_exists THEN
    RAISE NOTICE '✅ Updated production_files table:';
    RAISE NOTICE '   - Added file_id column';
    RAISE NOTICE '   - Added uploaded_at timestamp';
    RAISE NOTICE '   - Added is_deleted for soft deletes';
    RAISE NOTICE '   - Added deleted_at timestamp';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Created database functions:';
  RAISE NOTICE '   - increment_rejection_counter() - safely increments counter';
  RAISE NOTICE '   - check_rejection_dissolution() - auto-dissolves after 5 rejections';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Updated RLS policies for production_files';
  RAISE NOTICE '✅ Created indexes for performance';
  RAISE NOTICE '✅ Migrated legacy file URLs';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Your workflow is now complete!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. Test script rejection (reject 5 times to see dissolution)';
  RAISE NOTICE '   2. Test multiple file uploads as videographer';
  RAISE NOTICE '   3. Check admin UI shows rejection count badges';
END $$;
