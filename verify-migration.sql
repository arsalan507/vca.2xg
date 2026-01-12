-- Verification Script
-- Run this to verify the migration worked correctly

-- 1. Check viral_analyses columns
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'viral_analyses'
AND column_name IN ('rejection_count', 'is_dissolved', 'dissolution_reason')
ORDER BY column_name;

-- 2. Check production_files columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'production_files'
AND column_name IN ('file_id', 'uploaded_at', 'is_deleted', 'deleted_at')
ORDER BY column_name;

-- 3. Check functions exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('increment_rejection_counter', 'check_rejection_dissolution')
AND routine_schema = 'public';

-- 4. Check trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_check_rejection_dissolution';

-- 5. Check indexes exist
SELECT
  indexname,
  tablename
FROM pg_indexes
WHERE indexname IN (
  'idx_production_files_analysis_id',
  'idx_production_files_file_type',
  'idx_production_files_uploaded_by',
  'idx_production_files_is_deleted',
  'idx_viral_analyses_rejection_count',
  'idx_viral_analyses_is_dissolved'
)
ORDER BY tablename, indexname;

-- 6. Check RLS policies
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'production_files'
ORDER BY policyname;

-- 7. Check active_projects view exists
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'active_projects';

-- 8. Sample data check - viral_analyses
SELECT
  id,
  rejection_count,
  is_dissolved,
  status
FROM viral_analyses
LIMIT 5;

-- 9. Sample data check - production_files
SELECT
  id,
  file_type,
  file_name,
  is_deleted,
  uploaded_at
FROM production_files
LIMIT 5;
