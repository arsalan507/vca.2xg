# VCA Architecture Overview

## System Diagram

```
Phone/Browser (PWA)
    |
    |-- Static assets --> Nginx (vca.2xg.in) --> Service Worker cache
    |
    |-- API calls --> PostgREST (vca-api.2xg.in/postgrest) --> PostgreSQL
    |
    |-- Auth calls --> Express Backend (vca-api.2xg.in/api) --> PostgreSQL
    |
    |-- File uploads --> Google Drive API (googleapis.com)
```

## Containers (Docker Compose on Coolify)

| Container | Image | Port | Domain |
|-----------|-------|------|--------|
| vca-frontend-v2 | nginx (built React app) | 80 | vca.2xg.in |
| vca-backend | node:20 (Express) | 3001 | vca-api.2xg.in/api |
| vca-postgrest | postgrest/postgrest | 3000 | vca-api.2xg.in/postgrest |
| vca-postgres | postgres:16-alpine | 5432 | internal only |

## Data Flow

### Read (SELECT)
```
React Component → service method (e.g. adminService.getAnalysis)
  → supabase client (app-v2/src/lib/api.ts)
    → PostgREST REST API (GET /postgrest/viral_analyses?...)
      → PostgreSQL (RLS policies filter by role: anon)
```

### Write (INSERT/UPDATE/DELETE)
```
React Component → service method
  → supabase client
    → PostgREST REST API (POST/PATCH/DELETE)
      → PostgreSQL (RLS policies + triggers)
```

### Auth
```
React Component → Google Sign-In (client-side)
  → Backend /api/auth/google (verifies ID token)
    → PostgreSQL profiles table
      → Returns JWT (signed with JWT_SECRET)

React Component → PIN Login
  → Backend /api/auth/pin-login
    → PostgreSQL profiles table (bcrypt verify)
      → Returns JWT
```

## Key Service Files

| File | Purpose |
|------|---------|
| `app-v2/src/lib/api.ts` | Supabase-compatible PostgREST client + auth module |
| `app-v2/src/services/adminService.ts` | Admin API (review, team, profiles, delete) |
| `app-v2/src/services/editorService.ts` | Editor API (projects, upload, mark complete) |
| `app-v2/src/services/videographerService.ts` | Videographer API (projects, upload, mark complete) |
| `app-v2/src/services/postingManagerService.ts` | Posting manager API |
| `app-v2/src/services/productionFilesService.ts` | File records CRUD |
| `app-v2/src/services/googleDriveOAuthService.ts` | Google Drive upload (OAuth + chunked upload) |

## Database

- **Engine**: PostgreSQL 16 (Alpine)
- **DB name**: `viral_content_analyzer`
- **PostgREST role**: `anon` (all frontend calls use this role)
- **RLS**: Enabled on ALL tables
- **Auth**: JWT signed with `JWT_SECRET` env var, role claim = `anon`

### Key Tables

| Table | Purpose |
|-------|---------|
| `viral_analyses` | Projects (scripts/videos in production pipeline) |
| `profiles` | Users (team members with roles) |
| `profile_list` | Content profiles (BCH, WOW, etc.) with codes |
| `project_assignments` | Maps users to projects by role |
| `production_files` | Uploaded file records (Drive links) |
| `project_skips` | Tracks who skipped which project |
| `used_content_ids` | Permanent content ID registry (never reused) |
| `industries` | Industry categories |

### Triggers on viral_analyses

| Trigger | Event | Purpose |
|---------|-------|---------|
| `set_updated_at` | BEFORE UPDATE | Sets `updated_at` timestamp |
| `track_content_id_trigger` | AFTER INSERT/UPDATE of content_id | Records ID in `used_content_ids` |
| `mark_content_id_deleted_trigger` | BEFORE DELETE | Marks content ID as deleted (keeps it reserved) |
| `trigger_check_rejection_dissolution` | BEFORE UPDATE | Checks rejection count threshold |
| `trg_calculate_cast_total` | BEFORE INSERT/UPDATE | Calculates cast composition total |

### FK Cascade on viral_analyses DELETE

All child tables CASCADE on delete:
- `production_files` → CASCADE
- `project_assignments` → CASCADE
- `project_skips` → CASCADE
- `analysis_character_tags` → CASCADE
- `analysis_hook_tags` → CASCADE
- `project_requests` → SET NULL
