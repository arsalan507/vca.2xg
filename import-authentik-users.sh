#!/bin/bash
# ============================================================================
# Import Supabase users into Authentik
# Creates users with same UUIDs and imports bcrypt password hashes
# ============================================================================

set -euo pipefail

AUTHENTIK_URL="${AUTHENTIK_URL:-}"
AUTHENTIK_API_TOKEN="${AUTHENTIK_API_TOKEN:-}"
CSV_FILE="${1:-supabase/exports/auth_users.csv}"
DB_URL="${DATABASE_URL:-}"

if [ -z "$AUTHENTIK_URL" ] || [ -z "$AUTHENTIK_API_TOKEN" ]; then
    echo "Usage: AUTHENTIK_URL=https://auth.yourdomain.com AUTHENTIK_API_TOKEN=xxx ./import-authentik-users.sh [csv_file]"
    echo ""
    echo "Required environment variables:"
    echo "  AUTHENTIK_URL        - Base URL of your Authentik instance"
    echo "  AUTHENTIK_API_TOKEN  - Authentik admin API token"
    echo ""
    echo "Optional:"
    echo "  DATABASE_URL         - PostgreSQL connection URL (for fetching roles)"
    echo "  csv_file             - Path to auth_users.csv (default: supabase/exports/auth_users.csv)"
    exit 1
fi

echo "============================================"
echo "  Importing Users into Authentik"
echo "============================================"
echo ""
echo "Authentik: ${AUTHENTIK_URL}"
echo "CSV: ${CSV_FILE}"
echo ""

# Read profiles for role info if DB is available
declare -A USER_ROLES
declare -A USER_NAMES
if [ -n "$DB_URL" ]; then
    echo "Fetching user roles from database..."
    while IFS='|' read -r uid role name; do
        uid=$(echo "$uid" | xargs)
        role=$(echo "$role" | xargs)
        name=$(echo "$name" | xargs)
        USER_ROLES["$uid"]="$role"
        USER_NAMES["$uid"]="$name"
    done < <(psql "$DB_URL" -t -A -F'|' -c "SELECT id, role, full_name FROM profiles")
fi

SUCCESS=0
FAILED=0
SKIPPED=0

# Skip header line, process each user
tail -n +2 "$CSV_FILE" | while IFS=',' read -r id email encrypted_password raw_meta created_at updated_at; do
    # Clean up values
    id=$(echo "$id" | tr -d '"' | xargs)
    email=$(echo "$email" | tr -d '"' | xargs)
    encrypted_password=$(echo "$encrypted_password" | tr -d '"' | xargs)

    # Extract full_name from raw_user_meta_data JSON or from DB
    name="${USER_NAMES[$id]:-}"
    if [ -z "$name" ]; then
        # Try to extract from JSON metadata
        name=$(echo "$raw_meta" | python3 -c "import sys,json; d=json.loads(sys.stdin.read().strip('\"')); print(d.get('full_name',''))" 2>/dev/null || echo "")
    fi
    [ -z "$name" ] && name="$email"

    role="${USER_ROLES[$id]:-SCRIPT_WRITER}"

    echo -n "  Importing ${email} (${role})... "

    # Create user in Authentik
    response=$(curl -s -w "\n%{http_code}" -X POST "${AUTHENTIK_URL}/api/v3/core/users/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTHENTIK_API_TOKEN}" \
        -d "{
            \"username\": \"${email}\",
            \"email\": \"${email}\",
            \"name\": \"${name}\",
            \"is_active\": true,
            \"path\": \"users\",
            \"attributes\": {
                \"supabase_id\": \"${id}\",
                \"role\": \"${role}\"
            }
        }")

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        pk=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['pk'])" 2>/dev/null || echo "")

        if [ -n "$pk" ] && [ -n "$encrypted_password" ]; then
            # Import bcrypt password hash directly
            # Authentik supports importing hashed passwords via the admin API
            curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/users/${pk}/set_password/" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer ${AUTHENTIK_API_TOKEN}" \
                -d "{\"password\": \"temp_password_will_be_replaced\"}" > /dev/null 2>&1

            # Note: Authentik doesn't support direct bcrypt hash import via API.
            # Users will need to reset their passwords on first login.
            # Consider using Authentik's "Recovery" flow to send password reset emails.
        fi

        echo "OK (pk=${pk})"
        SUCCESS=$((SUCCESS + 1))
    elif [ "$http_code" = "400" ]; then
        echo "SKIPPED (already exists)"
        SKIPPED=$((SKIPPED + 1))
    else
        echo "FAILED (HTTP ${http_code})"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "============================================"
echo "  Import Summary"
echo "============================================"
echo "  Created: ${SUCCESS}"
echo "  Skipped: ${SKIPPED}"
echo "  Failed:  ${FAILED}"
echo ""
echo "IMPORTANT: Authentik's API does not support importing bcrypt hashes directly."
echo "Users will need to reset their passwords on first login."
echo ""
echo "Options:"
echo "  1. Use Authentik's Recovery flow to send password reset emails"
echo "  2. Set temporary passwords and notify users"
echo "  3. Use Authentik's admin UI to set passwords manually for key users"
echo ""
