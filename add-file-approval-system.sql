-- Add approval/rejection system for production files
-- Similar to script review, but for video files

SELECT '=== Adding File Approval System ===' as step;

DO $$
BEGIN
  -- Add approval status field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_files' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE production_files ADD COLUMN approval_status TEXT DEFAULT 'pending'
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  -- Add reviewed by field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_files' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE production_files ADD COLUMN reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add review notes field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_files' AND column_name = 'review_notes'
  ) THEN
    ALTER TABLE production_files ADD COLUMN review_notes TEXT;
  END IF;

  -- Add reviewed at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_files' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE production_files ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for approval status queries
CREATE INDEX IF NOT EXISTS idx_production_files_approval_status ON production_files(approval_status);
CREATE INDEX IF NOT EXISTS idx_production_files_reviewed_by ON production_files(reviewed_by);

SELECT '✅ File approval fields added successfully' as status;

-- Display summary
SELECT
  '📊 Summary: production_files table now supports approval workflow' as info;

SELECT
  'Fields added:' as info,
  '- approval_status (pending/approved/rejected)' as field_1,
  '- reviewed_by (admin who reviewed)' as field_2,
  '- review_notes (feedback from admin)' as field_3,
  '- reviewed_at (timestamp)' as field_4;
