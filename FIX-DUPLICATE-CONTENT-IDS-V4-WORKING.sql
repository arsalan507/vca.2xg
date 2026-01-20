-- ========================================
-- FIX DUPLICATE CONTENT_IDS - V4 WORKING FIX
-- ========================================
-- This version uses advisory locks instead of FOR UPDATE with aggregates
-- PostgreSQL doesn't allow FOR UPDATE with aggregate functions like MAX()

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

-- Step 2: Drop and recreate the trigger function
DROP TRIGGER IF EXISTS auto_generate_content_id ON viral_analyses;
DROP FUNCTION IF EXISTS generate_content_id();

-- Step 3: Create improved content_id generation function using advisory locks
-- Advisory locks work across transactions and don't conflict with aggregate functions
CREATE OR REPLACE FUNCTION generate_content_id()
RETURNS TRIGGER AS $$
DECLARE
  industry_code TEXT;
  next_number INTEGER;
  new_content_id TEXT;
  max_attempts INTEGER := 100;
  attempt INTEGER := 0;
  lock_key BIGINT;
BEGIN
  -- Only generate if content_id is not already set
  IF NEW.content_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get industry short code (handle NULL industry_id)
  IF NEW.industry_id IS NOT NULL THEN
    SELECT short_code INTO industry_code
    FROM industries
    WHERE id = NEW.industry_id;
  END IF;

  -- If no industry, use default 'GEN'
  IF industry_code IS NULL THEN
    industry_code := 'GEN';
  END IF;

  -- Create a unique lock key based on industry code
  -- This prevents concurrent inserts for the same industry from racing
  lock_key := hashtext(industry_code);

  -- Acquire advisory lock for this industry
  -- This is the critical fix - prevents concurrent transactions from interfering
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Try to generate unique content_id with retry logic
  LOOP
    attempt := attempt + 1;

    -- Get next number for this industry
    -- Now safe because we have an advisory lock
    SELECT COALESCE(MAX(
      CASE
        WHEN content_id ~ ('^' || industry_code || '-[0-9]+$')
        THEN CAST(SUBSTRING(content_id FROM '[0-9]+$') AS INTEGER)
        ELSE 0
      END
    ), 1000) + 1
    INTO next_number
    FROM viral_analyses
    WHERE content_id LIKE industry_code || '-%';

    -- Generate new content ID
    new_content_id := industry_code || '-' || next_number;

    -- Check if this ID already exists (double-check)
    IF NOT EXISTS (SELECT 1 FROM viral_analyses WHERE content_id = new_content_id) THEN
      -- ID is unique, use it
      NEW.content_id := new_content_id;
      -- Advisory lock is automatically released at transaction end
      RETURN NEW;
    END IF;

    -- If we've tried too many times, use a guaranteed unique fallback
    IF attempt >= max_attempts THEN
      -- Use UUID + timestamp to ensure absolute uniqueness
      new_content_id := industry_code || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '-' || substr(gen_random_uuid()::text, 1, 4);
      NEW.content_id := new_content_id;
      RAISE WARNING 'Used fallback content_id generation: %', new_content_id;
      RETURN NEW;
    END IF;

    -- Small delay to reduce contention (unlikely to be needed with advisory lock)
    PERFORM pg_sleep(0.001 * attempt);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
CREATE TRIGGER auto_generate_content_id
  BEFORE INSERT ON viral_analyses
  FOR EACH ROW
  WHEN (NEW.content_id IS NULL)
  EXECUTE FUNCTION generate_content_id();

-- Step 5: Ensure unique constraint exists
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

-- Step 6: Verify the fix
SELECT 'VERIFICATION - REMAINING DUPLICATES (should be 0):' as check_type, COUNT(*) as count
FROM (
  SELECT content_id
  FROM viral_analyses
  WHERE content_id IS NOT NULL
  GROUP BY content_id
  HAVING COUNT(*) > 1
) duplicates;

-- Step 7: Show summary
SELECT
  'SUMMARY' as info,
  COUNT(*) as total_scripts,
  COUNT(DISTINCT content_id) as unique_content_ids,
  COUNT(CASE WHEN content_id IS NULL THEN 1 END) as null_content_ids
FROM viral_analyses;

-- Step 8: Final completion message
DO $$
BEGIN
  RAISE NOTICE '=== MIGRATION COMPLETE ===';
  RAISE NOTICE 'The database trigger now uses advisory locks to prevent race conditions.';
  RAISE NOTICE 'Advisory locks work with aggregate functions and prevent concurrent inserts.';
  RAISE NOTICE 'This should eliminate the duplicate content_id error.';
END $$;
