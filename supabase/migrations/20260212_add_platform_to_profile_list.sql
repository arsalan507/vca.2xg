-- Add platform column to profile_list
-- Allows posting managers to know which social media platform a profile belongs to

ALTER TABLE public.profile_list
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'INSTAGRAM';

-- Valid values: INSTAGRAM, YOUTUBE, TIKTOK, FACEBOOK, TWITTER, OTHER
-- Using TEXT (not enum) for flexibility - validated in application layer

COMMENT ON COLUMN public.profile_list.platform IS 'Social media platform: INSTAGRAM, YOUTUBE, TIKTOK, FACEBOOK, TWITTER, OTHER';
