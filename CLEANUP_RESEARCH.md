# VCA Cleanup Research Report
**Date**: Feb 19, 2026

---

## ✅ RESEARCH FINDINGS

### 1. The `/backend/` Folder IS USED in Production
**Verdict**: ❌ **DO NOT DELETE**

**Evidence**:
- `docker-compose.yml` line 70-107 builds from `./backend` folder
- Production backend container: `vca-backend`
- Used for: Google Drive uploads, voice notes, authentication

**Why it looked unused**:
- The `backend/.env` file has OLD Supabase credentials
- But docker-compose OVERRIDES these with `DATABASE_URL`
- So production never uses those old credentials

---

## 2. What Needs to be CLEANED UP

### ❌ REMOVE: Outdated Supabase References in `.env`

**File**: `/backend/.env`
**Lines to remove**:
```env
SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Why**:
- These are from VCA v1 (old Supabase cloud setup)
- Production uses `DATABASE_URL` instead (self-hosted PostgreSQL)
- These credentials cause "Database not configured" error locally

**Replace with**:
```env
# For LOCAL development, use production database or Docker
DATABASE_URL=postgres://postgres:your_password@localhost:5432/viral_content_analyzer

# Or leave empty and run via docker-compose
```

---

### ❌ REMOVE: Old Authentik References

**File**: `/backend/.env`
**Lines to remove** (if not used):
```env
AUTHENTIK_URL=https://vca-auth.2xg.in
AUTHENTIK_CLIENT_ID=...
AUTHENTIK_CLIENT_SECRET=...
AUTHENTIK_API_TOKEN=...
```

**Question**: Is Authentik still used for authentication?
- VCA CLAUDE.md says: "Google Sign-In + 4-digit PIN (no external auth service)"
- If PIN auth is used, Authentik might be outdated

**Action**: Check if `AUTHENTIK_*` is referenced in backend code before removing

---

### ❌ UPDATE: Old IP Addresses

**File**: `/backend/.env`
**Current**:
```env
FRONTEND_URL=http://192.168.68.125:5174
```

**Should be** (for local dev):
```env
FRONTEND_URL=http://localhost:5174
```

---

## 3. Database Setup in Coolify

### Expected Setup (from docker-compose.yml)
docker-compose defines **1 database**:
- Container: `vca-postgres` (PostgreSQL 16)
- Accessed by: `vca-backend` and `vca-postgrest`

### To Check in Coolify
We need to verify in Coolify dashboard:
1. How many database containers exist?
2. Are there any orphaned Supabase containers?
3. Is there a second database we're not using?

**Coolify URL**: http://51.195.46.40:8000
**Project path**: `/project/dkwo4w0w4wsoco4k04swgog8/environment/xo8okkogscso40k4so84g4ow`

---

## 4. Safe Cleanup Plan

### Step 1: Check Authentik Usage
```bash
cd /backend/src
grep -r "AUTHENTIK" .
```
- If found → Keep the credentials
- If not found → Remove from `.env`

### Step 2: Update backend/.env for Local Development
```env
# Remove old Supabase credentials
# Add DATABASE_URL instead:
DATABASE_URL=postgres://postgres:YourPassword@localhost:5432/viral_content_analyzer

# Update IP addresses
FRONTEND_URL=http://localhost:5174
PORT=3001

# Keep these (used in production)
JWT_SECRET=sLJvfqg+jZPcWiAVaVQLQY2R4CMe7wuAAZ50qnI2Js4=
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=...
GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID=...
GOOGLE_DRIVE_EDITED_VIDEO_FOLDER_ID=...
GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID=...
VOICE_NOTES_DIR=/tmp/voice-notes
```

### Step 3: Create `.env.example` Template
Update `backend/.env.example` to reflect new structure (no Supabase)

### Step 4: Check Coolify for Duplicate Databases
1. Login to http://51.195.46.40:8000
2. Navigate to VCA project
3. Check "Services" tab
4. Look for:
   - ✅ `vca-postgres` (self-hosted) - KEEP
   - ❓ Any Supabase containers - DELETE if found
   - ❓ Any duplicate PostgreSQL - DELETE if found

---

## 5. Why 2 Database Systems Existed

### Timeline
```
VCA v1 (Initial)
  ↓
  Used: Supabase Cloud
  Backend .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

VCA v2 (Migration)
  ↓
  Migrated to: Self-hosted PostgreSQL + PostgREST
  docker-compose.yml: DATABASE_URL
  BUT: Forgot to clean up old .env references

Current State
  ↓
  Production: Uses DATABASE_URL ✅
  Local .env: Still has old SUPABASE_URL ❌
  Result: Local dev broken
```

---

## 6. Recommended Action

### ✅ SAFE TO REMOVE
1. ✅ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from `backend/.env`
2. ✅ Old IP addresses (192.168.68.x)
3. ✅ AUTHENTIK_* (if not used in code)

### ❌ DO NOT REMOVE
1. ❌ `/backend/` folder itself
2. ❌ `docker-compose.yml`
3. ❌ Google Drive credentials
4. ❌ JWT_SECRET

### ⚠️ VERIFY FIRST
1. Check if Authentik is used in code
2. Check Coolify for orphaned database containers
3. Get correct DATABASE_URL password for local dev

---

## 7. Next Steps

**Please confirm**:
1. Should I clean up the `backend/.env` file? (Remove Supabase + Authentik references)
2. Do you want to check Coolify together to see if there are duplicate databases?
3. Do you have the PostgreSQL password for local DATABASE_URL?

Once confirmed, I'll execute the cleanup safely.

---

*End of Research Report*
