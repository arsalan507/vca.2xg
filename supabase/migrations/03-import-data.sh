#!/bin/bash
# ============================================================================
# Data Import Script
# Imports exported Supabase data into self-hosted PostgreSQL
# Run this AFTER 01-init.sql and 02-import-schema.sql have been applied
# ============================================================================

set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://postgres:${DB_PASSWORD}@localhost:5432/viral_content_analyzer}"
EXPORT_DIR="$(dirname "$0")/../exports"

echo "=== Step 1: Import users from auth_users.csv ==="
# Create temp table, import CSV, then populate users table
export PATH="/opt/homebrew/opt/libpq/bin:$PATH" 2>/dev/null || true

psql "$DB_URL" <<'SQL'
-- Create temp table for CSV import
CREATE TEMP TABLE auth_users_import (
    id UUID,
    email TEXT,
    encrypted_password TEXT,
    raw_user_meta_data TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
SQL

# Import CSV (skip header)
psql "$DB_URL" -c "\COPY auth_users_import FROM '${EXPORT_DIR}/auth_users.csv' WITH (FORMAT csv, HEADER true)"

psql "$DB_URL" <<'SQL'
-- Populate users table from imported auth data
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at FROM auth_users_import
ON CONFLICT (id) DO NOTHING;

DROP TABLE auth_users_import;
SQL

echo "=== Step 2: Import public schema data ==="
# Process the data dump to remove \restrict/\unrestrict directives
# and fix any extensions.uuid_generate_v4() references
sed -e '/^\\restrict/d' -e '/^\\unrestrict/d' \
    "${EXPORT_DIR}/public_data.sql" | \
    psql "$DB_URL"

echo "=== Step 3: Verify import ==="
psql "$DB_URL" -c "
SELECT 'users' as tbl, COUNT(*) FROM users
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'viral_analyses', COUNT(*) FROM viral_analyses
UNION ALL SELECT 'production_files', COUNT(*) FROM production_files
UNION ALL SELECT 'project_assignments', COUNT(*) FROM project_assignments
UNION ALL SELECT 'industries', COUNT(*) FROM industries
UNION ALL SELECT 'character_tags', COUNT(*) FROM character_tags
UNION ALL SELECT 'hook_tags', COUNT(*) FROM hook_tags
UNION ALL SELECT 'profile_list', COUNT(*) FROM profile_list
ORDER BY tbl;
"

echo ""
echo "=== Data import complete! ==="
echo "Users and all application data have been imported."
echo ""
echo "Next steps:"
echo "  1. Import users into Authentik (use import-authentik-users.sh)"
echo "  2. Copy voice notes to /data/voice-notes/ volume"
echo "  3. Start the full stack with docker compose up"
