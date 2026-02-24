-- Drop unused columns from viral_analyses
-- These columns were part of analysis levels 2/3 and production planning features
-- that were never implemented in the frontend UI.

BEGIN;

-- 1. Drop dependent views first
DROP VIEW IF EXISTS active_projects;
DROP VIEW IF EXISTS viral_analyses_with_users;

-- 2. Drop unused columns
ALTER TABLE viral_analyses
  DROP COLUMN IF EXISTS how_to_replicate,
  DROP COLUMN IF EXISTS how_to_replicate_voice_note_url,
  DROP COLUMN IF EXISTS works_without_audio,
  DROP COLUMN IF EXISTS content_rating,
  DROP COLUMN IF EXISTS replication_strength,
  DROP COLUMN IF EXISTS characters_involved,
  DROP COLUMN IF EXISTS unusual_element,
  -- Level 2: Emotional & Physical Reactions
  DROP COLUMN IF EXISTS body_reactions,
  DROP COLUMN IF EXISTS emotion_first_6_sec,
  DROP COLUMN IF EXISTS challenged_belief,
  DROP COLUMN IF EXISTS emotional_identity_impact,
  DROP COLUMN IF EXISTS if_he_can_why_cant_you,
  DROP COLUMN IF EXISTS feel_like_commenting,
  DROP COLUMN IF EXISTS read_comments,
  DROP COLUMN IF EXISTS sharing_number,
  DROP COLUMN IF EXISTS video_action,
  DROP COLUMN IF EXISTS total_people_involved,
  DROP COLUMN IF EXISTS shoot_possibility,
  -- Level 3: Hook Study
  DROP COLUMN IF EXISTS stop_feel,
  DROP COLUMN IF EXISTS stop_feel_explanation,
  DROP COLUMN IF EXISTS stop_feel_audio_url,
  DROP COLUMN IF EXISTS immediate_understanding,
  DROP COLUMN IF EXISTS immediate_understanding_audio_url,
  DROP COLUMN IF EXISTS hook_carrier,
  DROP COLUMN IF EXISTS hook_carrier_audio_url,
  DROP COLUMN IF EXISTS hook_without_audio,
  DROP COLUMN IF EXISTS hook_without_audio_recording_url,
  DROP COLUMN IF EXISTS audio_alone_stops_scroll,
  DROP COLUMN IF EXISTS audio_alone_stops_scroll_recording_url,
  DROP COLUMN IF EXISTS dominant_emotion_first_6,
  DROP COLUMN IF EXISTS dominant_emotion_first_6_audio_url,
  DROP COLUMN IF EXISTS understanding_by_second_6,
  DROP COLUMN IF EXISTS understanding_by_second_6_audio_url,
  DROP COLUMN IF EXISTS content_rating_level_3,
  -- Level 3: Production Planning
  DROP COLUMN IF EXISTS on_screen_text_hook,
  DROP COLUMN IF EXISTS our_idea_audio_url,
  DROP COLUMN IF EXISTS shoot_location,
  DROP COLUMN IF EXISTS planning_date,
  DROP COLUMN IF EXISTS additional_requirements,
  DROP COLUMN IF EXISTS syed_sir_presence,
  -- Drive URLs (replaced by production_files table)
  DROP COLUMN IF EXISTS raw_footage_drive_url,
  DROP COLUMN IF EXISTS edited_video_drive_url,
  DROP COLUMN IF EXISTS final_video_url,
  -- Other unused
  DROP COLUMN IF EXISTS budget,
  DROP COLUMN IF EXISTS custom_fields;

-- 3. Recreate views without dropped columns
CREATE VIEW active_projects AS
  SELECT id, user_id, reference_url, hook, hook_voice_note_url,
    why_viral, why_viral_voice_note_url, target_emotion, expected_outcome,
    status, created_at, updated_at, reviewed_by, reviewed_at, feedback,
    hook_strength, content_quality, viral_potential, replication_clarity,
    overall_score, feedback_voice_note_url, production_stage, priority,
    deadline, production_notes, production_started_at, production_completed_at,
    industry_id, content_id, profile_id, rejection_count, is_dissolved,
    dissolution_reason
  FROM viral_analyses
  WHERE is_dissolved = false OR is_dissolved IS NULL;

CREATE VIEW viral_analyses_with_users AS
  SELECT va.id, va.user_id, va.reference_url, va.hook, va.hook_voice_note_url,
    va.why_viral, va.why_viral_voice_note_url, va.target_emotion,
    va.expected_outcome, va.status, va.created_at, va.updated_at,
    p.email, p.full_name, p.avatar_url
  FROM viral_analyses va
  JOIN profiles p ON va.user_id = p.id;

COMMIT;
