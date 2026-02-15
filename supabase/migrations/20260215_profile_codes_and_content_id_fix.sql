-- Migration: Profile Codes + Content ID Format Fix
-- Date: 2026-02-15
-- Purpose: Add code column to profile_list and fix content ID generation
--          to use profile code instead of hardcoded BCH prefix

-- Step 1: Add code column to profile_list
ALTER TABLE profile_list ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- Step 2: Set codes for existing profiles
UPDATE profile_list SET code = 'BCH' WHERE name ILIKE '%bch%main%' OR name ILIKE '%bch main%';
UPDATE profile_list SET code = 'EMD' WHERE name ILIKE '%em doodle%' OR name ILIKE '%emdoodle%';
UPDATE profile_list SET code = 'NXT' WHERE name ILIKE '%next.blr%' OR name ILIKE '%nextblr%';
UPDATE profile_list SET code = 'RAL' WHERE name ILIKE '%raleigh%';
UPDATE profile_list SET code = 'SH' WHERE name ILIKE '%2ndhand%' OR name ILIKE '%secondhand%';
UPDATE profile_list SET code = 'TOY' WHERE name ILIKE '%toys%' OR name ILIKE '%toy%';
UPDATE profile_list SET code = 'WOW' WHERE name ILIKE '%waitson%' OR name ILIKE '%whatts on%' OR name ILIKE '%watts on%';
UPDATE profile_list SET code = 'LUX' WHERE name ILIKE '%luxe%';
UPDATE profile_list SET code = 'CAR' WHERE name ILIKE '%car%';

-- Step 3: Grant anon access to the new column (already has SELECT on profile_list)
-- The existing anon SELECT policy on profile_list covers the code column automatically

-- Step 4: Update the content ID generation function
CREATE OR REPLACE FUNCTION generate_content_id_on_approval(
    p_analysis_id UUID,
    p_profile_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_profile_name TEXT;
    v_profile_code TEXT;
    v_sequence_num INTEGER;
    v_content_id TEXT;
    v_existing_content_id TEXT;
    v_max_attempts INTEGER := 100;
    v_attempt INTEGER := 0;
BEGIN
    -- Check if content_id already exists for this analysis
    SELECT content_id INTO v_existing_content_id
    FROM viral_analyses
    WHERE id = p_analysis_id;

    -- If content_id already exists AND is not in old GEN- format, return it
    IF v_existing_content_id IS NOT NULL
       AND v_existing_content_id != ''
       AND v_existing_content_id NOT LIKE 'GEN-%' THEN
        RETURN v_existing_content_id;
    END IF;

    -- Get profile code and name
    SELECT code, name INTO v_profile_code, v_profile_name
    FROM profile_list
    WHERE id = p_profile_id;

    IF v_profile_name IS NULL THEN
        RAISE EXCEPTION 'Profile not found with id: %', p_profile_id;
    END IF;

    -- Use profile code if set, otherwise auto-generate from name
    IF v_profile_code IS NULL OR v_profile_code = '' THEN
        v_profile_code := UPPER(LEFT(REGEXP_REPLACE(v_profile_name, '[^a-zA-Z]', '', 'g'), 3));
    END IF;

    -- Get the next sequence number by checking BOTH viral_analyses AND used_content_ids
    -- Match pattern: {CODE}-{NNN} (new format) or {CODE}{NNN} (old format)
    SELECT COALESCE(MAX(seq_num), 0) + 1 INTO v_sequence_num
    FROM (
        -- Check current viral_analyses (new format with dash)
        SELECT
            CASE
                WHEN content_id ~ ('^' || v_profile_code || '-[0-9]+$')
                THEN CAST(SUBSTRING(content_id FROM LENGTH(v_profile_code) + 2) AS INTEGER)
                WHEN content_id ~ ('^' || v_profile_code || '[0-9]+$')
                THEN CAST(SUBSTRING(content_id FROM LENGTH(v_profile_code) + 1) AS INTEGER)
                -- Also check old BCH-prefixed format (e.g., BCHBCH031)
                WHEN content_id ~ ('^BCH' || v_profile_code || '[0-9]+$') AND v_profile_code = 'BCH'
                THEN CAST(SUBSTRING(content_id FROM 7) AS INTEGER)
                ELSE 0
            END as seq_num
        FROM viral_analyses
        WHERE content_id LIKE v_profile_code || '%'
           OR content_id LIKE v_profile_code || '-%'
           OR (v_profile_code = 'BCH' AND content_id LIKE 'BCHBCH%')

        UNION ALL

        -- Check used_content_ids (includes deleted projects)
        SELECT
            CASE
                WHEN content_id ~ ('^' || v_profile_code || '-[0-9]+$')
                THEN CAST(SUBSTRING(content_id FROM LENGTH(v_profile_code) + 2) AS INTEGER)
                WHEN content_id ~ ('^' || v_profile_code || '[0-9]+$')
                THEN CAST(SUBSTRING(content_id FROM LENGTH(v_profile_code) + 1) AS INTEGER)
                WHEN content_id ~ ('^BCH' || v_profile_code || '[0-9]+$') AND v_profile_code = 'BCH'
                THEN CAST(SUBSTRING(content_id FROM 7) AS INTEGER)
                ELSE 0
            END as seq_num
        FROM used_content_ids
        WHERE content_id LIKE v_profile_code || '%'
           OR content_id LIKE v_profile_code || '-%'
           OR (v_profile_code = 'BCH' AND content_id LIKE 'BCHBCH%')
    ) combined;

    -- Generate the content ID in new format: {CODE}-{NNN}
    v_content_id := v_profile_code || '-' || LPAD(v_sequence_num::TEXT, 3, '0');

    -- Double-check uniqueness against used_content_ids
    WHILE EXISTS (SELECT 1 FROM used_content_ids WHERE content_id = v_content_id) LOOP
        v_attempt := v_attempt + 1;
        IF v_attempt >= v_max_attempts THEN
            RAISE EXCEPTION 'Could not generate unique content_id after % attempts', v_max_attempts;
        END IF;
        v_sequence_num := v_sequence_num + 1;
        v_content_id := v_profile_code || '-' || LPAD(v_sequence_num::TEXT, 3, '0');
    END LOOP;

    -- Update the analysis with the new content_id
    UPDATE viral_analyses
    SET content_id = v_content_id,
        profile_id = p_profile_id
    WHERE id = p_analysis_id;

    -- The trigger will automatically add this to used_content_ids

    RETURN v_content_id;
END;
$$ LANGUAGE plpgsql;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION generate_content_id_on_approval(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION generate_content_id_on_approval(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_content_id_on_approval(UUID, UUID) TO service_role;
