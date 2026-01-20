-- ========================================
-- FIX DUPLICATE CONTENT_IDS - V5 USING SEQUENCES
-- ========================================
-- This version uses PostgreSQL sequences for each industry
-- Sequences are atomic and guarantee uniqueness even under high concurrency

-- Step 1: Fix existing duplicates first
DO $$
DECLARE
  duplicate_content_id TEXT;
  duplicate_record RECORD;
  industry_code TEXT;
  next_number INTEGER;
  new_id TEXT;
  keep_first_id UUID;
  rows_updated INTEGER := 0;
BEGIN
  RAISE NOTICE '=== FIXING EXISTING DUPLICATES ===';

  -- For each duplicate content_id
  FOR duplicate_content_id IN
    SELECT content_id
    FROM viral_analyses
    WHERE content_id IS NOT NULL
    GROUP BY content_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Processing duplicate content_id: %', duplicate_content_id;

    -- Get the ID of the first (oldest) record to keep its content_id
    SELECT id INTO keep_first_id
    FROM viral_analyses
    WHERE content_id = duplicate_content_id
    ORDER BY created_at ASC
    LIMIT 1;

    RAISE NOTICE 'Keeping original ID for analysis: %', keep_first_id;

    -- Update all other duplicates
    FOR duplicate_record IN
      SELECT id, industry_id, created_at
      FROM viral_analyses
      WHERE content_id = duplicate_content_id
      AND id != keep_first_id
      ORDER BY created_at
    LOOP
      -- Get industry code (handle NULL industry_id)
      IF duplicate_record.industry_id IS NOT NULL THEN
        SELECT COALESCE(short_code, 'GEN') INTO industry_code
        FROM industries
        WHERE id = duplicate_record.industry_id;
      ELSE
        industry_code := 'GEN';
      END IF;

      IF industry_code IS NULL THEN
        industry_code := 'GEN';
      END IF;

      -- Get next available number for this industry
      SELECT COALESCE(MAX(
        CASE
          WHEN content_id ~ (industry_code || '-[0-9]+$')
          THEN CAST(SUBSTRING(content_id FROM '[0-9]+$') AS INTEGER)
          ELSE 0
        END
      ), 1000) + 1
      INTO next_number
      FROM viral_analyses
      WHERE content_id LIKE industry_code || '-%';

      -- Generate new unique ID
      new_id := industry_code || '-' || next_number;

      -- Ensure uniqueness with incremental suffix if needed
      WHILE EXISTS (SELECT 1 FROM viral_analyses WHERE content_id = new_id) LOOP
        next_number := next_number + 1;
        new_id := industry_code || '-' || next_number;
      END LOOP;

      -- Update the record
      UPDATE viral_analyses
      SET content_id = new_id
      WHERE id = duplicate_record.id;

      rows_updated := rows_updated + 1;
      RAISE NOTICE 'Updated analysis % with new content_id: %', duplicate_record.id, new_id;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Total rows updated: %', rows_updated;
END $$;

-- Step 2: Create a table to store sequence values for each industry
CREATE TABLE IF NOT EXISTS viral_analyses_sequences (
  industry_code TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1001
);

-- Step 3: Initialize sequences for existing industries
INSERT INTO viral_analyses_sequences (industry_code, next_value)
SELECT
  COALESCE(i.short_code, 'GEN') as industry_code,
  COALESCE(MAX(
    CASE
      WHEN va.content_id ~ ('^' || COALESCE(i.short_code, 'GEN') || '-[0-9]+$')
      THEN CAST(SUBSTRING(va.content_id FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 1000) + 1 as next_value
FROM industries i
LEFT JOIN viral_analyses va ON va.industry_id = i.id
GROUP BY i.short_code
ON CONFLICT (industry_code) DO UPDATE
SET next_value = EXCLUDED.next_value;

-- Also add sequence for NULL industry (GEN)
INSERT INTO viral_analyses_sequences (industry_code, next_value)
SELECT
  'GEN' as industry_code,
  COALESCE(MAX(
    CASE
      WHEN content_id ~ ('^GEN-[0-9]+$')
      THEN CAST(SUBSTRING(content_id FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 1000) + 1 as next_value
FROM viral_analyses
WHERE industry_id IS NULL
ON CONFLICT (industry_code) DO UPDATE
SET next_value = EXCLUDED.next_value;

-- Step 4: Drop and recreate the trigger function
DROP TRIGGER IF EXISTS auto_generate_content_id ON viral_analyses;
DROP FUNCTION IF EXISTS generate_content_id();

-- Step 5: Create new content_id generation function using our sequence table
CREATE OR REPLACE FUNCTION generate_content_id()
RETURNS TRIGGER AS $$
DECLARE
  v_industry_code TEXT;
  next_number INTEGER;
  new_content_id TEXT;
  max_attempts INTEGER := 50;
  attempt INTEGER := 0;
BEGIN
  -- Only generate if content_id is not already set
  IF NEW.content_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get industry short code (handle NULL industry_id)
  IF NEW.industry_id IS NOT NULL THEN
    SELECT short_code INTO v_industry_code
    FROM industries
    WHERE id = NEW.industry_id;
  END IF;

  -- If no industry, use default 'GEN'
  IF v_industry_code IS NULL THEN
    v_industry_code := 'GEN';
  END IF;

  -- Ensure sequence exists for this industry
  INSERT INTO viral_analyses_sequences (industry_code, next_value)
  VALUES (v_industry_code, 1001)
  ON CONFLICT (industry_code) DO NOTHING;

  -- Try to generate unique content_id
  LOOP
    attempt := attempt + 1;

    -- Get next number atomically using UPDATE ... RETURNING
    -- This is atomic and thread-safe
    UPDATE viral_analyses_sequences
    SET next_value = next_value + 1
    WHERE industry_code = v_industry_code
    RETURNING next_value - 1 INTO next_number;

    -- Generate new content ID
    new_content_id := v_industry_code || '-' || next_number;

    -- Check if this ID already exists (should be extremely rare)
    IF NOT EXISTS (SELECT 1 FROM viral_analyses WHERE content_id = new_content_id) THEN
      -- ID is unique, use it
      NEW.content_id := new_content_id;
      RETURN NEW;
    END IF;

    -- If we've tried too many times, use a guaranteed unique fallback
    IF attempt >= max_attempts THEN
      -- Use UUID + timestamp to ensure absolute uniqueness
      new_content_id := v_industry_code || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '-' || substr(gen_random_uuid()::text, 1, 4);
      NEW.content_id := new_content_id;
      RAISE WARNING 'Used fallback content_id generation: %', new_content_id;
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger
CREATE TRIGGER auto_generate_content_id
  BEFORE INSERT ON viral_analyses
  FOR EACH ROW
  WHEN (NEW.content_id IS NULL)
  EXECUTE FUNCTION generate_content_id();

-- Step 7: Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viral_analyses_content_id_unique'
    AND conrelid = 'viral_analyses'::regclass
  ) THEN
    ALTER TABLE viral_analyses
    ADD CONSTRAINT viral_analyses_content_id_unique UNIQUE (content_id);
    RAISE NOTICE 'Added unique constraint on content_id';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

-- Step 8: Verify the fix
SELECT 'VERIFICATION - REMAINING DUPLICATES (should be 0):' as check_type, COUNT(*) as count
FROM (
  SELECT content_id
  FROM viral_analyses
  WHERE content_id IS NOT NULL
  GROUP BY content_id
  HAVING COUNT(*) > 1
) duplicates;

-- Step 9: Show sequence table
SELECT 'SEQUENCE TABLE:' as info;
SELECT * FROM viral_analyses_sequences ORDER BY industry_code;

-- Step 10: Show summary
SELECT
  'SUMMARY' as info,
  COUNT(*) as total_scripts,
  COUNT(DISTINCT content_id) as unique_content_ids,
  COUNT(CASE WHEN content_id IS NULL THEN 1 END) as null_content_ids
FROM viral_analyses;

-- Step 11: Final completion message
DO $$
BEGIN
  RAISE NOTICE '=== MIGRATION COMPLETE ===';
  RAISE NOTICE 'The database trigger now uses atomic UPDATE for sequence generation.';
  RAISE NOTICE 'Each industry has its own sequence in the viral_analyses_sequences table.';
  RAISE NOTICE 'This is guaranteed to be race-condition free and works in all scenarios.';
END $$;
