# Quick Fix Guide - Rejection Counter & Multiple Files

## Error You Encountered

```
ERROR: column "file_id" of relation "production_files" does not exist
```

**Cause:** The `production_files` table already exists in your database but is missing the `file_id` column that the new schema requires.

---

## Solution: Run the Fixed Migration

### Step 1: Run the Corrected Migration

Open Supabase SQL Editor and run this file:

```bash
fix-production-files-schema.sql
```

**What it does:**
- ✅ Adds missing columns to existing `production_files` table
- ✅ Adds rejection counter fields to `viral_analyses`
- ✅ Creates auto-dissolution trigger (5 rejections = dissolved)
- ✅ Updates RLS policies
- ✅ Migrates existing file URLs
- ✅ No data loss - works with existing tables

---

## What Gets Added

### To `viral_analyses` Table
```sql
rejection_count INTEGER DEFAULT 0
is_dissolved BOOLEAN DEFAULT FALSE
dissolution_reason TEXT
```

### To `production_files` Table
```sql
file_id TEXT NOT NULL           -- Google Drive or Supabase file ID
uploaded_at TIMESTAMP           -- When file was uploaded
is_deleted BOOLEAN DEFAULT FALSE -- Soft delete flag
deleted_at TIMESTAMP            -- When file was deleted
```

---

## Verification Steps

### 1. Check Columns Were Added

```sql
-- Check viral_analyses
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'viral_analyses'
AND column_name IN ('rejection_count', 'is_dissolved', 'dissolution_reason');

-- Check production_files
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'production_files'
AND column_name IN ('file_id', 'uploaded_at', 'is_deleted', 'deleted_at');
```

### 2. Verify Functions Exist

```sql
-- Check increment function
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'increment_rejection_counter';

-- Check trigger function
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_check_rejection_dissolution';
```

### 3. Test Rejection Counter

```sql
-- Create a test script
INSERT INTO viral_analyses (user_id, reference_url, hook, target_emotion, expected_outcome, status)
VALUES (
  auth.uid(),
  'https://example.com/test',
  'Test Hook',
  'Curiosity',
  'Test Outcome',
  'PENDING'
)
RETURNING id;

-- Reject it 5 times (replace 'YOUR-TEST-ID' with actual ID)
SELECT increment_rejection_counter('YOUR-TEST-ID');
SELECT increment_rejection_counter('YOUR-TEST-ID');
SELECT increment_rejection_counter('YOUR-TEST-ID');
SELECT increment_rejection_counter('YOUR-TEST-ID');
SELECT increment_rejection_counter('YOUR-TEST-ID');

-- Check if dissolved
SELECT rejection_count, is_dissolved, dissolution_reason
FROM viral_analyses
WHERE id = 'YOUR-TEST-ID';

-- Should show:
-- rejection_count: 5
-- is_dissolved: TRUE
-- dissolution_reason: 'Script rejected 5 times - project automatically dissolved'
```

---

## Frontend Changes Already Made

All frontend code has been updated:

### 1. TypeScript Types
- ✅ `ViralAnalysis` interface includes `rejection_count`, `is_dissolved`, `dissolution_reason`
- ✅ `ProductionFile` interface matches new schema

### 2. Services
- ✅ `adminService.reviewAnalysis()` increments rejection counter on rejection
- ✅ `productionFilesService` handles multiple file uploads with new schema

### 3. UI Components
- ✅ Admin UI shows rejection count badges (orange for 1-3, red for 4+)
- ✅ Warning message at 4 rejections: "(Warning: 1 more = dissolved)"
- ✅ VideographerDashboard supports multiple file uploads
- ✅ EditorDashboard supports multiple file uploads

---

## Testing Checklist

After running the migration:

### Rejection Counter Tests

- [ ] Open Admin Dashboard → Need Approval
- [ ] Select a pending script
- [ ] Reject it with feedback
- [ ] Verify rejection count badge appears (orange)
- [ ] Reject again (3 more times total)
- [ ] At 4 rejections, badge turns red with warning
- [ ] Reject 5th time
- [ ] Verify `is_dissolved = TRUE` in database
- [ ] Verify project no longer appears in active assignments

### Multiple File Upload Tests

- [ ] Login as Videographer
- [ ] Open assigned project
- [ ] Upload 3 different raw footage files
- [ ] All 3 files appear in list
- [ ] Each file shows name, size, upload time
- [ ] Delete one file (soft delete - hidden but preserved)
- [ ] Submit for review
- [ ] Login as Admin
- [ ] View shoot review
- [ ] See all 3 uploaded files
- [ ] Approve or reject shoot

---

## Rollback (If Needed)

If something goes wrong, you can rollback the changes:

```sql
-- Remove new columns from viral_analyses
ALTER TABLE viral_analyses
DROP COLUMN IF EXISTS rejection_count,
DROP COLUMN IF EXISTS is_dissolved,
DROP COLUMN IF EXISTS dissolution_reason;

-- Remove new columns from production_files
ALTER TABLE production_files
DROP COLUMN IF EXISTS file_id,
DROP COLUMN IF EXISTS uploaded_at,
DROP COLUMN IF EXISTS is_deleted,
DROP COLUMN IF EXISTS deleted_at;

-- Remove trigger
DROP TRIGGER IF EXISTS trigger_check_rejection_dissolution ON viral_analyses;
DROP FUNCTION IF EXISTS check_rejection_dissolution();
DROP FUNCTION IF EXISTS increment_rejection_counter(UUID);

-- Remove view
DROP VIEW IF EXISTS active_projects;
```

---

## Common Issues

### Issue: "column file_id cannot be null"

**Solution:** The migration automatically populates `file_id` from `file_url` for existing records. If you see this error, run:

```sql
UPDATE production_files
SET file_id = file_url
WHERE file_id IS NULL;
```

### Issue: "permission denied for table production_files"

**Solution:** RLS policies may be blocking access. Temporarily disable to debug:

```sql
ALTER TABLE production_files DISABLE ROW LEVEL SECURITY;
-- Run your query
ALTER TABLE production_files ENABLE ROW LEVEL SECURITY;
```

### Issue: "function increment_rejection_counter already exists"

**Solution:** The migration uses `CREATE OR REPLACE FUNCTION` so it should work. If not:

```sql
DROP FUNCTION IF EXISTS increment_rejection_counter(UUID);
-- Then re-run the migration
```

---

## What Changed from Original Migration

**Original File:** `add-rejection-counter-and-files.sql` (had errors)
**Fixed File:** `fix-production-files-schema.sql` (works with existing tables)

**Key Differences:**

1. **Doesn't recreate production_files table** - adds missing columns instead
2. **Populates file_id from file_url** - for existing records
3. **Prevents duplicate data** - checks before migrating legacy URLs
4. **Drops old policies first** - avoids conflicts
5. **Better error handling** - uses IF NOT EXISTS, IF EXISTS

---

## Success Indicators

You'll know the migration succeeded when you see:

```
✅ Migration completed successfully!

✅ Added rejection tracking to viral_analyses:
   - rejection_count (tracks rejections)
   - is_dissolved (auto-set after 5 rejections)
   - dissolution_reason (explains why dissolved)

✅ Updated production_files table:
   - Added file_id column
   - Added uploaded_at timestamp
   - Added is_deleted for soft deletes
   - Added deleted_at timestamp

✅ Created database functions:
   - increment_rejection_counter() - safely increments counter
   - check_rejection_dissolution() - auto-dissolves after 5 rejections

✅ Updated RLS policies for production_files
✅ Created indexes for performance
✅ Migrated legacy file URLs

🎉 Your workflow is now complete!
```

---

## Support

If you encounter any issues:

1. **Check Supabase logs** for detailed error messages
2. **Run verification queries** from Step 1 above
3. **Check RLS policies** if you get permission errors
4. **Review the migration output** for warnings

---

## Summary

**Before Migration:**
- ❌ No rejection counter
- ❌ Projects could be rejected infinitely
- ❌ production_files missing file_id column
- ❌ No soft delete support

**After Migration:**
- ✅ Rejection counter tracks rejections
- ✅ Auto-dissolution after 5 rejections
- ✅ production_files has all needed columns
- ✅ Soft delete preserves file history
- ✅ Multiple file uploads supported
- ✅ Workflow diagram 100% implemented

🚀 **Ready to test!**
