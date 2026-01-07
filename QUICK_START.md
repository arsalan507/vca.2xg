# Quick Start Guide - Viral Content Analyzer

## 🚀 Get Started in 30 Minutes

### Step 1: Create Supabase Project (5 min)

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in:
   - Name: `viral-content-analyzer`
   - Database Password: (generate strong password)
   - Region: Choose closest to your users
4. Wait for project to be ready (~2 minutes)
5. **Save these values:**
   - Project URL: `https://xxxxx.supabase.co`
   - API Key (anon public): Found in Settings → API

### Step 2: Set Up Database (5 min)

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire SQL from `DEPLOYMENT_PLAN.md` Phase 1.2
4. Click **Run** button
5. Verify tables created:
   - Go to **Table Editor**
   - You should see: `profiles`, `viral_analyses`

### Step 3: Configure Auth (2 min)

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. **Disable** these features (we don't need them):
   - Email confirmation (optional - enable for production)
   - Magic links
4. Go to **Authentication** → **URL Configuration**
5. Add your site URL: `http://localhost:5173` (development)

### Step 4: Frontend Setup (10 min)

```bash
# Navigate to project
cd ~/Desktop/ViralContentAnalyzer/frontend

# Install dependencies
npm install

# Install required packages
npm install @supabase/supabase-js @tanstack/react-query react-router-dom react-hot-toast @heroicons/react

# Install dev dependencies
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Create .env file
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
EOF

# Edit .env and add your real values
nano .env
```

### Step 5: Copy Components from Video Hub (5 min)

```bash
# Create directories
mkdir -p src/components
mkdir -p src/pages
mkdir -p src/lib
mkdir -p src/services

# Copy these files from Video Hub:
# From: /Users/arsalan/Desktop/Slack/frontend/web/src/

# Copy VoiceRecorder component
cp ~/Desktop/Slack/frontend/web/src/components/VoiceRecorder.tsx src/components/

# Copy pages (we'll adapt these)
cp ~/Desktop/Slack/frontend/web/src/pages/IdeasPage.tsx src/pages/AnalysesPage.tsx
cp ~/Desktop/Slack/frontend/web/src/pages/LoginPage.tsx src/pages/
# Note: You'll need to update these to use Supabase
```

### Step 6: Create Supabase Client (3 min)

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 7: Test Locally (2 min)

```bash
npm run dev
```

Visit http://localhost:5173

---

## 🎯 What You Should See

1. **Login Page** - Clean, no demo accounts
2. **Register** - Can create new account
3. **Analyses Page** - Can submit viral content analysis
4. **Voice Recording** - Can record voice notes
5. **List View** - See all your analyses

---

## 🔧 Troubleshooting

### Error: "Invalid API key"
- Double check `.env` file has correct values
- Restart dev server after changing `.env`

### Error: "Network error"
- Check Supabase project is running (green dot in dashboard)
- Verify URL configuration in Supabase Auth settings

### Voice recording not working
- Allow microphone permission in browser
- Use HTTPS in production (required for microphone)

---

## 📦 Deploy to Production

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: viral-content-analyzer
# - Framework preset: Vite
# - Build command: npm run build
# - Output directory: dist

# Set environment variables in Vercel dashboard:
# VITE_SUPABASE_URL = your_supabase_url
# VITE_SUPABASE_ANON_KEY = your_anon_key

# Redeploy
vercel --prod
```

### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod

# Set build command: npm run build
# Set publish directory: dist
```

---

## ✅ Production Checklist

Before going live:

- [ ] Enable email confirmation in Supabase Auth
- [ ] Set up custom domain
- [ ] Add domain to Supabase allowed URLs
- [ ] Remove all console.logs
- [ ] Test on mobile devices
- [ ] Set up error monitoring (Sentry)
- [ ] Configure analytics (PostHog, Google Analytics)
- [ ] Add privacy policy page
- [ ] Add terms of service page
- [ ] Test voice recording on HTTPS
- [ ] Set up backup strategy for database

---

## 🔗 Useful Links

- Supabase Dashboard: https://app.supabase.com
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Docs: https://supabase.com/docs
- React Query Docs: https://tanstack.com/query/latest

---

## 💡 Pro Tips

1. **Use Supabase CLI** for database migrations:
   ```bash
   npm i -g supabase
   supabase login
   supabase db pull
   ```

2. **Enable RLS (Row Level Security)** - Already done in our SQL!
   This ensures users can only see their own data.

3. **Use Supabase Storage** for voice notes instead of base64:
   - More efficient
   - Better performance
   - Automatic CDN

4. **Set up webhooks** for real-time sync with Video Hub later.

5. **Use Supabase Edge Functions** if you need server-side logic.

---

## 🤝 Integration with Video Hub

Later, when you want to integrate with Video Hub:

1. **Option A: Shared Database**
   - Point both apps to same Supabase project
   - Share authentication
   - Sync data automatically

2. **Option B: API Integration**
   - Export button in Viral Analyzer
   - Calls Video Hub API to create idea
   - Maps fields appropriately

3. **Option C: Separate Tools**
   - Keep them independent
   - Use OAuth for SSO
   - Manual data export/import

---

## 📱 Next Features (Future)

- [ ] AI-powered analysis suggestions
- [ ] Viral pattern detection
- [ ] Team collaboration
- [ ] Analytics dashboard
- [ ] Export to PDF/CSV
- [ ] Email notifications
- [ ] Mobile app (React Native)

---

**Need Help?** Check `DEPLOYMENT_PLAN.md` for detailed instructions!
