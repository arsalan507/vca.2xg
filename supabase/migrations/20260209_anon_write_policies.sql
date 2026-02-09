-- Migration: Add anon INSERT/UPDATE/DELETE policies for self-hosted PostgREST
-- Date: 2026-02-09
-- Purpose: The frontend runs as anon role (not authenticated) because Authentik
--          tokens are not PostgREST JWTs. All frontend writes go through the anon
--          role and need explicit write policies.
-- Tables: viral_analyses, project_assignments, project_skips, production_files, profile_list

-- ─── viral_analyses ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert viral_analyses" ON public.viral_analyses;
CREATE POLICY "Anon can insert viral_analyses"
  ON public.viral_analyses FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update viral_analyses" ON public.viral_analyses;
CREATE POLICY "Anon can update viral_analyses"
  ON public.viral_analyses FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can delete viral_analyses" ON public.viral_analyses;
CREATE POLICY "Anon can delete viral_analyses"
  ON public.viral_analyses FOR DELETE TO anon
  USING (true);

-- ─── project_assignments ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert project_assignments" ON public.project_assignments;
CREATE POLICY "Anon can insert project_assignments"
  ON public.project_assignments FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update project_assignments" ON public.project_assignments;
CREATE POLICY "Anon can update project_assignments"
  ON public.project_assignments FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can delete project_assignments" ON public.project_assignments;
CREATE POLICY "Anon can delete project_assignments"
  ON public.project_assignments FOR DELETE TO anon
  USING (true);

-- ─── project_skips ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert project_skips" ON public.project_skips;
CREATE POLICY "Anon can insert project_skips"
  ON public.project_skips FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update project_skips" ON public.project_skips;
CREATE POLICY "Anon can update project_skips"
  ON public.project_skips FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can delete project_skips" ON public.project_skips;
CREATE POLICY "Anon can delete project_skips"
  ON public.project_skips FOR DELETE TO anon
  USING (true);

-- ─── production_files ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert production_files" ON public.production_files;
CREATE POLICY "Anon can insert production_files"
  ON public.production_files FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update production_files" ON public.production_files;
CREATE POLICY "Anon can update production_files"
  ON public.production_files FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can delete production_files" ON public.production_files;
CREATE POLICY "Anon can delete production_files"
  ON public.production_files FOR DELETE TO anon
  USING (true);

-- ─── profile_list ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert profile_list" ON public.profile_list;
CREATE POLICY "Anon can insert profile_list"
  ON public.profile_list FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update profile_list" ON public.profile_list;
CREATE POLICY "Anon can update profile_list"
  ON public.profile_list FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- ─── profiles (needed for profile updates) ──────────────────────────────────

DROP POLICY IF EXISTS "Anon can update profiles" ON public.profiles;
CREATE POLICY "Anon can update profiles"
  ON public.profiles FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- ─── Grant INSERT/UPDATE/DELETE to anon role on all public tables ───────────
-- (The self-hosted-init.sql only granted SELECT to anon)

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO anon;

-- Grant sequence usage to anon (needed for serial/identity columns on INSERT)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;
