# Vercel Deployment Guide

## Quick Deploy to Vercel

### Step 1: Commit and Push Your Changes

```bash
# Add all files
git add .

# Commit changes
git commit -m "Add backend API for admin user management and prepare for Vercel deployment"

# Push to GitHub
git push origin main
```

### Step 2: Configure Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/kineticxhubs-projects/frontend)
2. Click on your project
3. Go to **Settings** → **General**
4. Update these settings:

**Framework Preset:** Vite

**Build & Development Settings:**
- **Build Command:** `cd frontend && npm install && npm run build`
- **Output Directory:** `frontend/dist`
- **Install Command:** `cd frontend && npm install`

### Step 3: Set Environment Variables

Go to **Settings** → **Environment Variables** and add:

```env
VITE_SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_WS6oi184H9_qdaC0iCjF6A_UEC1gPyi
VITE_BACKEND_URL=YOUR_BACKEND_URL_HERE
VITE_GOOGLE_API_KEY=your_google_api_key_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
```

**Important:**
- For `VITE_BACKEND_URL`, you need to deploy the backend first (see Backend Deployment below)
- For now, you can set it to `http://localhost:3001` but the admin features won't work in production until backend is deployed

### Step 4: Deploy

Option A: **Automatic Deployment**
- Push to `main` branch → Vercel auto-deploys
- Your site will be live at: `https://your-project.vercel.app`

Option B: **Manual Deployment**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## Backend Deployment (Required for Admin Features)

The admin user management features require the backend to be deployed. Here are your options:

### Option 1: Deploy Backend to Railway (Easiest)

1. Go to [Railway.app](https://railway.app)
2. Create new project
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Set **Root Directory:** `backend`
6. Add environment variables:
   ```
   PORT=3001
   SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```
7. Deploy!
8. Copy the Railway URL (e.g., `https://your-backend.railway.app`)
9. Update `VITE_BACKEND_URL` in Vercel environment variables

### Option 2: Deploy Backend to Render

1. Go to [Render.com](https://render.com)
2. Create new "Web Service"
3. Connect your GitHub repository
4. Set **Root Directory:** `backend`
5. **Build Command:** `npm install`
6. **Start Command:** `npm start`
7. Add environment variables (same as Railway)
8. Deploy and get the URL

### Option 3: Deploy Backend to Coolify (Your Plan)

When you're ready:
1. Set up Coolify on OVH Cloud
2. Deploy backend as Node.js service
3. Update `VITE_BACKEND_URL` in Vercel

## Deployment Checklist

### Frontend (Vercel)
- [x] vercel.json created
- [x] .env.production created
- [ ] Environment variables set in Vercel dashboard
- [ ] Code pushed to GitHub
- [ ] Deployment triggered
- [ ] Site loads successfully
- [ ] Authentication works
- [ ] Google Drive integration configured

### Backend (Railway/Render/Coolify)
- [ ] Backend deployed to hosting provider
- [ ] Environment variables configured
- [ ] Health check endpoint works
- [ ] CORS configured for Vercel domain
- [ ] VITE_BACKEND_URL updated in Vercel
- [ ] Admin user management tested

## Testing Your Deployment

### Test Frontend
```bash
# Visit your Vercel URL
open https://your-project.vercel.app

# Test authentication
# - Sign up / Sign in should work
# - Dashboard should load

# Test basic features (without backend)
# - Create analysis
# - View analyses
# - Profile updates
```

### Test Backend (After Backend Deployment)
```bash
# Health check
curl https://your-backend-url.com/health

# Test admin endpoint (with your JWT token)
curl -H "Authorization: Bearer YOUR_JWT" \
  https://your-backend-url.com/api/admin/users
```

### Test Admin Features
1. Log in as SUPER_ADMIN
2. Go to Settings page
3. Try to add a team member
4. ✅ Should work if backend is deployed
5. ❌ Will show error if backend not deployed yet

## Current Deployment URLs

**Frontend (Vercel):**
- Production: https://vercel.com/kineticxhubs-projects/frontend
- Update this after deployment

**Backend:**
- Not yet deployed
- Options: Railway, Render, or Coolify
- Update `VITE_BACKEND_URL` after deployment

## Troubleshooting

### Build Fails on Vercel

**Error:** `Cannot find module '@/...'`

**Fix:**
1. Check `tsconfig.json` has correct path aliases
2. Ensure `vite.config.ts` has resolve aliases configured

**Error:** `Build failed - dist directory not found`

**Fix:**
1. Verify build command: `cd frontend && npm run build`
2. Verify output directory: `frontend/dist`

### Environment Variables Not Working

**Problem:** App can't connect to Supabase

**Fix:**
1. Make sure all env vars start with `VITE_`
2. Redeploy after adding env vars
3. Check browser console for values

### Admin Features Don't Work

**Problem:** "Failed to create user" or CORS errors

**Fix:**
1. Backend must be deployed first
2. Update `VITE_BACKEND_URL` in Vercel
3. Ensure backend `FRONTEND_URL` matches Vercel domain
4. Redeploy frontend after updating env vars

### CORS Errors

**Problem:** Browser shows CORS error when calling backend

**Fix:**
Backend `.env` needs:
```env
FRONTEND_URL=https://your-exact-vercel-domain.vercel.app
```
No trailing slash! Must match exactly.

## Performance Optimization

### Enable Caching
Vercel automatically caches static assets. Your Vite build is optimized.

### Enable Analytics
1. Go to Vercel Dashboard → Analytics
2. Enable Web Analytics
3. Monitor performance

### Custom Domain (Optional)
1. Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records
4. Update `FRONTEND_URL` in backend

## Monitoring

### Vercel Logs
- Deployment logs: Vercel Dashboard → Deployments
- Runtime logs: Vercel Dashboard → Logs

### Backend Logs
- Railway: Dashboard → Logs
- Render: Dashboard → Logs
- Coolify: Will have own logging

## Rollback Plan

If something goes wrong:

1. **Vercel:** Go to Deployments → Click previous deployment → Promote to Production
2. **Environment Variables:** Can update anytime, triggers new deployment
3. **Code:** Revert git commit and push

## Next Steps After Deployment

1. ✅ Frontend deployed to Vercel
2. 🔄 Deploy backend (Railway/Render/Coolify)
3. ✅ Update `VITE_BACKEND_URL` in Vercel
4. ✅ Test all features
5. 🔄 Set up custom domain (optional)
6. 🔄 Enable monitoring and analytics
7. 🔄 Eventually migrate to Coolify + OVH Cloud

## Cost Estimate

**Vercel (Frontend):**
- Free tier: Perfect for this app
- Bandwidth: 100GB/month free
- Builds: Unlimited

**Railway (Backend):**
- Free tier: $5 credit/month
- Paid: ~$5-10/month for small app

**Render (Backend):**
- Free tier: Available (with limitations)
- Paid: $7/month for 512MB RAM

**Coolify (Your Future Plan):**
- OVH Cloud VPS: ~$10-20/month
- Full control, no platform fees

## Support

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs

## Important Notes

⚠️ **Backend Required for:**
- Creating team members
- Deleting team members

✅ **Works Without Backend:**
- User authentication
- Creating analyses
- Viewing analyses
- Updating roles (uses Supabase directly)
- All other features

You can deploy the frontend first and add backend later when ready!
