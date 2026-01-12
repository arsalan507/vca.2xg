-- Fix RLS Policy for project_assignments table
-- This allows videographers to assign themselves to projects they create

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Allow users to create assignments" ON project_assignments;

-- Create new INSERT policy that allows:
-- 1. Admins to create any assignment
-- 2. Users to assign themselves to projects
CREATE POLICY "Allow users to create assignments"
ON project_assignments
FOR INSERT
WITH CHECK (
  -- Allow if user is admin
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  OR
  -- Allow if user is assigning themselves (user_id = auth.uid())
  user_id = auth.uid()
  OR
  -- Allow if user is the one doing the assigning (assigned_by = auth.uid())
  assigned_by = auth.uid()
);

-- Also ensure SELECT policy allows users to see their own assignments
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

-- Ensure UPDATE policy allows admins and assigned users to update
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

-- Ensure DELETE policy allows admins and assigners to delete
DROP POLICY IF EXISTS "Allow users to delete assignments" ON project_assignments;

CREATE POLICY "Allow users to delete assignments"
ON project_assignments
FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  OR
  assigned_by = auth.uid()
);
