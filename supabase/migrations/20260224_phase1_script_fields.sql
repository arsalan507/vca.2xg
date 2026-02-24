-- ============================================================
-- Phase 1: Script Fields + BCH Profiles
-- Date: 2026-02-24
-- ============================================================
-- Adds script_body and script_cta to viral_analyses
-- Inserts 8 BCH Instagram profiles into profile_list
-- ============================================================

-- 1. Script body (step-by-step shooting instructions)
ALTER TABLE viral_analyses
  ADD COLUMN IF NOT EXISTS script_body TEXT;

-- 2. CTA text (call to action at end of video)
ALTER TABLE viral_analyses
  ADD COLUMN IF NOT EXISTS script_cta TEXT;

COMMENT ON COLUMN viral_analyses.script_body IS 'Step-by-step script / body content for the video';
COMMENT ON COLUMN viral_analyses.script_cta  IS 'Call-to-action text shown at the end of the video';

-- ============================================================
-- 8 BCH Instagram Profiles
-- Rename / adjust follower counts as needed in the app.
-- ============================================================
INSERT INTO profile_list (name, code, platform, is_active)
VALUES
  ('BCH Main',     'BCH1', 'INSTAGRAM', true),
  ('BCH Growth',   'BCH2', 'INSTAGRAM', true),
  ('BCH Stories',  'BCH3', 'INSTAGRAM', true),
  ('BCH Kannada',  'BCH4', 'INSTAGRAM', true),
  ('BCH Tamil',    'BCH5', 'INSTAGRAM', true),
  ('BCH Youth',    'BCH6', 'INSTAGRAM', true),
  ('BCH Finance',  'BCH7', 'INSTAGRAM', true),
  ('BCH Reels',    'BCH8', 'INSTAGRAM', true)
ON CONFLICT DO NOTHING;

-- Verify
SELECT id, name, code, platform FROM profile_list WHERE code LIKE 'BCH%' ORDER BY code;
