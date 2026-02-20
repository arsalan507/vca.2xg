# VCA Backend Connection Report
**Date**: Feb 19, 2026
**Issue**: "Database not configured" error on local development

---

## 1. PRODUCTION SETUP (How It Should Work)

### Infrastructure
```
┌─────────────────────────────────────────────────────────────┐
│           OVH CLOUD SERVER (51.195.46.40)                   │
│           Managed by COOLIFY                                │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   FRONTEND     │  │    BACKEND     │  │  PostgreSQL  │  │
│  │   vca.2xg.in   │  │ vca-api.2xg.in│  │   +          │  │
│  │                │  │                │  │  PostgREST   │  │
│  │  React + Vite  │  │  Express API   │  │              │  │
│  │  Port 5174     │  │  Port 3001     │  │  Port 5432   │  │
│  └────────────────┘  └───────┬────────┘  │  Port 3001   │  │
│                              │           └──────────────┘  │
│                              └──────────►                  │
│                            Reads/Writes                    │
│                                                             │
│  ALL runs inside Docker containers via docker-compose.yml  │
└─────────────────────────────────────────────────────────────┘
```

### Production Domains
| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | https://vca.2xg.in | React PWA |
| **Backend API** | https://vca-api.2xg.in | Express.js server |
| **PostgREST** | https://vca-api.2xg.in/postgrest | Direct DB REST API |

### Production Database
- **Type**: Self-hosted PostgreSQL 16 (Docker container)
- **Location**: OVH VPS (51.195.46.40)
- **Access**: Via PostgREST (port 3001) + Express backend (port 3001)
- **Auth**: JWT tokens (role: anon, iss: self-hosted)

---

## 2. LOCAL SETUP (What You're Running Now)

### Current Local Services
```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR LAPTOP                              │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   FRONTEND     │  │    BACKEND     │  │  Supabase    │  │
│  │  localhost     │  │  localhost     │  │  (CLOUD)     │  │
│  │  :5174         │  │  :3000         │  │              │  │
│  │                │  │                │  │  Different   │  │
│  │  Vite dev      │──┼─►Express API   │──┼─►from VCA    │  │
│  │  server        │  │  (VCA backend) │  │  production  │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│                                                             │
│  ❌ Problem: VCA backend trying to connect to Supabase     │
│     but VCA uses self-hosted PostgreSQL + PostgREST        │
└─────────────────────────────────────────────────────────────┘
```

### What's Configured Locally
**File**: `/projects/ViralContentAnalyzer/app-v2/.env.local`
```env
VITE_POSTGREST_URL=http://localhost:3001
VITE_BACKEND_URL=http://localhost:3000
VITE_POSTGREST_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_CLIENT_ID=635771661878-goov8fvgqmh595pikf858p5tdn0ppl2h.apps.googleusercontent.com
```

**File**: `/projects/ViralContentAnalyzer/backend/.env`
```env
PORT=3000
SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co  ← WRONG!
SUPABASE_SERVICE_ROLE_KEY=...  ← WRONG!
```

### The Mismatch
| What VCA Expects | What Backend Has | Result |
|-----------------|------------------|--------|
| Self-hosted PostgreSQL | Supabase cloud | ❌ Different database |
| PostgREST on port 3001 | Not running locally | ❌ Connection fails |
| PIN-based auth | Supabase auth | ❌ Different auth system |

---

## 3. THE ROOT CAUSE

### Why You See "Database not configured"

1. **VCA backend** (`/backend/`) was designed for **Supabase**
2. **VCA app-v2** was designed for **self-hosted PostgreSQL + PostgREST**
3. **They are incompatible**

The backend you started (`npm run dev` in `/backend/`) is trying to connect to Supabase cloud, but:
- VCA's production database is self-hosted PostgreSQL
- VCA's frontend expects PostgREST API (not Supabase SDK)
- The auth system is PIN-based (not Supabase Auth)

### The Migration History
Looking at your files, it appears:
1. **VCA v1** used Supabase cloud (the `/backend/` folder)
2. **VCA v2** migrated to self-hosted PostgreSQL + PostgREST (docker-compose setup)
3. **The `/backend/` folder is outdated** and points to old Supabase instance

---

## 4. COOLIFY ACCESS INFO

### Coolify Dashboard
- **URL**: http://51.195.46.40:8000
- **API Token**: `1|PBW5ASHnKg5t7Si8aokhpiL9GXU50YQPOrgrDGojfd6b0710`

### Coolify Project URLs
Based on the URL you provided:
- **Project ID**: `dkwo4w0w4wsoco4k04swgog8`
- **Environment ID**: `xo8okkogscso40k4so84g4ow`
- **Application ID**: `zsk4sgk8g0w0c4kcw80ss8os`

**Full URL**:
```
http://51.195.46.40:8000/project/dkwo4w0w4wsoco4k04swgog8/environment/xo8okkogscso40k4so84g4ow/application/zsk4sgk8g0w0c4kcw80ss8os
```

---

## 5. SOLUTIONS (3 Options)

### Option A: Use Production Database (Fastest)
Point your local frontend to the production backend:

**File**: `app-v2/.env.local`
```env
VITE_POSTGREST_URL=https://vca-api.2xg.in/postgrest
VITE_BACKEND_URL=https://vca-api.2xg.in
VITE_POSTGREST_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InNlbGYtaG9zdGVkIiwiaWF0IjoxNzcwNjIyOTY2LCJleHAiOjIwODYxOTg5NjZ9.MlToNcTzEBR0k9NLH3f0dU7RPHvkA_CCMgMwv9pEVxY
VITE_GOOGLE_CLIENT_ID=635771661878-goov8fvgqmh595pikf858p5tdn0ppl2h.apps.googleusercontent.com
```

**Stop the local backend** (not needed):
```bash
# Find and kill the backend process
lsof -i :3000
kill <PID>
```

**Run only frontend**:
```bash
cd app-v2
npm run dev
# Open http://localhost:5174
```

✅ **Pros**: Works immediately, uses real data
❌ **Cons**: Affects production database (be careful!)

---

### Option B: Run Full Stack Locally via Docker
Use the docker-compose setup to run everything locally:

```bash
cd /projects/ViralContentAnalyzer
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- PostgREST on port 3001
- Frontend on port 5174 (if configured)

Then use:
```env
VITE_POSTGREST_URL=http://localhost:3001
VITE_BACKEND_URL=http://localhost:3001
```

✅ **Pros**: Full local environment, safe testing
❌ **Cons**: Requires Docker, slower setup

---

### Option C: Create Development Database
Set up a separate dev database on Supabase for development only.

1. Create new Supabase project (dev instance)
2. Run migrations from `/supabase/migrations/`
3. Update `/backend/.env` with dev credentials
4. Frontend points to localhost:3000

✅ **Pros**: Isolated dev environment
❌ **Cons**: Requires migration setup, separate database to maintain

---

## 6. RECOMMENDED FLOW

### For Testing Bulk Approve & Edit Review Features
**Use Option A** (production backend):

```bash
# 1. Update app-v2/.env.local
VITE_POSTGREST_URL=https://vca-api.2xg.in/postgrest
VITE_BACKEND_URL=https://vca-api.2xg.in

# 2. Stop local backend
kill $(lsof -t -i:3000)

# 3. Run only frontend
cd app-v2
npm run dev

# 4. Test at http://localhost:5174
```

This lets you test the new features immediately with real production data.

---

## 7. BACKEND ARCHITECTURE COMPARISON

### VCA v1 (Old - `/backend/` folder)
```
Frontend → Backend (Express) → Supabase Cloud
         (port 3000)          (REST API + Auth)
```

### VCA v2 (Current - Production)
```
Frontend → PostgREST → PostgreSQL (Docker)
         (port 3001)   (self-hosted)
         ↓
         Backend (Express) → PostgreSQL (Docker)
         (for uploads only)  (direct connection)
```

**Key Difference**: VCA v2 frontend talks **directly to PostgREST**, bypassing Express for most operations. Express is only used for file uploads and complex operations.

---

## 8. NEXT STEPS

1. **Choose a solution** (Option A recommended for quick testing)
2. **Update `.env.local` accordingly**
3. **Test the app** with your credentials
4. **Report back** if database connection works

### Questions to Answer:
1. Do you want to use production database for testing? (Option A)
2. Do you have Docker installed for local full-stack? (Option B)
3. Or should we set up a dev Supabase instance? (Option C)

---

## 9. SSH ACCESS (If Needed)

To check the production deployment, you would need SSH access to the OVH server. Based on the DEVOPS guides, SSH is admin-only. Do you have:
- SSH key for `root@51.195.46.40`?
- If yes, I can help debug production containers
- If no, we can use Coolify API instead

---

*End of Report*
