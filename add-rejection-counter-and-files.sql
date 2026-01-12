-- Migration: Add rejection counter and multiple files support
-- Run this in Supabase SQL Editor

-- 1. Add rejection_count and is_dissolved fields to viral_analyses
ALTER TABLE viral_analyses
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_dissolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dissolution_reason TEXT;

-- 2. Create production_files table for multiple file uploads per project
CREATE TABLE IF NOT EXISTS production_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES viral_analyses(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('raw-footage', 'edited-video', 'final-video')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_id TEXT NOT NULL, -- Google Drive or Supabase Storage file ID
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  mime_type TEXT,
  description TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_files_analysis_id ON production_files(analysis_id);
CREATE INDEX IF NOT EXISTS idx_production_files_file_type ON production_files(file_type);
CREATE INDEX IF NOT EXISTS idx_production_files_uploaded_by ON production_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_viral_analyses_rejection_count ON viral_analyses(rejection_count);
CREATE INDEX IF NOT EXISTS idx_viral_analyses_is_dissolved ON viral_analyses(is_dissolved);

-- 4. Add RLS policies for production_files table
ALTER TABLE production_files ENABLE ROW LEVEL SECURITY;

-- Allow users to view files for projects they're assigned to
CREATE POLICY "Users can view files for assigned projects"
  ON production_files
  FOR SELECT
  USING (
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
    -- Allow creator to view their own script files
    analysis_id IN (
      SELECT id FROM viral_analyses WHERE user_id = auth.uid()
    )
  );

-- Allow videographers to upload raw footage
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

-- Allow editors to upload edited videos
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

-- Allow posting managers to upload final videos
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

-- Allow users to delete their own uploaded files
CREATE POLICY "Users can delete their own files"
  ON production_files
  FOR UPDATE
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Allow admins to delete any file
CREATE POLICY "Admins can delete any file"
  ON production_files
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 5. Create trigger to auto-dissolve projects after 5 rejections
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

CREATE TRIGGER trigger_check_rejection_dissolution
  BEFORE UPDATE ON viral_analyses
  FOR EACH ROW
  WHEN (NEW.rejection_count IS DISTINCT FROM OLD.rejection_count)
  EXECUTE FUNCTION check_rejection_dissolution();

-- 6. Create function to increment rejection counter
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

-- 7. Migrate existing raw_footage_url and edited_video_url to production_files table
-- (This preserves any existing file data)
INSERT INTO production_files (analysis_id, file_type, file_name, file_url, file_id, uploaded_by)
SELECT
  id as analysis_id,
  'raw-footage' as file_type,
  'Legacy raw footage' as file_name,
  raw_footage_url as file_url,
  raw_footage_url as file_id, -- Use URL as ID for legacy data
  user_id as uploaded_by
FROM viral_analyses
WHERE raw_footage_url IS NOT NULL AND raw_footage_url != ''
ON CONFLICT DO NOTHING;

INSERT INTO production_files (analysis_id, file_type, file_name, file_url, file_id, uploaded_by)
SELECT
  id as analysis_id,
  'edited-video' as file_type,
  'Legacy edited video' as file_name,
  edited_video_url as file_url,
  edited_video_url as file_id, -- Use URL as ID for legacy data
  user_id as uploaded_by
FROM viral_analyses
WHERE edited_video_url IS NOT NULL AND edited_video_url != ''
ON CONFLICT DO NOTHING;

-- 8. Add helpful comments
COMMENT ON COLUMN viral_analyses.rejection_count IS 'Number of times script was rejected by admin';
COMMENT ON COLUMN viral_analyses.is_dissolved IS 'True if project dissolved after 5 rejections';
COMMENT ON COLUMN viral_analyses.dissolution_reason IS 'Reason for project dissolution';
COMMENT ON TABLE production_files IS 'Stores multiple files per project (raw footage, edited videos, final videos)';

-- 9. Create view for active (non-dissolved) projects
CREATE OR REPLACE VIEW active_projects AS
SELECT *
FROM viral_analyses
WHERE is_dissolved = FALSE OR is_dissolved IS NULL;

-- Grant access to the view
GRANT SELECT ON active_projects TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📊 Added rejection_count, is_dissolved fields to viral_analyses';
  RAISE NOTICE '📁 Created production_files table for multiple file uploads';
  RAISE NOTICE '🔒 Added RLS policies for production_files';
  RAISE NOTICE '🤖 Created auto-dissolution trigger for 5+ rejections';
  RAISE NOTICE '♻️  Migrated existing file URLs to production_files table';
END $$;
