-- ============================================
-- VIRAL CONTENT ANALYZER - SUPABASE SETUP
-- ============================================
-- Copy and paste this entire file into Supabase SQL Editor
-- Run it all at once

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'SCRIPT_WRITER',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Viral analyses table
CREATE TABLE IF NOT EXISTS viral_analyses (
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
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_viral_analyses_user_id ON viral_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_viral_analyses_created_at ON viral_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_analyses_status ON viral_analyses(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own analyses" ON viral_analyses;
DROP POLICY IF EXISTS "Users can create own analyses" ON viral_analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON viral_analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON viral_analyses;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Viral analyses policies
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

-- ============================================
-- STORAGE
-- ============================================

-- Create storage bucket for voice notes (run separately if this fails)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('voice-notes', 'voice-notes', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage RLS policies
DROP POLICY IF EXISTS "Users can upload own voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Users can access own voice notes" ON storage.objects;

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

CREATE POLICY "Users can update own voice notes"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'voice-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own voice notes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'voice-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'SCRIPT_WRITER'
  );
  RETURN new;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON viral_analyses;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON viral_analyses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- HELPFUL VIEWS (OPTIONAL)
-- ============================================

-- View to get analyses with user info
CREATE OR REPLACE VIEW viral_analyses_with_users AS
SELECT
  va.*,
  p.email,
  p.full_name,
  p.avatar_url
FROM viral_analyses va
JOIN profiles p ON va.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON viral_analyses_with_users TO authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after the above to verify everything worked:

-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'viral_analyses');

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'viral_analyses');

-- Check storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'voice-notes';

-- ============================================
-- SUCCESS!
-- ============================================
-- If you see no errors above, your database is ready!
-- Next steps:
-- 1. Go to Authentication > Providers and enable Email
-- 2. Set up your frontend .env with Supabase URL and anon key
-- 3. Start building!
