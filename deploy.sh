#!/bin/bash
# ============================================================================
# ViralContentAnalyzer - Self-Hosted Deployment Script
# Deploys full stack to OVHCloud VPS via SSH
# ============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_DIR="/opt/viral-content-analyzer"

if [ -z "$VPS_HOST" ]; then
    echo "Usage: VPS_HOST=your-vps-ip ./deploy.sh"
    echo ""
    echo "Required environment variables:"
    echo "  VPS_HOST     - IP address or hostname of your OVHCloud VPS"
    echo "  VPS_USER     - SSH user (default: root)"
    echo ""
    echo "The script will:"
    echo "  1. Upload project files to the VPS"
    echo "  2. Set up PostgreSQL + PostgREST + Authentik + Backend + Frontend"
    echo "  3. Import your Supabase data"
    echo "  4. Import voice notes"
    echo ""
    exit 1
fi

SSH_CMD="ssh ${VPS_USER}@${VPS_HOST}"
SCP_CMD="scp -r"

echo "============================================"
echo "  ViralContentAnalyzer Self-Hosted Deploy"
echo "============================================"
echo ""
echo "Target: ${VPS_USER}@${VPS_HOST}"
echo "Deploy dir: ${DEPLOY_DIR}"
echo ""

# ─── Step 1: Check VPS Connectivity ─────────────────────────────────────────

echo "=== Step 1: Checking VPS connectivity ==="
$SSH_CMD "echo 'Connected to VPS successfully'" || {
    echo "ERROR: Cannot connect to VPS. Check your SSH key and VPS_HOST."
    exit 1
}

# ─── Step 2: Install Docker on VPS if needed ─────────────────────────────────

echo "=== Step 2: Ensuring Docker is installed ==="
$SSH_CMD "command -v docker >/dev/null 2>&1 || {
    echo 'Installing Docker...'
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo 'Docker installed.'
}"

$SSH_CMD "command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || {
    echo 'Installing Docker Compose plugin...'
    apt-get update && apt-get install -y docker-compose-plugin
}"

# ─── Step 3: Create deployment directory ─────────────────────────────────────

echo "=== Step 3: Setting up deployment directory ==="
$SSH_CMD "mkdir -p ${DEPLOY_DIR}"

# ─── Step 4: Upload files ───────────────────────────────────────────────────

echo "=== Step 4: Uploading project files ==="

# Create a tarball of needed files (excluding node_modules, .git, etc.)
echo "  Creating deployment package..."
tar czf /tmp/vca-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.vercel' \
    --exclude='dist' \
    --exclude='.env' \
    -C "$(dirname "$0")" \
    docker-compose.yml \
    .env.example \
    backend/ \
    frontend/ \
    supabase/

echo "  Uploading to VPS..."
scp /tmp/vca-deploy.tar.gz ${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/
$SSH_CMD "cd ${DEPLOY_DIR} && tar xzf vca-deploy.tar.gz && rm vca-deploy.tar.gz"

# Upload voice notes
echo "  Uploading voice notes..."
$SCP_CMD "$(dirname "$0")/supabase/exports/voice-notes/" ${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/voice-notes-import/

rm -f /tmp/vca-deploy.tar.gz

# ─── Step 5: Check for .env file ────────────────────────────────────────────

echo "=== Step 5: Environment configuration ==="
$SSH_CMD "[ -f ${DEPLOY_DIR}/.env ]" 2>/dev/null || {
    echo ""
    echo "  WARNING: No .env file found on VPS!"
    echo "  Copying .env.example as starting point..."
    $SSH_CMD "cp ${DEPLOY_DIR}/.env.example ${DEPLOY_DIR}/.env"
    echo ""
    echo "  IMPORTANT: You MUST edit ${DEPLOY_DIR}/.env on the VPS before continuing."
    echo "  Fill in all values (DB_PASSWORD, AUTHENTIK_SECRET_KEY, JWT_SECRET, etc.)"
    echo ""
    echo "  Run: ssh ${VPS_USER}@${VPS_HOST} nano ${DEPLOY_DIR}/.env"
    echo ""
    echo "  Then re-run this script."
    exit 0
}

# ─── Step 6: Start infrastructure (DB + Redis first) ────────────────────────

echo "=== Step 6: Starting infrastructure ==="
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose up -d postgres authentik-redis"
echo "  Waiting for PostgreSQL to be healthy..."
$SSH_CMD "cd ${DEPLOY_DIR} && timeout 60 bash -c 'until docker compose exec -T postgres pg_isready -U postgres; do sleep 2; done'"

# ─── Step 7: Create Authentik database ──────────────────────────────────────

echo "=== Step 7: Creating Authentik database ==="
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose exec -T postgres psql -U postgres -c 'CREATE DATABASE authentik;' 2>/dev/null || echo '  (authentik DB already exists)'"

# ─── Step 8: Apply schema migrations ────────────────────────────────────────

echo "=== Step 8: Applying database schema ==="
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose exec -T postgres psql -U postgres -d viral_content_analyzer -f /docker-entrypoint-initdb.d/01-init.sql" 2>/dev/null || echo "  (init already applied)"
$SSH_CMD "cd ${DEPLOY_DIR} && cat supabase/migrations/02-import-schema.sql | docker compose exec -T postgres psql -U postgres -d viral_content_analyzer"

# ─── Step 9: Import data ────────────────────────────────────────────────────

echo "=== Step 9: Importing Supabase data ==="

# Import users from CSV
echo "  Importing users..."
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose exec -T postgres psql -U postgres -d viral_content_analyzer <<'EOSQL'
CREATE TEMP TABLE auth_users_import (
    id UUID,
    email TEXT,
    encrypted_password TEXT,
    raw_user_meta_data TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
EOSQL"

$SSH_CMD "cd ${DEPLOY_DIR} && cat supabase/exports/auth_users.csv | docker compose exec -T postgres psql -U postgres -d viral_content_analyzer -c \"\\COPY auth_users_import FROM STDIN WITH (FORMAT csv, HEADER true)\""

$SSH_CMD "cd ${DEPLOY_DIR} && docker compose exec -T postgres psql -U postgres -d viral_content_analyzer <<'EOSQL'
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at FROM auth_users_import
ON CONFLICT (id) DO NOTHING;
DROP TABLE auth_users_import;
EOSQL"

# Import table data
echo "  Importing table data..."
$SSH_CMD "cd ${DEPLOY_DIR} && sed -e '/^\\\\restrict/d' -e '/^\\\\unrestrict/d' supabase/exports/public_data.sql | docker compose exec -T postgres psql -U postgres -d viral_content_analyzer"

# ─── Step 10: Set PostgREST authenticator password ──────────────────────────

echo "=== Step 10: Setting PostgREST authenticator password ==="
$SSH_CMD "cd ${DEPLOY_DIR} && source .env && docker compose exec -T postgres psql -U postgres -d viral_content_analyzer -c \"ALTER ROLE authenticator WITH PASSWORD '\${PGRST_DB_PASS}';\""

# ─── Step 11: Import voice notes ────────────────────────────────────────────

echo "=== Step 11: Importing voice notes ==="
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose up -d backend && sleep 3"
$SSH_CMD "docker cp ${DEPLOY_DIR}/voice-notes-import/. \$(docker compose -f ${DEPLOY_DIR}/docker-compose.yml ps -q backend):/data/voice-notes/"

# ─── Step 12: Start all services ────────────────────────────────────────────

echo "=== Step 12: Starting all services ==="
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose up -d"

echo ""
echo "  Waiting for services to stabilize..."
sleep 10

# ─── Step 13: Verify ────────────────────────────────────────────────────────

echo "=== Step 13: Verifying deployment ==="
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose ps"

echo ""
$SSH_CMD "cd ${DEPLOY_DIR} && docker compose exec -T postgres psql -U postgres -d viral_content_analyzer -c \"
SELECT 'users' as tbl, COUNT(*) FROM users
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'viral_analyses', COUNT(*) FROM viral_analyses
UNION ALL SELECT 'production_files', COUNT(*) FROM production_files
ORDER BY tbl;
\""

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "Services:"
echo "  Frontend:   http://${VPS_HOST}"
echo "  Backend:    http://${VPS_HOST}:3001"
echo "  PostgREST:  http://${VPS_HOST}:3000"
echo "  Authentik:  http://${VPS_HOST}:9000"
echo ""
echo "Next steps:"
echo "  1. Access Authentik at http://${VPS_HOST}:9000/if/flow/initial-setup/"
echo "     to create the admin account"
echo "  2. Set up OAuth2 provider in Authentik for the app"
echo "  3. Import users into Authentik (run import-authentik-users.sh)"
echo "  4. Configure DNS to point your domain to ${VPS_HOST}"
echo "  5. Set up SSL via Coolify or Caddy reverse proxy"
echo ""
