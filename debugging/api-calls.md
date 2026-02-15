# VCA API Call Reference

## How Frontend Talks to Database

The frontend uses a custom PostgREST client (`app-v2/src/lib/api.ts`) that mimics the Supabase JS client API. All calls go to `https://vca-api.2xg.in/postgrest/`.

### Authentication

Every PostgREST request includes:
```
Authorization: Bearer <JWT>
```

The JWT is an anon token signed with `JWT_SECRET` (HS256), containing `role: "anon"`. PostgreSQL RLS policies use this role to filter data.

The user's actual identity is stored in a separate auth JWT from the backend (`/api/auth/*`), stored in localStorage.

### Common Query Patterns

#### SELECT (read)
```
GET /postgrest/viral_analyses?select=*,profile:profile_list(id,name,platform)&status=eq.APPROVED
```
Translates to: `SELECT *, profile_list.* FROM viral_analyses JOIN profile_list ON ... WHERE status = 'APPROVED'`

#### INSERT (create)
```
POST /postgrest/production_files
Body: { analysis_id: "...", file_type: "edited-video", ... }
```

#### UPDATE (modify)
```
PATCH /postgrest/viral_analyses?id=eq.<uuid>
Body: { production_stage: "SHOOTING" }
```

#### DELETE (remove)
```
DELETE /postgrest/viral_analyses?id=eq.<uuid>
```
**IMPORTANT**: PostgREST returns empty body (204) on DELETE. The supabase client must handle this gracefully.

### Backend API Calls (Express)

These go to `https://vca-api.2xg.in/api/` and require the user's auth JWT:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/google` | POST | Verify Google ID token, return auth JWT |
| `/api/auth/pin-login` | POST | Login with email + PIN |
| `/api/auth/set-pin` | POST | Set/update 4-digit PIN |
| `/api/admin/users` | POST | Create team member |
| `/api/admin/users/:id` | DELETE | Delete team member |
| `/api/admin/users/:id/role` | PATCH | Update user role |
| `/api/admin/users/:id/reset-pin` | POST | Reset user PIN |

### RPC Calls (PostgreSQL Functions)

| Function | Called From | Purpose |
|----------|------------|---------|
| `generate_content_id_on_approval(uuid, uuid)` | adminService.reviewAnalysis | Generate content ID like BCH-001 |
| `increment_rejection_counter(uuid)` | adminService.reviewAnalysis | Increment rejection count |

## Known Issues

### DELETE Returns Empty Body
PostgREST DELETE returns 204 No Content with empty body. If the supabase client tries to parse this as JSON, it throws "Unexpected end of JSON input". The `deleteProject` method in adminService must handle this.

### 500 During Deployment
When Coolify redeploys, all containers restart within ~11 seconds. During this window, PostgREST may be up while Postgres is still starting, causing 500 errors. These are transient and resolve automatically.

### Schema Cache Stale After Migration
After running SQL migrations directly via `docker exec`, PostgREST's schema cache doesn't know about new columns/functions. Must send SIGUSR1 to PostgREST container to reload:
```bash
docker kill --signal=SIGUSR1 <postgrest-container-name>
```
