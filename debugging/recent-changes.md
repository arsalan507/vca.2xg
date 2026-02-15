# Recent Changes (2026-02-15)

## What Changed

### 1. Profile Codes + Content ID Fix
**Files**: `supabase/migrations/20260215_profile_codes_and_content_id_fix.sql`

- Added `code TEXT UNIQUE` column to `profile_list` table
- Set codes: BCH, EMD, NXT, RAL, SH, TOY, WOW, LUX, CAR
- Rewrote `generate_content_id_on_approval` function:
  - OLD: `'BCH' || UPPER(LEFT(name, 3))` → produced `BCHBCH001` for "BCH main"
  - NEW: reads `code` from `profile_list` → produces `BCH-001`
  - Backward compatible: handles old BCHBCH* and BCH-NNNN patterns for sequence numbering
- **Status**: Deployed to production DB via docker exec. PostgREST schema cache reloaded.

### 2. File Auto-Rename on Upload
**Files**:
- `app-v2/src/services/googleDriveOAuthService.ts` — added `fileName` param to `uploadFile()`
- `app-v2/src/pages/editor/UploadPage.tsx` — names edited videos as `{content_id}_v{N}.{ext}`
- `app-v2/src/pages/videographer/UploadPage.tsx` — names raw footage as `{content_id}_raw_{NN}.{ext}`
- **Status**: Deployed. Not yet tested with actual upload.

### 3. Profile Management UI
**Files**:
- `app-v2/src/services/adminService.ts` — added `getProfiles()`, `createProfile()`, `updateProfile()`, `deleteProfile()`
- `app-v2/src/pages/admin/TeamPage.tsx` — added "Profiles" tab with CRUD UI
- **Status**: Deployed. Not yet tested.

### 4. PWA Service Worker Fix
**Files**:
- `app-v2/vite.config.ts` — added `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`
- `app-v2/src/main.tsx` — added `controllerchange` auto-reload, enabled `refetchOnWindowFocus`
- **Status**: Deployed.

## Known Bug: Delete Project Fails

### Symptom
Clicking delete on a project shows "Failed to delete project" with error "Unexpected end of JSON input".

### Root Cause
The projects being deleted were ALREADY deleted from the database on a previous attempt. The DB operation succeeded, but PostgREST returned an empty response body, and the supabase client crashed trying to parse it as JSON. The error toast showed, so the user thinks delete failed, but the row is actually gone.

On subsequent attempts, the project page still loads from React in-memory state (SPA), but the DELETE returns 0 rows affected with an empty body, triggering the same JSON parse error.

### Fix Applied
**File**: `app-v2/src/lib/api.ts` (line 545-553)

**Root cause in code**: `PostgRESTQueryBuilder._execute()` had a DELETE early-return check `if (this._method === 'DELETE' && !this._selectColumns)` but `_selectColumns` defaults to `'*'`, so the check never triggered. The code fell through to `res.json()` which crashed on empty body.

**Fix**:
1. Changed DELETE check to always return early (no body parsing needed)
2. Added empty body safety: `res.text()` + check for empty string before `JSON.parse()`

### Verification
```sql
-- These projects are confirmed DELETED from the database:
-- 7af39919-dbd7-41e2-b0a1-0e754e9b770e (BCHBCH007)
-- dcf45ac3-069b-41a2-a219-231c0acbba02 (BCHBCH008)
-- b856c391-2133-41e2-a9eb-efc98283ba5c (TEST-003)
SELECT id FROM viral_analyses WHERE id IN (
  '7af39919-dbd7-41e2-b0a1-0e754e9b770e',
  'dcf45ac3-069b-41a2-a219-231c0acbba02',
  'b856c391-2133-41e2-a9eb-efc98283ba5c'
);
-- Returns 0 rows
```

## 500 Errors from PostgREST

### Symptom
Console shows `Failed to load resource: the server responded with a status of 500` for PostgREST queries.

### Root Cause
Transient errors during Coolify deployment — all containers (postgres, postgrest, backend, frontend) restart within ~11 seconds. During that window, PostgREST is up but can't connect to Postgres.

### Current Status
PostgREST is healthy. All queries return 200. Schema cache freshly loaded with 19 Relations, 17 Relationships, 11 Functions.

### Prevention
The deployment restart is unavoidable with Docker Compose on Coolify. Possible improvements:
- Add health checks to docker-compose so PostgREST waits for Postgres
- Add retry logic in the frontend for transient 500/502 errors
