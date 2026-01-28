-- ============================================
-- FIX: Add RLS Policies for production_files Table
-- ============================================
-- PROBLEM: Editors cannot see production_files even for projects they can access
--          because production_files has RLS enabled but no policies defined
--
-- SOLUTION: Add policies that allow:
-- 1. Admins to see all files
-- 2. Team members to see files for projects they're assigned to
-- 3. Users to see files for analyses they created
-- ============================================

-- Step 1: Create helper functions with SECURITY DEFINER (if they don't exist)
-- These functions can read the profiles table without RLS restrictions

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();

  RETURN user_role IN ('SUPER_ADMIN', 'CREATOR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_production_team()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();

  RETURN user_role IN ('VIDEOGRAPHER', 'EDITOR', 'POSTING_MANAGER');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Enable RLS on production_files if not already enabled
ALTER TABLE production_files ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "admins_select_all_files" ON production_files;
DROP POLICY IF EXISTS "team_select_assigned_files" ON production_files;
DROP POLICY IF EXISTS "users_select_own_files" ON production_files;
DROP POLICY IF EXISTS "production_team_select_approved_files" ON production_files;
DROP POLICY IF EXISTS "admins_manage_all_files" ON production_files;
DROP POLICY IF EXISTS "team_manage_assigned_files" ON production_files;
DROP POLICY IF EXISTS "users_manage_own_files" ON production_files;
DROP POLICY IF EXISTS "admins_insert_all_files" ON production_files;
DROP POLICY IF EXISTS "team_insert_assigned_files" ON production_files;
DROP POLICY IF EXISTS "admins_update_all_files" ON production_files;
DROP POLICY IF EXISTS "team_update_assigned_files" ON production_files;
DROP POLICY IF EXISTS "admins_delete_all_files" ON production_files;
DROP POLICY IF EXISTS "team_delete_assigned_files" ON production_files;

-- Policy 1: Admins can see ALL production files
CREATE POLICY "admins_select_all_files"
  ON production_files
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Policy 2: Team members can see files for projects they're assigned to
CREATE POLICY "team_select_assigned_files"
  ON production_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.analysis_id = production_files.analysis_id
      AND project_assignments.user_id = auth.uid()
    )
  );

-- Policy 3: Production team (VIDEOGRAPHER, EDITOR, POSTING_MANAGER) can see files
-- for ANY approved analysis (so they can view available projects before picking)
CREATE POLICY "production_team_select_approved_files"
  ON production_files
  FOR SELECT
  TO authenticated
  USING (
    is_production_team()
    AND EXISTS (
      SELECT 1 FROM viral_analyses
      WHERE viral_analyses.id = production_files.analysis_id
      AND viral_analyses.status = 'APPROVED'
    )
  );

-- Policy 4: Users can see files for their own analyses
CREATE POLICY "users_select_own_files"
  ON production_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viral_analyses
      WHERE viral_analyses.id = production_files.analysis_id
      AND viral_analyses.user_id = auth.uid()
    )
  );

-- INSERT Policies

-- Policy 5: Admins can insert files for any project
CREATE POLICY "admins_insert_all_files"
  ON production_files
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Policy 6: Team members can insert files for projects they're assigned to
CREATE POLICY "team_insert_assigned_files"
  ON production_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.analysis_id = production_files.analysis_id
      AND project_assignments.user_id = auth.uid()
    )
  );

-- UPDATE Policies

-- Policy 7: Admins can update any files
CREATE POLICY "admins_update_all_files"
  ON production_files
  FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Policy 8: Team members can update files for projects they're assigned to
CREATE POLICY "team_update_assigned_files"
  ON production_files
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.analysis_id = production_files.analysis_id
      AND project_assignments.user_id = auth.uid()
    )
  );

-- DELETE Policies

-- Policy 9: Admins can delete any files
CREATE POLICY "admins_delete_all_files"
  ON production_files
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Policy 10: Team members can delete files for projects they're assigned to
CREATE POLICY "team_delete_assigned_files"
  ON production_files
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.analysis_id = production_files.analysis_id
      AND project_assignments.user_id = auth.uid()
    )
  );

-- Verify policies
SELECT '=== PRODUCTION_FILES POLICIES ===' as status;
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'production_files'
ORDER BY policyname;

SELECT '✅ PRODUCTION_FILES RLS FIX COMPLETE!' as status;
