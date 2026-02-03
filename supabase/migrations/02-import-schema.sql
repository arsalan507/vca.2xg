-- ============================================================================
-- Processed Schema Import (from Supabase export)
-- Fixed: extensions.uuid_generate_v4() → gen_random_uuid()
-- Fixed: auth.users(id) FK references → public.users(id)
-- Removed: handle_new_user() trigger (was Supabase-specific)
-- ============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ─── Functions ──────────────────────────────────────────────────────────────

CREATE FUNCTION public.calculate_cast_total() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.cast_composition = jsonb_set(
    NEW.cast_composition,
    '{total}',
    to_jsonb(
      COALESCE((NEW.cast_composition->>'man')::int, 0) +
      COALESCE((NEW.cast_composition->>'woman')::int, 0) +
      COALESCE((NEW.cast_composition->>'boy')::int, 0) +
      COALESCE((NEW.cast_composition->>'girl')::int, 0) +
      COALESCE((NEW.cast_composition->>'teen_boy')::int, 0) +
      COALESCE((NEW.cast_composition->>'teen_girl')::int, 0) +
      COALESCE((NEW.cast_composition->>'senior_man')::int, 0) +
      COALESCE((NEW.cast_composition->>'senior_woman')::int, 0)
    )
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.check_rejection_dissolution() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.rejection_count >= 5 AND NEW.status = 'REJECTED' THEN
    NEW.is_dissolved := TRUE;
    NEW.dissolution_reason := 'Script rejected 5 times - project automatically dissolved';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.disapprove_script(analysis_uuid uuid, reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE viral_analyses
    SET
        status = 'PENDING',
        disapproval_count = disapproval_count + 1,
        last_disapproved_at = NOW(),
        disapproval_reason = reason,
        production_stage = CASE
            WHEN production_stage IN ('NOT_STARTED', 'PRE_PRODUCTION') THEN production_stage
            ELSE 'NOT_STARTED'
        END,
        updated_at = NOW()
    WHERE id = analysis_uuid
    AND status = 'APPROVED';

    UPDATE viral_analyses
    SET production_notes = COALESCE(production_notes || E'\n\n', '') ||
        '🔴 DISAPPROVED on ' || NOW()::TEXT || E'\nReason: ' || reason
    WHERE id = analysis_uuid;
END;
$$;

COMMENT ON FUNCTION public.disapprove_script(analysis_uuid uuid, reason text) IS 'Allows admin to disapprove an already-approved script and send it back to PENDING status.
Increments disapproval counter and resets production stage if needed.';

CREATE FUNCTION public.generate_content_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_industry_code TEXT;
  next_number INTEGER;
  new_content_id TEXT;
  max_attempts INTEGER := 50;
  attempt INTEGER := 0;
BEGIN
  IF NEW.content_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.industry_id IS NOT NULL THEN
    SELECT short_code INTO v_industry_code
    FROM industries
    WHERE id = NEW.industry_id;
  END IF;

  IF v_industry_code IS NULL THEN
    v_industry_code := 'GEN';
  END IF;

  INSERT INTO viral_analyses_sequences (industry_code, next_value)
  VALUES (v_industry_code, 1001)
  ON CONFLICT (industry_code) DO NOTHING;

  LOOP
    attempt := attempt + 1;
    UPDATE viral_analyses_sequences
    SET next_value = next_value + 1
    WHERE industry_code = v_industry_code
    RETURNING next_value - 1 INTO next_number;

    new_content_id := v_industry_code || '-' || next_number;

    IF NOT EXISTS (SELECT 1 FROM viral_analyses WHERE content_id = new_content_id) THEN
      NEW.content_id := new_content_id;
      RETURN NEW;
    END IF;

    IF attempt >= max_attempts THEN
      new_content_id := v_industry_code || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '-' || substr(gen_random_uuid()::text, 1, 4);
      NEW.content_id := new_content_id;
      RAISE WARNING 'Used fallback content_id generation: %', new_content_id;
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.generate_content_id_on_approval(p_analysis_id uuid, p_profile_id uuid) RETURNS text
    LANGUAGE plpgsql
    AS $_$
DECLARE
    v_profile_name TEXT;
    v_profile_code TEXT;
    v_sequence_num INTEGER;
    v_content_id TEXT;
    v_existing_content_id TEXT;
    v_max_attempts INTEGER := 100;
    v_attempt INTEGER := 0;
BEGIN
    SELECT content_id INTO v_existing_content_id
    FROM viral_analyses
    WHERE id = p_analysis_id;

    IF v_existing_content_id IS NOT NULL
       AND v_existing_content_id != ''
       AND v_existing_content_id NOT LIKE 'GEN-%' THEN
        RETURN v_existing_content_id;
    END IF;

    SELECT name INTO v_profile_name
    FROM profile_list
    WHERE id = p_profile_id;

    IF v_profile_name IS NULL THEN
        RAISE EXCEPTION 'Profile not found with id: %', p_profile_id;
    END IF;

    v_profile_code := 'BCH' || UPPER(LEFT(REGEXP_REPLACE(v_profile_name, '[^a-zA-Z]', '', 'g'), 3));

    SELECT COALESCE(MAX(seq_num), 0) + 1 INTO v_sequence_num
    FROM (
        SELECT
            CASE
                WHEN content_id ~ ('^' || v_profile_code || '[0-9]+$')
                THEN CAST(SUBSTRING(content_id FROM LENGTH(v_profile_code) + 1) AS INTEGER)
                ELSE 0
            END as seq_num
        FROM viral_analyses
        WHERE content_id LIKE v_profile_code || '%'
        UNION ALL
        SELECT
            CASE
                WHEN content_id ~ ('^' || v_profile_code || '[0-9]+$')
                THEN CAST(SUBSTRING(content_id FROM LENGTH(v_profile_code) + 1) AS INTEGER)
                ELSE 0
            END as seq_num
        FROM used_content_ids
        WHERE content_id LIKE v_profile_code || '%'
    ) combined;

    v_content_id := v_profile_code || LPAD(v_sequence_num::TEXT, 3, '0');

    WHILE EXISTS (SELECT 1 FROM used_content_ids WHERE content_id = v_content_id) LOOP
        v_attempt := v_attempt + 1;
        IF v_attempt >= v_max_attempts THEN
            RAISE EXCEPTION 'Could not generate unique content_id after % attempts', v_max_attempts;
        END IF;
        v_sequence_num := v_sequence_num + 1;
        v_content_id := v_profile_code || LPAD(v_sequence_num::TEXT, 3, '0');
    END LOOP;

    UPDATE viral_analyses
    SET content_id = v_content_id,
        profile_id = p_profile_id
    WHERE id = p_analysis_id;

    RETURN v_content_id;
END;
$_$;

CREATE FUNCTION public.get_videographer_workload(videographer_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  workload INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO workload
  FROM project_assignments pa
  JOIN viral_analyses va ON va.id = pa.analysis_id
  WHERE pa.user_id = videographer_id
  AND pa.role = 'VIDEOGRAPHER'
  AND va.production_stage IN ('PRE_PRODUCTION', 'SHOOTING', 'SHOOT_REVIEW')
  AND va.status = 'APPROVED';

  SELECT workload + COUNT(*)
  INTO workload
  FROM project_assignments pa
  JOIN viral_analyses va ON va.id = pa.analysis_id
  WHERE pa.user_id = videographer_id
  AND pa.role = 'VIDEOGRAPHER'
  AND va.priority = 'URGENT'
  AND va.production_stage IN ('PRE_PRODUCTION', 'SHOOTING', 'SHOOT_REVIEW')
  AND va.status = 'APPROVED';

  RETURN COALESCE(workload, 0);
END;
$$;

-- NOTE: handle_new_user() is NOT imported - it was Supabase-specific (triggered on auth.users INSERT)
-- Authentik webhook or backend registration handles profile creation instead.

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$;

CREATE FUNCTION public.has_edited_video(p_analysis_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM production_files
        WHERE analysis_id = p_analysis_id
        AND file_type IN ('EDITED_VIDEO', 'FINAL_VIDEO')
        AND is_deleted = FALSE
    );
END;
$$;

CREATE FUNCTION public.has_raw_footage(p_analysis_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM production_files
        WHERE analysis_id = p_analysis_id
        AND file_type IN ('RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP')
        AND is_deleted = FALSE
    );
END;
$$;

CREATE FUNCTION public.increment_rejection_counter(analysis_uuid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE viral_analyses
  SET
    rejection_count = rejection_count + 1,
    updated_at = NOW()
  WHERE id = analysis_uuid;
END;
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();
  RETURN user_role IN ('SUPER_ADMIN', 'CREATOR');
END;
$$;

CREATE FUNCTION public.is_production_team() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();
  RETURN user_role IN ('VIDEOGRAPHER', 'EDITOR', 'POSTING_MANAGER');
END;
$$;

CREATE FUNCTION public.is_super_admin(user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'SUPER_ADMIN'
  );
$$;

CREATE FUNCTION public.mark_content_id_deleted() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.content_id IS NOT NULL AND OLD.content_id != '' THEN
        UPDATE used_content_ids
        SET deleted_at = NOW(),
            analysis_id = NULL
        WHERE content_id = OLD.content_id;
    END IF;
    RETURN OLD;
END;
$$;

CREATE FUNCTION public.track_content_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.content_id IS NOT NULL AND NEW.content_id != '' THEN
        INSERT INTO used_content_ids (content_id, analysis_id, profile_id, created_at)
        VALUES (NEW.content_id, NEW.id, NEW.profile_id, NOW())
        ON CONFLICT (content_id) DO UPDATE
        SET analysis_id = NEW.id,
            profile_id = NEW.profile_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_project_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.user_has_assignment(analysis_uuid uuid, user_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_assignments
    WHERE analysis_id = analysis_uuid
    AND user_id = user_uuid
  );
$$;

-- ─── Tables ─────────────────────────────────────────────────────────────────

-- NOTE: public.users table is created in 01-init.sql

CREATE TABLE public.viral_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reference_url text NOT NULL,
    hook text,
    hook_voice_note_url text,
    why_viral text,
    why_viral_voice_note_url text,
    how_to_replicate text,
    how_to_replicate_voice_note_url text,
    target_emotion text NOT NULL,
    expected_outcome text NOT NULL,
    status text DEFAULT 'PENDING'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    feedback text,
    hook_strength integer,
    content_quality integer,
    viral_potential integer,
    replication_clarity integer,
    overall_score numeric(3,1),
    feedback_voice_note_url text,
    production_stage text,
    priority text DEFAULT 'NORMAL'::text,
    deadline timestamp with time zone,
    budget numeric(10,2),
    production_notes text,
    production_started_at timestamp with time zone,
    production_completed_at timestamp with time zone,
    raw_footage_drive_url text,
    edited_video_drive_url text,
    final_video_url text,
    industry_id uuid,
    content_id text,
    profile_id uuid,
    total_people_involved integer,
    additional_requirements text,
    syed_sir_presence text,
    planning_date date,
    on_screen_text_hook text,
    our_idea_audio_url text,
    shoot_location text,
    shoot_possibility integer,
    rejection_count integer DEFAULT 0,
    is_dissolved boolean DEFAULT false,
    dissolution_reason text,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    platform text,
    content_type text,
    shoot_type text,
    characters_involved text,
    creator_name text,
    unusual_element text,
    works_without_audio text,
    content_rating integer,
    replication_strength integer,
    body_reactions text[],
    emotion_first_6_sec text,
    challenged_belief text,
    emotional_identity_impact text[],
    if_he_can_why_cant_you text,
    feel_like_commenting text,
    read_comments text,
    sharing_number integer,
    video_action text,
    stop_feel text,
    stop_feel_explanation text,
    stop_feel_audio_url text,
    immediate_understanding text,
    immediate_understanding_audio_url text,
    hook_carrier text,
    hook_carrier_audio_url text,
    hook_without_audio text,
    hook_without_audio_recording_url text,
    audio_alone_stops_scroll text,
    audio_alone_stops_scroll_recording_url text,
    dominant_emotion_first_6 text,
    dominant_emotion_first_6_audio_url text,
    understanding_by_second_6 text,
    understanding_by_second_6_audio_url text,
    content_rating_level_3 integer,
    disapproval_count integer DEFAULT 0,
    last_disapproved_at timestamp with time zone,
    disapproval_reason text,
    planned_date date,
    admin_remarks text,
    posting_platform character varying(50),
    posting_caption text,
    posting_heading character varying(255),
    posting_hashtags text[],
    scheduled_post_time timestamp with time zone,
    posted_url character varying(500),
    posted_at timestamp with time zone,
    title text,
    cast_composition jsonb DEFAULT '{"boy": 0, "man": 0, "girl": 0, "total": 0, "woman": 0, "teen_boy": 0, "teen_girl": 0, "senior_man": 0, "senior_woman": 0, "include_owner": false}'::jsonb,
    CONSTRAINT viral_analyses_content_rating_check CHECK (((content_rating >= 1) AND (content_rating <= 10))),
    CONSTRAINT viral_analyses_content_rating_level_3_check CHECK (((content_rating_level_3 >= 1) AND (content_rating_level_3 <= 10))),
    CONSTRAINT viral_analyses_replication_strength_check CHECK (((replication_strength >= 1) AND (replication_strength <= 10))),
    CONSTRAINT viral_analyses_shoot_possibility_check CHECK ((shoot_possibility = ANY (ARRAY[25, 50, 75, 100]))),
    CONSTRAINT viral_analyses_syed_sir_presence_check CHECK ((syed_sir_presence = ANY (ARRAY['YES'::text, 'NO'::text])))
);

CREATE TABLE public.analysis_character_tags (
    analysis_id uuid NOT NULL,
    character_tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.analysis_hook_tags (
    analysis_id uuid NOT NULL,
    hook_tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.character_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'SCRIPT_WRITER'::text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_trusted_writer boolean DEFAULT false,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['SUPER_ADMIN'::text, 'SCRIPT_WRITER'::text, 'CREATOR'::text, 'VIDEOGRAPHER'::text, 'EDITOR'::text, 'POSTING_MANAGER'::text])))
);

COMMENT ON COLUMN public.profiles.is_trusted_writer IS 'If true, scripts from this writer are auto-approved to PLANNING stage';

CREATE TABLE public.form_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key text DEFAULT 'script_form_config'::text NOT NULL,
    version text DEFAULT '1.0.0'::text NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);

CREATE TABLE public.hook_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    short_code text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.production_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analysis_id uuid NOT NULL,
    uploaded_by uuid,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_url text NOT NULL,
    file_size bigint,
    mime_type text,
    description text,
    upload_stage text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approval_status text DEFAULT 'pending'::text,
    reviewed_by uuid,
    review_notes text,
    reviewed_at timestamp with time zone,
    file_id text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    CONSTRAINT production_files_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.profile_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.project_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analysis_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_assignments_role_check CHECK ((role = ANY (ARRAY['VIDEOGRAPHER'::text, 'EDITOR'::text, 'POSTING_MANAGER'::text])))
);

CREATE TABLE public.project_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    estimated_shoot_date date,
    people_required integer,
    status text DEFAULT 'PENDING'::text NOT NULL,
    requested_by uuid NOT NULL,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    admin_notes text,
    viral_analysis_id uuid,
    CONSTRAINT project_requests_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'IN_PROGRESS'::text])))
);

CREATE TABLE public.used_content_ids (
    content_id text NOT NULL,
    analysis_id uuid,
    profile_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);

CREATE TABLE public.viral_analyses_sequences (
    industry_code text NOT NULL,
    next_value integer DEFAULT 1001 NOT NULL
);

-- ─── Views ──────────────────────────────────────────────────────────────────

CREATE VIEW public.active_projects AS
 SELECT id, user_id, reference_url, hook, hook_voice_note_url, why_viral,
    why_viral_voice_note_url, how_to_replicate, how_to_replicate_voice_note_url,
    target_emotion, expected_outcome, status, created_at, updated_at, reviewed_by,
    reviewed_at, feedback, hook_strength, content_quality, viral_potential,
    replication_clarity, overall_score, feedback_voice_note_url, production_stage,
    priority, deadline, budget, production_notes, production_started_at,
    production_completed_at, raw_footage_drive_url, edited_video_drive_url,
    final_video_url, industry_id, content_id, profile_id, total_people_involved,
    additional_requirements, syed_sir_presence, planning_date, on_screen_text_hook,
    our_idea_audio_url, shoot_location, shoot_possibility, rejection_count,
    is_dissolved, dissolution_reason
   FROM public.viral_analyses
  WHERE ((is_dissolved = false) OR (is_dissolved IS NULL));

CREATE VIEW public.disapproved_scripts AS
 SELECT va.id, va.content_id, va.hook, va.status, va.disapproval_count,
    va.rejection_count, va.last_disapproved_at, va.disapproval_reason,
    va.production_stage, p.full_name AS script_writer_name,
    p.email AS script_writer_email, va.created_at, va.updated_at
   FROM (public.viral_analyses va
     LEFT JOIN public.profiles p ON ((va.user_id = p.id)))
  WHERE (va.disapproval_count > 0)
  ORDER BY va.last_disapproved_at DESC;

CREATE VIEW public.viral_analyses_with_users AS
 SELECT va.id, va.user_id, va.reference_url, va.hook, va.hook_voice_note_url,
    va.why_viral, va.why_viral_voice_note_url, va.how_to_replicate,
    va.how_to_replicate_voice_note_url, va.target_emotion, va.expected_outcome,
    va.status, va.created_at, va.updated_at, p.email, p.full_name, p.avatar_url
   FROM (public.viral_analyses va
     JOIN public.profiles p ON ((va.user_id = p.id)));

-- ─── Primary Keys ───────────────────────────────────────────────────────────

ALTER TABLE ONLY public.analysis_character_tags ADD CONSTRAINT analysis_character_tags_pkey PRIMARY KEY (analysis_id, character_tag_id);
ALTER TABLE ONLY public.analysis_hook_tags ADD CONSTRAINT analysis_hook_tags_pkey PRIMARY KEY (analysis_id, hook_tag_id);
ALTER TABLE ONLY public.character_tags ADD CONSTRAINT character_tags_name_key UNIQUE (name);
ALTER TABLE ONLY public.character_tags ADD CONSTRAINT character_tags_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.form_configurations ADD CONSTRAINT form_configurations_config_key_key UNIQUE (config_key);
ALTER TABLE ONLY public.form_configurations ADD CONSTRAINT form_configurations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.hook_tags ADD CONSTRAINT hook_tags_name_key UNIQUE (name);
ALTER TABLE ONLY public.hook_tags ADD CONSTRAINT hook_tags_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.industries ADD CONSTRAINT industries_name_key UNIQUE (name);
ALTER TABLE ONLY public.industries ADD CONSTRAINT industries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.industries ADD CONSTRAINT industries_short_code_key UNIQUE (short_code);
ALTER TABLE ONLY public.production_files ADD CONSTRAINT production_files_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profile_list ADD CONSTRAINT profile_list_name_key UNIQUE (name);
ALTER TABLE ONLY public.profile_list ADD CONSTRAINT profile_list_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.project_assignments ADD CONSTRAINT project_assignments_analysis_id_user_id_role_key UNIQUE (analysis_id, user_id, role);
ALTER TABLE ONLY public.project_assignments ADD CONSTRAINT project_assignments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.project_requests ADD CONSTRAINT project_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.used_content_ids ADD CONSTRAINT used_content_ids_pkey PRIMARY KEY (content_id);
ALTER TABLE ONLY public.viral_analyses ADD CONSTRAINT viral_analyses_content_id_unique UNIQUE (content_id);
ALTER TABLE ONLY public.viral_analyses ADD CONSTRAINT viral_analyses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.viral_analyses_sequences ADD CONSTRAINT viral_analyses_sequences_pkey PRIMARY KEY (industry_code);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX idx_analysis_character_tags_analysis_id ON public.analysis_character_tags USING btree (analysis_id);
CREATE INDEX idx_analysis_hook_tags_analysis_id ON public.analysis_hook_tags USING btree (analysis_id);
CREATE INDEX idx_form_configurations_config_key ON public.form_configurations USING btree (config_key);
CREATE INDEX idx_production_files_analysis ON public.production_files USING btree (analysis_id);
CREATE INDEX idx_production_files_analysis_id ON public.production_files USING btree (analysis_id);
CREATE INDEX idx_production_files_approval_status ON public.production_files USING btree (approval_status);
CREATE INDEX idx_production_files_created ON public.production_files USING btree (created_at DESC);
CREATE INDEX idx_production_files_file_type ON public.production_files USING btree (file_type);
CREATE INDEX idx_production_files_is_deleted ON public.production_files USING btree (is_deleted);
CREATE INDEX idx_production_files_reviewed_by ON public.production_files USING btree (reviewed_by);
CREATE INDEX idx_production_files_type ON public.production_files USING btree (file_type);
CREATE INDEX idx_production_files_uploaded_by ON public.production_files USING btree (uploaded_by);
CREATE INDEX idx_profiles_trusted_writer ON public.profiles USING btree (is_trusted_writer) WHERE (is_trusted_writer = true);
CREATE INDEX idx_project_assignments_analysis ON public.project_assignments USING btree (analysis_id);
CREATE INDEX idx_project_assignments_assigned_by ON public.project_assignments USING btree (assigned_by);
CREATE INDEX idx_project_assignments_role ON public.project_assignments USING btree (role);
CREATE INDEX idx_project_assignments_user ON public.project_assignments USING btree (user_id);
CREATE INDEX idx_project_requests_created_at ON public.project_requests USING btree (created_at DESC);
CREATE INDEX idx_project_requests_requested_by ON public.project_requests USING btree (requested_by);
CREATE INDEX idx_project_requests_status ON public.project_requests USING btree (status);
CREATE INDEX idx_used_content_ids_prefix ON public.used_content_ids USING btree (content_id text_pattern_ops);
CREATE INDEX idx_viral_analyses_cast_composition ON public.viral_analyses USING gin (cast_composition);
CREATE INDEX idx_viral_analyses_content_id ON public.viral_analyses USING btree (content_id);
CREATE INDEX idx_viral_analyses_content_rating ON public.viral_analyses USING btree (content_rating);
CREATE INDEX idx_viral_analyses_content_type ON public.viral_analyses USING btree (content_type);
CREATE INDEX idx_viral_analyses_created_at ON public.viral_analyses USING btree (created_at DESC);
CREATE INDEX idx_viral_analyses_custom_fields ON public.viral_analyses USING gin (custom_fields);
CREATE INDEX idx_viral_analyses_disapproval ON public.viral_analyses USING btree (disapproval_count) WHERE (disapproval_count > 0);
CREATE INDEX idx_viral_analyses_edit_queue ON public.viral_analyses USING btree (production_stage, status, priority, created_at) WHERE ((production_stage = 'READY_FOR_EDIT'::text) AND (status = 'APPROVED'::text));
CREATE INDEX idx_viral_analyses_industry_id ON public.viral_analyses USING btree (industry_id);
CREATE INDEX idx_viral_analyses_is_dissolved ON public.viral_analyses USING btree (is_dissolved);
CREATE INDEX idx_viral_analyses_planned_date ON public.viral_analyses USING btree (planned_date) WHERE (planned_date IS NOT NULL);
CREATE INDEX idx_viral_analyses_planning_queue ON public.viral_analyses USING btree (production_stage, status, priority, created_at) WHERE ((production_stage = 'PLANNING'::text) AND (status = 'APPROVED'::text));
CREATE INDEX idx_viral_analyses_platform ON public.viral_analyses USING btree (platform);
CREATE INDEX idx_viral_analyses_post_queue ON public.viral_analyses USING btree (production_stage, status, scheduled_post_time, priority) WHERE ((production_stage = 'READY_TO_POST'::text) AND (status = 'APPROVED'::text));
CREATE INDEX idx_viral_analyses_posted_url ON public.viral_analyses USING btree (posted_url) WHERE (posted_url IS NOT NULL);
CREATE INDEX idx_viral_analyses_profile_id ON public.viral_analyses USING btree (profile_id);
CREATE INDEX idx_viral_analyses_rejection_count ON public.viral_analyses USING btree (rejection_count);
CREATE INDEX idx_viral_analyses_replication_strength ON public.viral_analyses USING btree (replication_strength);
CREATE INDEX idx_viral_analyses_reviewed_by ON public.viral_analyses USING btree (reviewed_by);
CREATE INDEX idx_viral_analyses_status ON public.viral_analyses USING btree (status);
CREATE INDEX idx_viral_analyses_status_created ON public.viral_analyses USING btree (status, created_at DESC);
CREATE INDEX idx_viral_analyses_user_id ON public.viral_analyses USING btree (user_id);

-- ─── Triggers ───────────────────────────────────────────────────────────────

CREATE TRIGGER mark_content_id_deleted_trigger BEFORE DELETE ON public.viral_analyses FOR EACH ROW EXECUTE FUNCTION public.mark_content_id_deleted();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.viral_analyses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER track_content_id_trigger AFTER INSERT OR UPDATE OF content_id ON public.viral_analyses FOR EACH ROW EXECUTE FUNCTION public.track_content_id();
CREATE TRIGGER trg_calculate_cast_total BEFORE INSERT OR UPDATE OF cast_composition ON public.viral_analyses FOR EACH ROW WHEN ((new.cast_composition IS NOT NULL)) EXECUTE FUNCTION public.calculate_cast_total();
CREATE TRIGGER trigger_check_rejection_dissolution BEFORE UPDATE ON public.viral_analyses FOR EACH ROW WHEN ((new.rejection_count IS DISTINCT FROM old.rejection_count)) EXECUTE FUNCTION public.check_rejection_dissolution();
CREATE TRIGGER update_character_tags_updated_at BEFORE UPDATE ON public.character_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hook_tags_updated_at BEFORE UPDATE ON public.hook_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_industries_updated_at BEFORE UPDATE ON public.industries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profile_list_updated_at BEFORE UPDATE ON public.profile_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_requests_updated_at_trigger BEFORE UPDATE ON public.project_requests FOR EACH ROW EXECUTE FUNCTION public.update_project_requests_updated_at();

-- ─── Foreign Keys (auth.users → public.users) ──────────────────────────────

ALTER TABLE ONLY public.analysis_character_tags ADD CONSTRAINT analysis_character_tags_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.viral_analyses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.analysis_character_tags ADD CONSTRAINT analysis_character_tags_character_tag_id_fkey FOREIGN KEY (character_tag_id) REFERENCES public.character_tags(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.analysis_hook_tags ADD CONSTRAINT analysis_hook_tags_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.viral_analyses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.analysis_hook_tags ADD CONSTRAINT analysis_hook_tags_hook_tag_id_fkey FOREIGN KEY (hook_tag_id) REFERENCES public.hook_tags(id) ON DELETE CASCADE;
-- Changed from auth.users(id) → public.users(id)
ALTER TABLE ONLY public.form_configurations ADD CONSTRAINT form_configurations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.production_files ADD CONSTRAINT production_files_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.viral_analyses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.production_files ADD CONSTRAINT production_files_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.production_files ADD CONSTRAINT production_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
-- Changed from auth.users(id) → public.users(id)
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.project_assignments ADD CONSTRAINT project_assignments_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.viral_analyses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.project_assignments ADD CONSTRAINT project_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id);
ALTER TABLE ONLY public.project_assignments ADD CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
-- Changed from auth.users(id) → public.users(id)
ALTER TABLE ONLY public.project_requests ADD CONSTRAINT project_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE;
-- Changed from auth.users(id) → public.users(id)
ALTER TABLE ONLY public.project_requests ADD CONSTRAINT project_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.project_requests ADD CONSTRAINT project_requests_viral_analysis_id_fkey FOREIGN KEY (viral_analysis_id) REFERENCES public.viral_analyses(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.viral_analyses ADD CONSTRAINT viral_analyses_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES public.industries(id);
ALTER TABLE ONLY public.viral_analyses ADD CONSTRAINT viral_analyses_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile_list(id);
ALTER TABLE ONLY public.viral_analyses ADD CONSTRAINT viral_analyses_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
ALTER TABLE ONLY public.viral_analyses ADD CONSTRAINT viral_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.analysis_character_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_hook_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hook_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requests ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Profiles
CREATE POLICY profiles_select_all ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY users_read_own_profile ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles profiles_1 WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])))))) WITH CHECK ((EXISTS ( SELECT 1 FROM public.profiles profiles_1 WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));

-- Project Assignments
CREATE POLICY "Admins can create assignments" ON public.project_assignments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Admins can delete assignments" ON public.project_assignments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Admins can update assignments" ON public.project_assignments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Admins can view all assignments" ON public.project_assignments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Users can view their own assignments" ON public.project_assignments FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can view assignments for their analyses" ON public.project_assignments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.viral_analyses WHERE ((viral_analyses.id = project_assignments.analysis_id) AND (viral_analyses.user_id = auth.uid())))));
CREATE POLICY "Allow users to create assignments" ON public.project_assignments FOR INSERT WITH CHECK (((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = 'ADMIN'::text) OR (user_id = auth.uid()) OR (assigned_by = auth.uid())));
CREATE POLICY "Allow users to delete assignments" ON public.project_assignments FOR DELETE USING (((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = 'ADMIN'::text) OR (assigned_by = auth.uid())));
CREATE POLICY "Allow users to update assignments" ON public.project_assignments FOR UPDATE USING (((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = 'ADMIN'::text) OR (assigned_by = auth.uid()))) WITH CHECK (((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = 'ADMIN'::text) OR (assigned_by = auth.uid())));
CREATE POLICY "Allow users to view assignments" ON public.project_assignments FOR SELECT USING (((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = 'ADMIN'::text) OR (user_id = auth.uid()) OR (assigned_by = auth.uid())));
CREATE POLICY assignments_delete_admin ON public.project_assignments FOR DELETE TO authenticated USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])));
CREATE POLICY assignments_insert_admin ON public.project_assignments FOR INSERT TO authenticated WITH CHECK ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])));
CREATE POLICY assignments_select_admin ON public.project_assignments FOR SELECT TO authenticated USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])));
CREATE POLICY assignments_select_own ON public.project_assignments FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY assignments_update_admin ON public.project_assignments FOR UPDATE TO authenticated USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))) WITH CHECK ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])));

-- Production Files
CREATE POLICY "Admins can delete any file" ON public.production_files FOR DELETE USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::text)))));
CREATE POLICY "Admins can update any file" ON public.production_files FOR UPDATE USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::text)))));
CREATE POLICY admins_delete_all_files ON public.production_files FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY admins_insert_all_files ON public.production_files FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY admins_select_all_files ON public.production_files FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY admins_update_all_files ON public.production_files FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Editors can upload edited videos" ON public.production_files FOR INSERT WITH CHECK (((file_type = 'edited-video'::text) AND (analysis_id IN ( SELECT project_assignments.analysis_id FROM public.project_assignments WHERE ((project_assignments.user_id = auth.uid()) AND (project_assignments.role = 'EDITOR'::text))))));
CREATE POLICY "Posting managers can upload final videos" ON public.production_files FOR INSERT WITH CHECK (((file_type = 'final-video'::text) AND (analysis_id IN ( SELECT project_assignments.analysis_id FROM public.project_assignments WHERE ((project_assignments.user_id = auth.uid()) AND (project_assignments.role = 'POSTING_MANAGER'::text))))));
CREATE POLICY "Users can delete their own files" ON public.production_files FOR DELETE USING ((uploaded_by = auth.uid()));
CREATE POLICY "Users can update their own files" ON public.production_files FOR UPDATE USING ((uploaded_by = auth.uid())) WITH CHECK ((uploaded_by = auth.uid()));
CREATE POLICY "Users can view files for assigned projects" ON public.production_files FOR SELECT USING (((is_deleted = false) AND ((analysis_id IN ( SELECT project_assignments.analysis_id FROM public.project_assignments WHERE (project_assignments.user_id = auth.uid()))) OR (EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::text)))) OR (analysis_id IN ( SELECT viral_analyses.id FROM public.viral_analyses WHERE (viral_analyses.user_id = auth.uid()))))));
CREATE POLICY "Videographers can upload raw footage" ON public.production_files FOR INSERT WITH CHECK (((file_type = 'raw-footage'::text) AND (analysis_id IN ( SELECT project_assignments.analysis_id FROM public.project_assignments WHERE ((project_assignments.user_id = auth.uid()) AND (project_assignments.role = 'VIDEOGRAPHER'::text))))));
CREATE POLICY production_team_select_approved_files ON public.production_files FOR SELECT TO authenticated USING ((public.is_production_team() AND (EXISTS ( SELECT 1 FROM public.viral_analyses WHERE ((viral_analyses.id = production_files.analysis_id) AND (viral_analyses.status = 'APPROVED'::text))))));
CREATE POLICY team_delete_assigned_files ON public.production_files FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.project_assignments WHERE ((project_assignments.analysis_id = production_files.analysis_id) AND (project_assignments.user_id = auth.uid())))));
CREATE POLICY team_insert_assigned_files ON public.production_files FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.project_assignments WHERE ((project_assignments.analysis_id = production_files.analysis_id) AND (project_assignments.user_id = auth.uid())))));
CREATE POLICY team_select_assigned_files ON public.production_files FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.project_assignments WHERE ((project_assignments.analysis_id = production_files.analysis_id) AND (project_assignments.user_id = auth.uid())))));
CREATE POLICY team_update_assigned_files ON public.production_files FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.project_assignments WHERE ((project_assignments.analysis_id = production_files.analysis_id) AND (project_assignments.user_id = auth.uid())))));
CREATE POLICY team_upload_project_files ON public.production_files FOR INSERT TO authenticated WITH CHECK (((analysis_id IN ( SELECT project_assignments.analysis_id FROM public.project_assignments WHERE (project_assignments.user_id = auth.uid()))) OR (auth.uid() IN ( SELECT profiles.id FROM public.profiles WHERE (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY team_view_project_files ON public.production_files FOR SELECT TO authenticated USING (((analysis_id IN ( SELECT project_assignments.analysis_id FROM public.project_assignments WHERE (project_assignments.user_id = auth.uid()))) OR (auth.uid() IN ( SELECT profiles.id FROM public.profiles WHERE (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])))) OR (analysis_id IN ( SELECT viral_analyses.id FROM public.viral_analyses WHERE (viral_analyses.user_id = auth.uid())))));
CREATE POLICY users_delete_own_files ON public.production_files FOR DELETE TO authenticated USING ((uploaded_by = auth.uid()));
CREATE POLICY users_select_own_files ON public.production_files FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.viral_analyses WHERE ((viral_analyses.id = production_files.analysis_id) AND (viral_analyses.user_id = auth.uid())))));
CREATE POLICY users_update_own_files ON public.production_files FOR UPDATE TO authenticated USING ((uploaded_by = auth.uid())) WITH CHECK ((uploaded_by = auth.uid()));

-- Tags
CREATE POLICY "Anyone can view analysis character tags" ON public.analysis_character_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view analysis hook tags" ON public.analysis_hook_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view character tags" ON public.character_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view hook tags" ON public.hook_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view industries" ON public.industries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view profile list" ON public.profile_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their analysis character tags" ON public.analysis_character_tags TO authenticated USING (((EXISTS ( SELECT 1 FROM public.viral_analyses WHERE ((viral_analyses.id = analysis_character_tags.analysis_id) AND (viral_analyses.user_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])))))));
CREATE POLICY "Users can manage their analysis hook tags" ON public.analysis_hook_tags TO authenticated USING (((EXISTS ( SELECT 1 FROM public.viral_analyses WHERE ((viral_analyses.id = analysis_hook_tags.analysis_id) AND (viral_analyses.user_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text])))))));
CREATE POLICY "Only admins can delete character tags" ON public.character_tags FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can delete hook tags" ON public.hook_tags FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can delete industries" ON public.industries FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can delete profile list" ON public.profile_list FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can insert character tags" ON public.character_tags FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can insert hook tags" ON public.hook_tags FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can insert industries" ON public.industries FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can insert profile list" ON public.profile_list FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can update character tags" ON public.character_tags FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can update hook tags" ON public.hook_tags FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can update industries" ON public.industries FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));
CREATE POLICY "Only admins can update profile list" ON public.profile_list FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SUPER_ADMIN'::text, 'CREATOR'::text]))))));

-- Form Configurations
CREATE POLICY "Allow authenticated insert/update" ON public.form_configurations USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Allow public read access" ON public.form_configurations FOR SELECT USING (true);

-- Project Requests
CREATE POLICY "Admins can update project requests" ON public.project_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'SUPER_ADMIN'::text)))));
CREATE POLICY "Admins can view all project requests" ON public.project_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'SUPER_ADMIN'::text)))));
CREATE POLICY "Videographers can create project requests" ON public.project_requests FOR INSERT TO authenticated WITH CHECK (((auth.uid() = requested_by) AND (EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'VIDEOGRAPHER'::text))))));
CREATE POLICY "Videographers can view own requests" ON public.project_requests FOR SELECT TO authenticated USING (((requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM public.profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'SUPER_ADMIN'::text))))));
