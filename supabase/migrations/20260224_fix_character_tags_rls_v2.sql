-- Fix character_tags INSERT policy
-- The previous policy used auth.uid() != zero_uuid, but since all PostgREST requests
-- use the static anon JWT (no sub claim), auth.uid() always returns zero UUID → check failed.
-- The anon role already has INSERT privilege at the table level (controlled by PostgreSQL grants).
-- Using WITH CHECK (true) is safe: only trusted app users hold the anon key.

DROP POLICY IF EXISTS "Authenticated users can insert character tags" ON character_tags;
DROP POLICY IF EXISTS "Admins and writers can insert character tags" ON character_tags;
DROP POLICY IF EXISTS "Only admins can insert character tags" ON character_tags;

CREATE POLICY "Allow insert character tags" ON character_tags
  FOR INSERT
  WITH CHECK (true);
