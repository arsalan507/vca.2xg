# VCA - Viral Content Analyzer

## Project Overview
Mobile-first production management app for viral content teams. Manages the pipeline: Script Writing -> Admin Review -> Videographer Shooting -> Editor Editing -> Posting Manager Publishing.

## Architecture
- **Frontend**: React 19 + TypeScript + Tailwind CSS + Vite (in `app-v2/`)
- **Backend**: Express.js (in `backend/`)
- **Database**: Self-hosted PostgreSQL 16 (Docker)
- **API Layer**: PostgREST (auto-generated REST API from PostgreSQL)
- **Auth**: Google Sign-In + 4-digit PIN (no external auth service)
- **Deployment**: Docker Compose on Coolify (OVHCloud VPS), Traefik reverse proxy

## Domains
- `vca.2xg.in` - Frontend (app-v2)
- `vca-api.2xg.in` - Backend Express API
- `vca-api.2xg.in/postgrest` - PostgREST (direct DB access from frontend)

## Git Remotes
- `origin` -> `2xggrowth-art/vca.2xg` (team repo)
- `personal` -> `arsalan507/vca.2xg` (Coolify pulls from this)
- **CRITICAL**: Always push to BOTH remotes: `git push origin main && git push personal main`
- Coolify ONLY deploys from `personal` remote
- Use `git push-both` alias (configured) for convenience

## Key Directories
```
app-v2/          # Production frontend (React + Vite) - ACTIVE
backend/         # Express.js API server - ACTIVE
supabase/        # Database migrations (SQL files) - ACTIVE
docker-compose.yml  # All service definitions - ACTIVE
```

## Frontend (app-v2/) Structure
```
src/
  pages/           # Role-based pages (admin/, videographer/, editor/, posting/, writer/)
  services/        # API service layer (PostgREST + backend calls)
  hooks/           # useAuth.tsx (auth context)
  lib/api.ts       # Custom PostgREST client + auth module
  components/      # Shared UI components
  types/           # TypeScript types
```

## Database
- **Roles**: `anon` (PostgREST), `authenticator` (PostgREST connection)
- **User Roles**: SUPER_ADMIN, CREATOR, SCRIPT_WRITER, VIDEOGRAPHER, EDITOR, POSTING_MANAGER
- **Key Tables**: viral_analyses, profiles, project_assignments, production_files, project_skips
- **RLS**: Enabled on all tables (role-based access)
- **Content ID**: Auto-generated via `generate_content_id_on_approval` RPC

## Auth Flow
1. Google Sign-In -> backend verifies ID token -> returns JWT
2. First login: must set 4-digit PIN
3. PIN login: email + 4-digit PIN (for non-Google devices)
4. JWT contains: user id, email, role

## Development
```bash
# Frontend dev server
cd app-v2 && npm run dev    # http://localhost:5174

# Backend dev server
cd backend && npm run dev   # http://localhost:3001

# Build frontend
cd app-v2 && npm run build
```

## Deployment
```bash
# Push to both remotes (personal triggers Coolify)
git push-both
# Or manually: git push origin main && git push personal main

# Trigger Coolify deploy manually (if needed)
# See MEMORY.md for Coolify API token and deploy endpoint
```

## DB Constraints to Remember
- `profiles_role_check`: Only allows SUPER_ADMIN, CREATOR, SCRIPT_WRITER, VIDEOGRAPHER, EDITOR, POSTING_MANAGER
- `profiles.email` is UNIQUE
- `project_assignments` has UNIQUE (analysis_id, user_id, role)
- Content IDs are tracked in `used_content_ids` and never reused

## Performance Notes
- Dashboard stats use `head: true` count queries (no full data fetches)
- Service methods parallelize independent queries with `Promise.all`
- PostgREST pool: 20 connections, max 1000 rows per response
- Pages are lazy-loaded via React.lazy()

## Safety Rules
- **NEVER** touch non-VCA containers on the shared VPS
- Verify the correct app UUID from MEMORY.md before any Coolify API call
- Only touch VCA-prefixed containers when running docker exec
- Always check DB constraints before writing code that sets roles/statuses
- Test builds locally (`npm run build`) before pushing
