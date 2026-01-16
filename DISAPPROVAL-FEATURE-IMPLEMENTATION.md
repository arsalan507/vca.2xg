# Disapproval Feature Implementation

## Overview
Added the ability for admins to **disapprove already-approved scripts** and send them back to PENDING status for revision. This is different from rejection (which happens before approval) - disapproval happens AFTER a script has been approved.

## What Changed

### 1. Database Changes
**File:** `add-disapproval-feature.sql`

Added three new fields to the `viral_analyses` table:
- `disapproval_count` (INTEGER) - Tracks how many times a script has been disapproved
- `last_disapproved_at` (TIMESTAMPTZ) - Timestamp of the most recent disapproval
- `disapproval_reason` (TEXT) - Admin's explanation for the disapproval

Created a new database function:
- `disapprove_script(analysis_uuid, reason)` - Handles the disapproval logic:
  - Changes status from APPROVED → PENDING
  - Increments disapproval counter
  - Records timestamp and reason
  - Resets production_stage to NOT_STARTED (if it was in progress)
  - Appends note to production_notes
  - Team assignments are preserved (optional: can be cleared)

Created a new view:
- `disapproved_scripts` - Easy querying of scripts that have been disapproved

### 2. Backend API
**File:** `frontend/src/services/adminService.ts`

Added new endpoint:
```typescript
disapproveScript: async (analysisId: string, reason: string) => {
  // Calls the disapprove_script database function
  // Returns the updated analysis
}
```

### 3. TypeScript Types
**File:** `frontend/src/types/index.ts`

Updated `ViralAnalysis` interface with:
```typescript
disapproval_count?: number;
last_disapproved_at?: string;
disapproval_reason?: string;
```

### 4. UI Components

#### A. DisapproveModal Component
**File:** `frontend/src/components/admin/DisapproveModal.tsx` (NEW)

A modal that:
- Shows script details (content_id, title, author)
- Displays current disapproval count
- Warns about what happens when disapproving
- Requires admin to enter a reason (mandatory)
- Shows loading state during submission

Features:
- ⚠️ Warning box explaining disapproval consequences
- 🔴 Visual indicators for previously disapproved scripts
- ✅ Validation (reason required)
- 🎨 Professional UI with icons and colors

#### B. AnalysisSideDrawer Updates
**File:** `frontend/src/components/admin/AnalysisSideDrawer.tsx`

Added:
1. Import for DisapproveModal
2. State management for disapprove modal
3. Disapprove mutation with query invalidation
4. New footer section for APPROVED scripts with "Disapprove" button
5. DisapproveModal integration

The drawer now shows:
- **For PENDING scripts:** Approve/Reject buttons (existing)
- **For APPROVED scripts:** Disapprove button (new)

#### C. NeedApprovalPage Updates
**File:** `frontend/src/pages/admin/NeedApprovalPage.tsx`

Added:
1. New query to fetch all approved scripts
2. New section "Approved Scripts" showing:
   - All approved scripts
   - Their production stage
   - Disapproval count (if any)
   - "View Details" button to open the drawer
3. AnalysisSideDrawer integration for approved scripts

## How It Works

### User Flow
1. Admin navigates to the "Review" page (`/admin/review`)
2. Scrolls to the "Approved Scripts" section
3. Clicks "View Details" on any approved script
4. Side drawer opens showing full script details
5. At the bottom, admin sees "Disapprove Script" button (orange/warning color)
6. Clicks the button → Disapprove modal opens
7. Modal shows:
   - Script info
   - Warning about what happens
   - Previous disapproval count (if any)
   - Reason input field (required)
8. Admin enters reason and clicks "Disapprove Script"
9. Script status changes to PENDING
10. Production stage resets to NOT_STARTED
11. Script writer can now revise and resubmit
12. Disapproval counter increments

### Technical Flow
```
User clicks "Disapprove"
  ↓
DisapproveModal opens
  ↓
User enters reason
  ↓
adminService.disapproveScript(id, reason) called
  ↓
Supabase RPC to disapprove_script() function
  ↓
Database updates:
  - status: APPROVED → PENDING
  - disapproval_count: +1
  - last_disapproved_at: NOW()
  - disapproval_reason: <admin's reason>
  - production_stage: → NOT_STARTED (if was in progress)
  - production_notes: Appended with disapproval note
  ↓
React Query invalidates:
  - approved-scripts
  - pending-scripts
  - pending-count
  ↓
UI refreshes automatically
  - Script moves from "Approved" to "Pending"
  - Shows disapproval count badge
```

## Visual Indicators

### Disapproval Count Badges
- **1-3 disapprovals:** Orange badge "⚠️ Disapproved Nx"
- Shows on both the script list and in the drawer
- Helps admins track problematic scripts

### Status Colors
- **PENDING:** Yellow 🟡
- **APPROVED:** Green ✅
- **REJECTED:** Red 🔴
- **DISAPPROVED (back to pending):** Shows both PENDING + disapproval count

## Database Function Details

### `disapprove_script(analysis_uuid, reason)`

**Purpose:** Atomically handle all disapproval logic

**What it does:**
1. Only affects scripts with status = 'APPROVED'
2. Changes status to 'PENDING'
3. Increments disapproval_count
4. Records timestamp and reason
5. Conditionally resets production_stage:
   - If NOT_STARTED or PRE_PRODUCTION: Keep as-is
   - Otherwise: Reset to NOT_STARTED
6. Appends formatted note to production_notes

**Security:** Uses `SECURITY DEFINER` to ensure proper permissions

**Example note added:**
```
🔴 DISAPPROVED on 2026-01-16 12:45:30
Reason: Hook doesn't match the latest brand guidelines
```

## Key Differences: Rejection vs Disapproval

| Feature | Rejection | Disapproval |
|---------|-----------|-------------|
| **When** | Before approval | After approval |
| **From Status** | PENDING | APPROVED |
| **To Status** | REJECTED | PENDING |
| **Counter Field** | rejection_count | disapproval_count |
| **Use Case** | Script not good enough | Found issue after approval |
| **Dissolution** | 5 rejections = dissolved | No dissolution limit |
| **Team Assignment** | N/A (not assigned yet) | Preserved |
| **Production Stage** | N/A | Reset to NOT_STARTED |

## Testing Checklist

- [ ] Run the SQL migration: `add-disapproval-feature.sql`
- [ ] Verify new columns exist in `viral_analyses` table
- [ ] Verify `disapprove_script()` function exists
- [ ] Verify `disapproved_scripts` view exists
- [ ] Navigate to `/admin/review`
- [ ] Check "Approved Scripts" section loads
- [ ] Click "View Details" on an approved script
- [ ] Verify "Disapprove Script" button appears
- [ ] Click button and verify modal opens
- [ ] Try submitting without reason (should be blocked)
- [ ] Enter reason and submit
- [ ] Verify script moves to PENDING
- [ ] Verify disapproval_count increments
- [ ] Verify production_stage resets
- [ ] Disapprove same script again
- [ ] Verify counter shows "Disapproved 2x"
- [ ] Check production_notes for disapproval history

## SQL Migration Instructions

### Option 1: Via Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy contents of `add-disapproval-feature.sql`
5. Paste and run

### Option 2: Via psql
```bash
psql -h your-db-host -U postgres -d postgres < add-disapproval-feature.sql
```

### Verification Queries
```sql
-- Check new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'viral_analyses'
AND column_name IN ('disapproval_count', 'last_disapproved_at', 'disapproval_reason');

-- Check function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'disapprove_script';

-- Check view exists
SELECT table_name
FROM information_schema.views
WHERE table_name = 'disapproved_scripts';

-- Test the view
SELECT * FROM disapproved_scripts LIMIT 5;
```

## Files Modified

### New Files
1. `add-disapproval-feature.sql` - Database migration
2. `frontend/src/components/admin/DisapproveModal.tsx` - Disapproval modal component

### Modified Files
1. `frontend/src/services/adminService.ts` - Added disapproveScript endpoint
2. `frontend/src/types/index.ts` - Added disapproval fields to ViralAnalysis type
3. `frontend/src/components/admin/AnalysisSideDrawer.tsx` - Added disapprove functionality
4. `frontend/src/pages/admin/NeedApprovalPage.tsx` - Added approved scripts section

## Next Steps (Optional Enhancements)

1. **Email Notifications:** Notify script writer when their approved script is disapproved
2. **Disapproval Limits:** Set a maximum number of disapprovals before script is auto-dissolved
3. **Audit Log:** Track who disapproved the script (add `disapproved_by` field)
4. **Restore Functionality:** Allow re-approving without going through full review
5. **Analytics:** Dashboard showing disapproval rates and common reasons
6. **Batch Disapproval:** Disapprove multiple scripts at once
7. **Workflow Automation:** Auto-notify team when disapproved (Slack, email, etc.)

## Support

If you encounter any issues:
1. Check browser console for errors
2. Check Supabase logs for database errors
3. Verify the SQL migration ran successfully
4. Ensure user has proper permissions (admin role)

## Rollback Instructions

If you need to rollback this feature:

```sql
-- Remove the columns
ALTER TABLE viral_analyses
DROP COLUMN IF EXISTS disapproval_count,
DROP COLUMN IF EXISTS last_disapproved_at,
DROP COLUMN IF EXISTS disapproval_reason;

-- Drop the function
DROP FUNCTION IF EXISTS disapprove_script(UUID, TEXT);

-- Drop the view
DROP VIEW IF EXISTS disapproved_scripts;
```

Then revert the code changes via git:
```bash
git checkout HEAD -- frontend/src/services/adminService.ts
git checkout HEAD -- frontend/src/types/index.ts
git checkout HEAD -- frontend/src/components/admin/AnalysisSideDrawer.tsx
git checkout HEAD -- frontend/src/pages/admin/NeedApprovalPage.tsx
rm frontend/src/components/admin/DisapproveModal.tsx
rm add-disapproval-feature.sql
```

---

**Implementation Date:** January 16, 2026
**Status:** ✅ Complete and Ready for Testing
