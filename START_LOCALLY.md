# Start Application Locally

## Prerequisites

Before starting, make sure you have:
- ✅ Node.js installed (v16 or higher)
- ✅ npm or yarn installed
- ✅ Supabase project credentials configured
- ✅ Environment variables set up

---

## Quick Start (Both Frontend & Backend)

### Option 1: Start Everything at Once

Open **TWO terminal windows** in the project root:

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Option 2: Use the Start Script

Create a simple start script to run both:

```bash
# In project root
npm run start:all
```

---

## Step-by-Step Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies (first time only)
npm install

# Create .env file if it doesn't exist
cp .env.example .env

# Edit .env and add your credentials
nano .env
```

**Required Environment Variables (backend/.env):**
```env
# Supabase
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Drive (optional, for final video uploads)
GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID=your-folder-id

# Server
PORT=3001
NODE_ENV=development
```

**Start Backend:**
```bash
npm run dev
```

You should see:
```
✅ Server running on http://localhost:3001
```

**Test Backend:**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok"}
```

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies (first time only)
npm install

# Create .env file if it doesn't exist
cp .env.example .env.local

# Edit .env.local and add your credentials
nano .env.local
```

**Required Environment Variables (frontend/.env.local):**
```env
# Supabase
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Backend API
VITE_BACKEND_URL=http://localhost:3001

# Google OAuth (optional)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_API_KEY=your-google-api-key
```

**Start Frontend:**
```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Open in Browser:**
```bash
open http://localhost:5173
```

---

## Verify Everything is Working

### 1. Check Backend is Running

```bash
# In a new terminal
curl http://localhost:3001/health

# Expected response:
# {"status":"ok"}
```

### 2. Check Frontend is Running

Open browser to: http://localhost:5173

You should see:
- ✅ Login page loads
- ✅ No console errors
- ✅ Supabase connection working

### 3. Test Login

1. Go to http://localhost:5173
2. Click "Sign In"
3. Use your test credentials
4. Should redirect to appropriate dashboard based on role

---

## Common Issues & Solutions

### Issue 1: Port Already in Use

**Backend (Port 3001):**
```bash
# Find process using port 3001
lsof -ti:3001

# Kill the process
kill -9 $(lsof -ti:3001)

# Or use a different port
PORT=3002 npm run dev
```

**Frontend (Port 5173):**
```bash
# Kill process on port 5173
kill -9 $(lsof -ti:5173)

# Or Vite will automatically use next available port
```

### Issue 2: Missing Dependencies

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue 3: Environment Variables Not Loading

**Backend:**
```bash
# Check .env file exists
ls -la backend/.env

# Verify variables are set
cd backend
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

**Frontend:**
```bash
# Check .env.local exists
ls -la frontend/.env.local

# Verify in browser console:
# Open http://localhost:5173
# Press F12 → Console → Type:
# import.meta.env.VITE_SUPABASE_URL
```

### Issue 4: Supabase Connection Failed

**Symptoms:**
- Login fails
- "Invalid API key" error
- Network errors in console

**Solution:**
```bash
# 1. Verify Supabase credentials
# Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

# 2. Check frontend can reach Supabase
# In browser console:
curl https://YOUR_PROJECT.supabase.co/rest/v1/

# 3. Check backend can reach Supabase
cd backend
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('profiles').select('count').then(console.log);
"
```

### Issue 5: CORS Errors

**Symptoms:**
- Frontend can't reach backend
- "CORS policy" errors in console

**Solution:**

Backend should already have CORS enabled in `backend/src/index.js`:
```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
```

If still having issues:
```bash
# Check backend is running on correct port
curl http://localhost:3001/health

# Verify VITE_BACKEND_URL in frontend/.env.local
cat frontend/.env.local | grep VITE_BACKEND_URL
```

---

## Development Workflow

### Hot Reload

Both frontend and backend support hot reload:
- **Frontend:** Vite automatically reloads on file changes
- **Backend:** nodemon restarts server on file changes

### Check Logs

**Backend logs:**
```bash
# Backend terminal shows:
# - API requests
# - Database queries
# - Errors
```

**Frontend logs:**
```bash
# Browser Console (F12):
# - React errors
# - Network requests
# - State updates
```

### Database Changes

After making database changes in Supabase:
```bash
# No restart needed - changes are live immediately
# Just refresh browser to see updates
```

---

## Testing the New Features

### 1. Test Rejection Counter

1. Login as **Admin**
2. Go to **Need Approval**
3. Find a pending script
4. Click "Reject" and provide feedback
5. Check rejection count badge appears
6. Reject same script 4 more times (total 5)
7. Verify project gets dissolved

**Verify in Database:**
```sql
SELECT id, rejection_count, is_dissolved, dissolution_reason
FROM viral_analyses
WHERE rejection_count > 0;
```

### 2. Test Multiple File Uploads

1. Login as **Videographer**
2. Go to assigned project
3. Upload multiple raw footage files
4. Verify all files appear in list
5. Delete one file (soft delete)
6. Submit for review

**Verify in Database:**
```sql
SELECT file_name, file_type, is_deleted, uploaded_at
FROM production_files
WHERE analysis_id = 'YOUR_PROJECT_ID'
ORDER BY uploaded_at DESC;
```

### 3. Test Full Workflow

1. **Script Writer**: Submit script
2. **Admin**: Approve script, assign team
3. **Videographer**: Upload footage, submit for review
4. **Admin**: Approve shoot
5. **Editor**: Upload edited video, submit for review
6. **Admin**: Approve edit
7. **Posting Manager**: Mark as posted

---

## Production Build

### Build Frontend

```bash
cd frontend
npm run build

# Output in: frontend/dist/
# Deploy to: Vercel, Netlify, etc.
```

### Build Backend

```bash
cd backend
npm run build

# Output in: backend/dist/
# Deploy to: Heroku, Railway, OVH VPS, etc.
```

---

## Scripts Reference

### Backend Scripts

```bash
npm run dev          # Start development server with hot reload
npm run start        # Start production server
npm run build        # Build for production
npm run test         # Run tests
```

### Frontend Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

---

## Useful Commands

### Check Running Processes

```bash
# See all Node processes
ps aux | grep node

# See what's using ports
lsof -i :3001  # Backend
lsof -i :5173  # Frontend
```

### Clear Cache & Restart

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install
npm run dev

# Frontend
cd frontend
rm -rf node_modules package-lock.json .vite
npm install
npm run dev
```

### View Logs in Real-Time

```bash
# Backend logs
cd backend
npm run dev | tee backend.log

# Frontend logs (in browser console)
# F12 → Console
```

---

## Environment Variables Checklist

### Backend Required ✅

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `PORT` (default: 3001)
- [ ] `NODE_ENV` (development/production)

### Backend Optional

- [ ] `GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID`

### Frontend Required ✅

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_BACKEND_URL`

### Frontend Optional

- [ ] `VITE_GOOGLE_CLIENT_ID`
- [ ] `VITE_GOOGLE_API_KEY`

---

## Success Indicators

You know everything is working when:

✅ Backend responds to `http://localhost:3001/health`
✅ Frontend loads at `http://localhost:5173`
✅ Login works
✅ Dashboard loads based on user role
✅ No errors in browser console
✅ No errors in backend terminal
✅ Database queries work
✅ File uploads work
✅ Rejection counter increments
✅ Multiple files can be uploaded

---

## Need Help?

### Check Status

```bash
# Backend status
curl http://localhost:3001/health

# Frontend status
curl http://localhost:5173
```

### Debug Mode

**Backend:**
```bash
DEBUG=* npm run dev
```

**Frontend:**
```bash
# In browser console:
localStorage.setItem('debug', '*')
```

### Common Issues Document

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

---

## Quick Reference

| Service | URL | Port |
|---------|-----|------|
| Frontend | http://localhost:5173 | 5173 |
| Backend API | http://localhost:3001 | 3001 |
| Supabase | Your project URL | - |

**Ready to start!** 🚀

Just run:
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Then open: http://localhost:5173
