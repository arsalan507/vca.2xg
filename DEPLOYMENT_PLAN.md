# Viral Content Analyzer - Deployment Plan

## Project Overview
Standalone viral content analysis tool for script writers, with Supabase backend and production deployment.

---

## Phase 1: Supabase Setup

### 1.1 Create Supabase Project
- [ ] Go to https://supabase.com
- [ ] Create new project: "viral-content-analyzer"
- [ ] Note down:
  - Project URL
  - API Key (anon/public)
  - Service Role Key (for admin operations)

### 1.2 Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth)
-- Already created by Supabase

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'SCRIPT_WRITER',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Viral analyses table
CREATE TABLE viral_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Core fields
  reference_url TEXT NOT NULL,
  hook TEXT,
  hook_voice_note_url TEXT,
  why_viral TEXT,
  why_viral_voice_note_url TEXT,
  how_to_replicate TEXT,
  how_to_replicate_voice_note_url TEXT,
  target_emotion TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,

  -- Metadata
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for viral_analyses
CREATE POLICY "Users can view own analyses"
  ON viral_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own analyses"
  ON viral_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON viral_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON viral_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', false);

-- Storage RLS policy
CREATE POLICY "Users can upload own voice notes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can access own voice notes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 1.3 Supabase Auth Configuration
- [ ] Enable Email/Password authentication
- [ ] Disable demo accounts
- [ ] Configure email templates
- [ ] Set up email confirmation (optional)

---

## Phase 2: Frontend Setup

### 2.1 Install Dependencies
```bash
cd frontend
npm install
npm install @supabase/supabase-js
npm install @tanstack/react-query
npm install react-router-dom
npm install react-hot-toast
npm install @heroicons/react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2.2 Environment Variables
Create `frontend/.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2.3 Copy Components
- [ ] Copy `VoiceRecorder.tsx`
- [ ] Copy `IdeasPage.tsx` (rename to `AnalysesPage.tsx`)
- [ ] Copy login/register pages
- [ ] Copy auth store (adapt for Supabase)

---

## Phase 3: Supabase Client Setup

### 3.1 Create Supabase Client
`src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: string
          avatar_url?: string | null
        }
        Update: {
          email?: string
          full_name?: string | null
          role?: string
          avatar_url?: string | null
        }
      }
      viral_analyses: {
        Row: {
          id: string
          user_id: string
          reference_url: string
          hook: string | null
          hook_voice_note_url: string | null
          why_viral: string | null
          why_viral_voice_note_url: string | null
          how_to_replicate: string | null
          how_to_replicate_voice_note_url: string | null
          target_emotion: string
          expected_outcome: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          reference_url: string
          hook?: string | null
          hook_voice_note_url?: string | null
          why_viral?: string | null
          why_viral_voice_note_url?: string | null
          how_to_replicate?: string | null
          how_to_replicate_voice_note_url?: string | null
          target_emotion: string
          expected_outcome: string
        }
        Update: {
          reference_url?: string
          hook?: string | null
          hook_voice_note_url?: string | null
          why_viral?: string | null
          why_viral_voice_note_url?: string | null
          how_to_replicate?: string | null
          how_to_replicate_voice_note_url?: string | null
          target_emotion?: string
          expected_outcome?: string
          status?: string
        }
      }
    }
  }
}
```

### 3.2 Create API Service
`src/services/api.ts`:
```typescript
import { supabase } from '@/lib/supabase'

export const authApi = {
  signUp: async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    if (error) throw error
    return data
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },
}

export const analysesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  create: async (analysis: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('viral_analyses')
      .insert({ ...analysis, user_id: user.id })
      .select()
      .single()

    if (error) throw error
    return data
  },

  update: async (id: string, analysis: any) => {
    const { data, error } = await supabase
      .from('viral_analyses')
      .update(analysis)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('viral_analyses')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  uploadVoiceNote: async (file: Blob, userId: string, filename: string) => {
    const filePath = `${userId}/${Date.now()}-${filename}.webm`

    const { data, error } = await supabase.storage
      .from('voice-notes')
      .upload(filePath, file, {
        contentType: 'audio/webm',
      })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('voice-notes')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  },
}
```

---

## Phase 4: Remove Demo Accounts

### 4.1 Update Login Page
- [ ] Remove demo account buttons
- [ ] Remove demo credentials section
- [ ] Clean up UI for production

### 4.2 Update Registration
- [ ] Add email validation
- [ ] Add password strength requirements
- [ ] Add terms & conditions checkbox

---

## Phase 5: Deployment

### 5.1 Frontend Deployment (Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Set environment variables in Vercel dashboard:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

### 5.2 Domain Setup
- [ ] Configure custom domain (optional)
- [ ] Add to Supabase allowed URLs
- [ ] Update CORS settings

### 5.3 Production Checklist
- [ ] Test authentication flow
- [ ] Test voice note upload
- [ ] Test analysis CRUD operations
- [ ] Test on mobile devices
- [ ] Check performance
- [ ] Enable analytics
- [ ] Set up error monitoring (Sentry)

---

## Phase 6: Future Integration with Video Hub

### 6.1 API Integration Points
```typescript
// Export analysis to Video Hub
export const exportToVideoHub = async (analysisId: string, videoHubApiUrl: string) => {
  const analysis = await analysesApi.getOne(analysisId)

  // Send to Video Hub API
  const response = await fetch(`${videoHubApiUrl}/api/ideas/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${videoHubToken}`,
    },
    body: JSON.stringify({
      referenceUrl: analysis.reference_url,
      title: analysis.hook,
      description: analysis.why_viral,
      targetAudience: analysis.target_emotion,
      // ... other mappings
    }),
  })

  return response.json()
}
```

### 6.2 SSO Integration
- [ ] Share authentication between tools
- [ ] Use same Supabase project OR
- [ ] Implement OAuth between services

### 6.3 Data Sync
- [ ] Webhook for new analyses
- [ ] Periodic sync job
- [ ] Manual export button

---

## Cost Estimation

### Supabase (Free Tier)
- Database: 500MB
- Storage: 1GB
- Bandwidth: 2GB
- Auth users: Unlimited

### Vercel (Hobby)
- Hosting: Free
- Bandwidth: 100GB
- Builds: Unlimited

**Total Monthly Cost: $0** (within free tiers)

**Upgrade needed when:**
- Database > 500MB (~5,000 analyses)
- Storage > 1GB (~1,000 voice notes)
- Users > 50,000 MAU

---

## Environment Variables Checklist

### Frontend (.env)
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Vercel (Production)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Post-Launch Tasks

- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Create user documentation
- [ ] Set up feedback collection
- [ ] Plan feature roadmap
- [ ] Set up CI/CD pipeline
- [ ] Create backup strategy

---

## Support & Maintenance

### Weekly
- [ ] Check error logs
- [ ] Monitor usage metrics
- [ ] Review user feedback

### Monthly
- [ ] Database cleanup
- [ ] Performance review
- [ ] Security audit
- [ ] Cost review

---

## Next Steps

1. **Create Supabase project** - Start here
2. **Run database migration** - Copy SQL from Phase 1.2
3. **Set up frontend** - Follow Phase 2
4. **Test locally** - Verify everything works
5. **Deploy to Vercel** - Go live!

---

**Estimated Time:** 4-6 hours for complete setup and deployment
**Difficulty:** Medium
**Prerequisites:** Supabase account, Vercel account, basic SQL knowledge
