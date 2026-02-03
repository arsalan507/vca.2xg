-- ============================================================================
-- Self-Hosted PostgreSQL Initialization
-- Replaces Supabase-specific auth.users with local users table
-- Sets up PostgREST roles and auth.uid() compatibility shim
-- ============================================================================

-- ─── Create Authentik database (for Authentik to use) ─────────────────────
-- Created automatically by 00-create-authentik-db.sh init script

-- ─── PostgREST Roles ─────────────────────────────────────────────────────

-- Authenticator role: PostgREST connects as this, then switches to JWT role
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
  END IF;
END $$;

-- Authenticated role: All logged-in users get this role via JWT
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END $$;

-- Anonymous role: Unauthenticated requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
END $$;

-- Grant role switching to authenticator
GRANT authenticated TO authenticator;
GRANT anon TO authenticator;

-- ─── Auth Compatibility Schema ────────────────────────────────────────────

-- Create auth schema for compatibility with Supabase RLS policies
CREATE SCHEMA IF NOT EXISTS auth;

-- auth.uid() shim: extracts user ID from PostgREST JWT claims
-- This makes ALL existing RLS policies work unchanged
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE;

-- auth.role() shim: extracts role from JWT claims
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'anon'
  );
$$ LANGUAGE sql STABLE;

-- ─── Users Table (replaces Supabase auth.users) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Schema Permissions ───────────────────────────────────────────────────

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

-- Grant table access for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant sequence access
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant function execution
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, anon;

-- Apply default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- ─── Enable Row Level Security ────────────────────────────────────────────

-- Note: RLS policies from Supabase migrations will be imported separately.
-- The auth.uid() shim above ensures they work without modification.
-- Make sure to run the original Supabase migrations after this init script,
-- but SKIP the parts that reference auth.users schema.

-- ─── Notes for Data Migration ─────────────────────────────────────────────
--
-- After this init runs, you need to:
-- 1. Import the public schema tables (profiles, viral_analyses, etc.)
-- 2. Import the public schema data
-- 3. Populate the users table from Supabase's auth.users export:
--    INSERT INTO users (id, email, created_at)
--    SELECT id, email, created_at FROM auth_users_export;
-- 4. Update profiles.id foreign key to reference users(id) instead of auth.users(id)
-- 5. Import RLS policies (they'll work via auth.uid() shim)
-- 6. Import PL/pgSQL functions (except handle_new_user which referenced auth.users)
-- 7. Create the authentik database: CREATE DATABASE authentik;
