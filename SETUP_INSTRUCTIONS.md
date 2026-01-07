# 🚀 Viral Content Analyzer - Setup Instructions

This guide will help you set up and deploy the Viral Content Analyzer in **30 minutes**.

## 📋 Prerequisites

- Supabase account (free tier)
- Node.js 18+ installed
- Git installed

---

## Step 1: Create Supabase Project (5 minutes)

1. **Sign up/Login to Supabase**
   - Go to [https://supabase.com](https://supabase.com)
   - Click "Start your project"
   - Create a new organization (if needed)

2. **Create New Project**
   - Click "New Project"
   - Project Name: `viral-content-analyzer`
   - Database Password: Create a strong password (save it!)
   - Region: Choose closest to your users
   - Click "Create new project"
   - Wait 2-3 minutes for project to provision

3. **Save Your Credentials**
   - Go to Project Settings → API
   - Copy these values:
     - **Project URL**: `https://xxxxx.supabase.co`
     - **Anon/Public Key**: `eyJhbGc...` (long string)

---

## Step 2: Set Up Database (3 minutes)

1. **Open SQL Editor**
   - In Supabase dashboard, go to "SQL Editor"
   - Click "New query"

2. **Run Database Migration**
   - Open the file `supabase-setup.sql` in this project
   - Copy ALL contents (Cmd+A, Cmd+C)
   - Paste into SQL Editor
   - Click "Run" button
   - You should see: "Success. No rows returned"

3. **Verify Setup**
   - Go to "Table Editor" in sidebar
   - You should see:
     - ✅ `profiles` table
     - ✅ `viral_analyses` table
   - Go to "Storage" in sidebar
   - You should see:
     - ✅ `voice-notes` bucket

---

## Step 3: Configure Frontend (5 minutes)

1. **Navigate to Frontend Directory**
   ```bash
   cd /Users/arsalan/Desktop/ViralContentAnalyzer/frontend
   ```

2. **Update Environment Variables**
   - Open `frontend/.env` file
   - Replace the placeholder values with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key_here
   ```

3. **Install Dependencies** (already done)
   ```bash
   npm install
   ```

---

## Step 4: Test Locally (5 minutes)

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Open in Browser**
   - Go to [http://localhost:5173](http://localhost:5173)
   - You should see the login page

3. **Test Registration**
   - Click "Sign up"
   - Enter your email and password
   - Click "Create Account"
   - Check your email for verification (if enabled)

4. **Test Login**
   - Go back to login page
   - Enter your credentials
   - Click "Sign In"
   - You should see the Analyses dashboard

5. **Test Voice Recording**
   - Click "New Analysis"
   - Fill in the reference URL
   - Click "Start Recording" in the Hook section
   - Allow microphone access
   - Record a few seconds
   - Click "Stop Recording"
   - Click play to verify
   - Fill in required fields (Target Emotion, Expected Outcome)
   - Click "Submit Analysis"
   - You should see success toast

---

## Step 5: Deploy to Vercel (10 minutes)

### Option A: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not installed)
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd /Users/arsalan/Desktop/ViralContentAnalyzer/frontend
   vercel
   ```
   - Follow prompts:
     - Set up and deploy? **Y**
     - Which scope? Select your account
     - Link to existing project? **N**
     - Project name? `viral-content-analyzer`
     - Directory? `./` (default)
     - Override settings? **N**

4. **Set Environment Variables**
   ```bash
   vercel env add VITE_SUPABASE_URL
   ```
   Paste your Supabase URL, press Enter

   ```bash
   vercel env add VITE_SUPABASE_ANON_KEY
   ```
   Paste your Supabase Anon Key, press Enter

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

6. **Done!** 🎉
   - Your app is live at: `https://viral-content-analyzer.vercel.app`
   - Copy the URL provided

### Option B: Deploy via Vercel Dashboard

1. **Go to Vercel Dashboard**
   - Visit [https://vercel.com](https://vercel.com)
   - Click "Add New" → "Project"

2. **Import Repository**
   - Connect your Git provider (GitHub, GitLab, Bitbucket)
   - Select your repository
   - Root Directory: `frontend`
   - Framework Preset: Vite
   - Click "Deploy"

3. **Add Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add:
     - Name: `VITE_SUPABASE_URL`
     - Value: Your Supabase URL
     - Click "Save"
   - Add:
     - Name: `VITE_SUPABASE_ANON_KEY`
     - Value: Your Supabase Anon Key
     - Click "Save"

4. **Redeploy**
   - Go to Deployments tab
   - Click "Redeploy" on latest deployment

---

## Step 6: Configure Supabase for Production (2 minutes)

1. **Add Production URL to Supabase**
   - Go to Supabase Dashboard
   - Project Settings → Authentication → URL Configuration
   - Add your Vercel URL to "Site URL": `https://viral-content-analyzer.vercel.app`
   - Add to "Redirect URLs": `https://viral-content-analyzer.vercel.app/**`
   - Click "Save"

2. **Test Production**
   - Visit your Vercel URL
   - Create an account
   - Test creating an analysis
   - Test voice recording

---

## 🎉 You're Live!

Your Viral Content Analyzer is now deployed and ready to use!

### Next Steps

1. **Share with Script Writers**
   - Send them the production URL
   - They can register and start analyzing viral content

2. **Monitor Usage**
   - Supabase Dashboard → Database → Check row counts
   - Storage → Monitor voice note uploads

3. **Optional: Custom Domain**
   - Vercel: Project Settings → Domains → Add domain
   - Follow instructions to configure DNS

---

## 📊 What You've Built

✅ Full-stack viral content analysis tool
✅ User authentication (email/password)
✅ Voice note recording and storage
✅ Secure database with Row Level Security
✅ Production-ready deployment
✅ Global CDN delivery
✅ HTTPS by default

**Monthly Cost:** $0 (free tier)
**Capacity:** ~5,000 analyses with voice notes

---

## 🔧 Troubleshooting

### Issue: "Missing Supabase environment variables"
**Solution:** Make sure you've set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your `.env` file

### Issue: "Could not access microphone"
**Solution:**
- Make sure you're on HTTPS (localhost is okay)
- Check browser permissions for microphone
- Try in Chrome/Firefox (best support)

### Issue: "Failed to submit analysis"
**Solution:**
- Check browser console for errors
- Verify Supabase credentials are correct
- Check Supabase logs in dashboard

### Issue: Voice notes not uploading
**Solution:**
- Check Supabase Storage bucket exists
- Verify RLS policies are enabled
- Check file size (max 50MB)

---

## 📞 Support

If you need help:
1. Check Supabase logs: Dashboard → Logs
2. Check browser console: Right-click → Inspect → Console
3. Review `DEPLOYMENT_PLAN.md` for advanced configuration

---

**Built with:**
- React + TypeScript + Vite
- Supabase (Database + Auth + Storage)
- Tailwind CSS
- React Query
- Deployed on Vercel

**Time to Deploy:** 30 minutes
**Monthly Cost:** $0 (free tier)
**Ready for:** Production use
