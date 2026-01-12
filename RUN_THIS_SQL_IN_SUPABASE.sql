-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR ⚠️
-- This fixes the RLS policy that's preventing videographers from creating project assignments

-- Fix INSERT policy
DROP POLICY IF EXISTS "Allow users to create assignments" ON project_assignments;

CREATE POLICY "Allow users to create assignments"
ON project_assignments
FOR INSERT
WITH CHECK (
  -- Allow if user is admin
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  OR
  -- Allow if user is assigning themselves
  user_id = auth.uid()
  OR
  -- Allow if user is the one doing the assigning
  assigned_by = auth.uid()
);

-- Fix SELECT policy
DROP POLICY IF EXISTS "Allow users to view assignments" ON project_assignments;

CREATE POLICY "Allow users to view assignments"
ON project_assignments
FOR SELECT
USING (
  -- Allow if user is admin
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  OR
  -- Allow if user is assigned to the project
  user_id = auth.uid()
  OR
  -- Allow if user assigned someone else
  assigned_by = auth.uid()
);

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Allow users to update assignments" ON project_assignments;

CREATE POLICY "Allow users to update assignments"
ON project_assignments
FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  OR
  assigned_by = auth.uid()
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  OR
  assigned_by = auth.uid()
);

-- Fix DELETE policy
DROP POLICY IF EXISTS "Allow users to delete assignments" ON project_assignments;

CREATE POLICY "Allow users to delete assignments"
ON project_assignments
FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  OR
  assigned_by = auth.uid()
);

-- ✅ After running this, refresh your browser and try creating a project again!
