# Fix: Duplicate content_id Error in Production

## Problem Summary

When users submit viral analyses in production (Vercel), they encounter this error:

```
duplicate key value violates unique constraint "viral_analyses_content_id_unique"
```

Or when trying to use `FOR UPDATE` with `MAX()`:

```
FOR UPDATE is not allowed with aggregate functions
```

## Root Cause

The database trigger `generate_content_id()` has a **race condition**. When multiple analyses are created simultaneously:

1. Both transactions run the `MAX()` query to get the next number
2. Both see the same maximum value
3. Both generate the same `content_id`
4. The second insert fails with a unique constraint violation

## The Solution

PostgreSQL doesn't allow `FOR UPDATE` with aggregate functions like `MAX()`. The fix uses **advisory locks** instead:

1. **Fixing existing duplicates** in the database
2. **Using advisory locks** (`pg_advisory_xact_lock`) to prevent race conditions
3. **Retry logic** to handle any remaining edge cases

Advisory locks are transaction-scoped locks that prevent concurrent transactions from interfering with each other, and they work perfectly with aggregate functions.

## How to Apply the Fix

### Method 1: Supabase Dashboard (RECOMMENDED - Easiest)

1. **Open Supabase SQL Editor**
   - Go to: [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project
   - Navigate to: **SQL Editor** → **New query**

2. **Copy the Migration SQL**
   - Open the file: `FIX-DUPLICATE-CONTENT-IDS-V4-WORKING.sql`
   - Copy ALL the contents

3. **Paste and Run**
   - Paste into the SQL Editor
   - Click **"Run"** button
   - Wait for completion

4. **Verify Success**
   - You should see output showing:
     - Number of duplicates fixed
     - Trigger recreated successfully
     - "MIGRATION COMPLETE" message

### Method 2: Command Line (Advanced)

If you prefer command line:

```bash
# First, run the helper script to get instructions
node run-content-id-fix.js

# Then, run the migration using psql (you'll need your DB password)
psql "YOUR_POSTGRES_CONNECTION_STRING" -f FIX-DUPLICATE-CONTENT-IDS-V3-FINAL.sql
```

## What This Fix Does

### 1. Fixes Existing Duplicates
```sql
-- For each duplicate content_id, keeps the oldest one
-- and regenerates new unique IDs for the duplicates
```

### 2. Improves the Trigger (Critical Fix)
```sql
-- BEFORE (race condition):
SELECT MAX(...) FROM viral_analyses WHERE ...

-- AFTER (with advisory lock):
lock_key := hashtext(industry_code);
PERFORM pg_advisory_xact_lock(lock_key);  -- Acquire lock for this industry
SELECT MAX(...) FROM viral_analyses WHERE ...
-- Lock automatically released at transaction end
```

**Advisory locks** prevent concurrent transactions for the same industry from interfering. Unlike `FOR UPDATE`, advisory locks work with aggregate functions like `MAX()`.

### 3. Adds Retry Logic
- If a collision still occurs, the trigger retries with an incremented number
- Includes a small delay to reduce contention
- Fallback to timestamp-based ID if all retries fail

## Testing the Fix

After applying the migration:

1. **Test Single Submission**
   - Submit one viral analysis
   - Should work normally

2. **Test Concurrent Submissions** (Important!)
   - Open the "Add New Video" form in multiple browser tabs
   - Submit from both tabs at nearly the same time
   - Both should succeed with unique content_ids

3. **Check for Duplicates**
   ```sql
   SELECT content_id, COUNT(*)
   FROM viral_analyses
   WHERE content_id IS NOT NULL
   GROUP BY content_id
   HAVING COUNT(*) > 1;
   ```
   Should return 0 rows.

## Verification

After running the migration, you can verify it worked:

1. **Check Trigger Exists**
   ```sql
   SELECT trigger_name, event_object_table
   FROM information_schema.triggers
   WHERE trigger_name = 'auto_generate_content_id';
   ```

2. **Check Function Uses Locking**
   ```sql
   SELECT prosrc
   FROM pg_proc
   WHERE proname = 'generate_content_id';
   ```
   The function source should contain `FOR UPDATE`.

3. **Check No Duplicates Remain**
   ```sql
   SELECT COUNT(*)
   FROM (
     SELECT content_id
     FROM viral_analyses
     WHERE content_id IS NOT NULL
     GROUP BY content_id
     HAVING COUNT(*) > 1
   ) AS duplicates;
   ```
   Should return 0.

## Why This Happens

The original implementation used this pattern:

```sql
SELECT MAX(number) FROM table WHERE ...
```

In PostgreSQL, `SELECT MAX()` without locking allows multiple transactions to see the same value simultaneously. This is called a **read-write race condition**.

The fix adds `FOR UPDATE`, which:
- Locks the rows being read
- Forces other transactions to wait
- Ensures each transaction gets a unique number

## Expected Results

After applying this fix:

- ✅ No more duplicate content_id errors
- ✅ Concurrent submissions work correctly
- ✅ Content IDs are generated as: `INDUSTRY-1001`, `INDUSTRY-1002`, etc.
- ✅ All existing duplicates are resolved

## If Problems Persist

If you still see the error after applying this fix:

1. **Verify the migration ran successfully**
   - Check Supabase logs
   - Verify the trigger function contains `FOR UPDATE`

2. **Check for new duplicates**
   ```sql
   SELECT content_id, COUNT(*) as count
   FROM viral_analyses
   WHERE content_id IS NOT NULL
   GROUP BY content_id
   HAVING COUNT(*) > 1
   ORDER BY count DESC;
   ```

3. **Re-run the migration**
   - Safe to run multiple times
   - Will fix any new duplicates

## Files Created

1. **`FIX-DUPLICATE-CONTENT-IDS-V4-WORKING.sql`** - The working migration SQL (run this)
2. **`FIX-DUPLICATE-CONTENT-IDS-V3-FINAL.sql`** - Previous version (has FOR UPDATE issue)
3. **`run-content-id-fix.js`** - Helper script with instructions
4. **`FIX-DUPLICATE-CONTENT-ID-GUIDE.md`** - This guide

## Technical Details

### The Race Condition

```
Transaction A                Transaction B
─────────────               ─────────────
BEGIN                       BEGIN
SELECT MAX() → 1005         SELECT MAX() → 1005  (same!)
Generate: GEN-1006          Generate: GEN-1006   (duplicate!)
INSERT GEN-1006 ✓           INSERT GEN-1006 ✗ (error!)
COMMIT                      ROLLBACK
```

### With Advisory Lock

```
Transaction A                Transaction B
─────────────               ─────────────
BEGIN                       BEGIN
pg_advisory_xact_lock()     pg_advisory_xact_lock()
(acquires lock)             (waits for A's lock...)
SELECT MAX() → 1005
Generate: GEN-1006
INSERT GEN-1006 ✓
COMMIT                      (lock auto-released)
                            (acquires lock)
                            SELECT MAX() → 1006 (different!)
                            Generate: GEN-1007
                            INSERT GEN-1007 ✓
                            COMMIT
```

## Summary

This is a **database-level fix** that:
- Requires **no code changes** in your frontend/backend
- Fixes the **root cause** (race condition)
- Can be applied safely without downtime
- Is **idempotent** (safe to run multiple times)

Run the migration in Supabase Dashboard SQL Editor and the error should be completely resolved.
