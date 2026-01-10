# Backend Setup Guide - Admin User Management

This guide explains how to set up the backend server to enable admin user management functionality in the Settings page.

## Why Do We Need a Backend?

The Settings page allows admins to create and delete team members. These operations require **Supabase Service Role Key** privileges, which cannot be safely exposed in the frontend browser code. The backend server acts as a secure intermediary.

## Quick Setup (5 minutes)

### Step 1: Get Your Supabase Service Role Key

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the **service_role** key (NOT the anon key)
5. ⚠️ Keep this key secret!

### Step 2: Configure Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
PORT=3001
SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=paste-your-service-role-key-here
FRONTEND_URL=http://localhost:5174
EOF
```

### Step 3: Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev
```

You should see:
```
🚀 Backend server running on http://localhost:3001
📊 Health check: http://localhost:3001/health
```

### Step 4: Start Frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

### Step 5: Test It!

1. Open `http://localhost:5174/settings` in your browser
2. Log in as SUPER_ADMIN
3. Click "Add Team Member"
4. Fill in the form and submit
5. ✅ User should be created successfully!

## How It Works

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend  │────────▶│   Backend   │────────▶│   Supabase  │
│  (Browser)  │  HTTP   │  (Node.js)  │  Admin  │   Database  │
│             │◀────────│             │◀────────│             │
└─────────────┘         └─────────────┘         └─────────────┘
     ↓                        ↓                        ↓
 anon key            service_role key          Full Access
(Limited)            (Admin Powers)
```

1. **Frontend** sends request with user's JWT token
2. **Backend** verifies user is SUPER_ADMIN
3. **Backend** uses service role key to create/delete users
4. **Supabase** performs the operation
5. **Backend** returns success/error to frontend

## Production Deployment (Coolify + OVH Cloud)

When you migrate to Coolify:

### 1. Backend Deployment

Create a new service in Coolify:

**Service Type:** Node.js Application

**Environment Variables:**
```
PORT=3001
SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://your-frontend-domain.com
```

**Build Command:** `npm install`

**Start Command:** `npm start`

**Port:** `3001`

### 2. Frontend Configuration

Update frontend `.env`:
```env
VITE_BACKEND_URL=https://api.your-domain.com
```

### 3. Domain Setup

Point a subdomain to your backend:
- `api.your-domain.com` → Backend service
- `app.your-domain.com` → Frontend service

## Troubleshooting

### ❌ "This endpoint requires a valid Bearer token"

**Problem:** Backend is not running or frontend can't connect

**Solution:**
1. Check backend is running: `curl http://localhost:3001/health`
2. Verify `VITE_BACKEND_URL` in frontend `.env`
3. Check browser console for CORS errors

### ❌ "Unauthorized - Admin access required"

**Problem:** Your user is not SUPER_ADMIN

**Solution:**
1. Go to Supabase Dashboard
2. Navigate to **Table Editor** → **profiles**
3. Find your user
4. Set `role` column to `SUPER_ADMIN`

### ❌ "Failed to create user"

**Problem:** Service role key is incorrect

**Solution:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` in backend `.env`
2. Make sure you copied the **service_role** key, not **anon** key
3. Restart backend server after changing `.env`

### ❌ CORS Error in Browser Console

**Problem:** Frontend URL not in CORS allowlist

**Solution:**
1. Check `FRONTEND_URL` in backend `.env`
2. Make sure it matches your frontend URL exactly
3. No trailing slashes!

## Current vs Future Architecture

### Current (Supabase)
```
Frontend → Supabase (managed auth & database)
Backend → Supabase (admin operations)
```

### Future (Coolify + OVH Cloud)
```
Frontend → Your Backend API
Backend → Your Database (PostgreSQL)
Backend → Your Auth Service
```

**Good News:** This backend structure is ready for migration! When you move to Coolify, you'll just need to:
1. Replace Supabase client with your own database client
2. Implement your own JWT auth instead of Supabase auth
3. The Express.js server and API structure stays the same

## Security Best Practices

✅ **DO:**
- Keep service role key in backend `.env` only
- Use environment variables for all secrets
- Verify admin role before operations
- Use HTTPS in production
- Set correct CORS origins

❌ **DON'T:**
- Put service role key in frontend code
- Commit `.env` files to git
- Allow public access to admin endpoints
- Skip JWT verification

## Next Steps

1. ✅ Backend running locally
2. ✅ Admin can create users
3. ✅ Admin can delete users
4. 🔜 Deploy to Coolify
5. 🔜 Migrate from Supabase to self-hosted

## Need Help?

Check the logs:
```bash
# Backend logs
cd backend && npm run dev

# Check if backend is accessible
curl http://localhost:3001/health

# Test with your JWT token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/admin/users
```
