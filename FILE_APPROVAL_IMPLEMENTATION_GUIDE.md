# File Approval System - Implementation Guide

## Overview

Add approval/rejection functionality for production files (videos) uploaded by videographers, similar to the script review system for admins.

---

## Step 1: Run SQL to Add Database Fields

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/ckfbjsphyasborpnwbyy/sql

2. Run the SQL from `add-file-approval-system.sql`:

```sql
-- This adds 4 new fields to production_files table:
-- - approval_status (pending/approved/rejected)
-- - reviewed_by (admin who reviewed)
-- - review_notes (feedback from admin)
-- - reviewed_at (timestamp)
```

3. Verify success (should see green checkmarks)

---

## Step 2: Update TypeScript Types ✅

**Already done!** The ProductionFile interface in `frontend/src/types/index.ts` has been updated with:
- `approval_status?: 'pending' | 'approved' | 'rejected'`
- `reviewed_by?: string`
- `review_notes?: string`
- `reviewed_at?: string`
- `reviewer?: Profile`

---

## Step 3: Update Service Functions ✅

**Already done!** The `productionFilesService.ts` now has two new functions:
- `approveFile(fileId, reviewNotes?)` - Approve a file with optional notes
- `rejectFile(fileId, reviewNotes)` - Reject a file with required notes

---

## Step 4: Update Admin Dashboard UI

Open `frontend/src/pages/AdminDashboard.tsx` and make these changes:

### A. Add Mutations (after line 352, after `updateProductionStageMutation`)

```typescript
  // Approve file mutation
  const approveFileMutation = useMutation({
    mutationFn: ({ fileId, notes }: { fileId: string; notes?: string }) =>
      productionFilesService.approveFile(fileId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File approved successfully!');
    },
    onError: () => {
      toast.error('Failed to approve file');
    },
  });

  // Reject file mutation
  const rejectFileMutation = useMutation({
    mutationFn: ({ fileId, notes }: { fileId: string; notes: string }) =>
      productionFilesService.rejectFile(fileId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File rejected');
    },
    onError: () => {
      toast.error('Failed to reject file');
    },
  });
```

### B. Add Handler Functions (after the modal functions, around line 400)

```typescript
  const handleApproveFile = (fileId: string) => {
    const notes = prompt('Add approval notes (optional):');
    approveFileMutation.mutate({ fileId, notes: notes || undefined });
  };

  const handleRejectFile = (fileId: string) => {
    const notes = prompt('Why are you rejecting this file? (required)');
    if (!notes || notes.trim() === '') {
      toast.error('Rejection reason is required');
      return;
    }
    rejectFileMutation.mutate({ fileId, notes });
  };
```

### C. Replace File Display Section (around line 962-992)

Find this line:
```typescript
{productionFiles.map((file: ProductionFile) => (
```

Replace the entire file mapping section with the updated version from `admin-dashboard-approval-patch.tsx`

The updated version includes:
- ✅ Color-coded borders (green for approved, red for rejected, gray for pending)
- ✅ Status badges with icons
- ✅ Review notes display
- ✅ Approve/Reject buttons
- ✅ Disabled buttons for already approved/rejected files

---

## Step 5: Test the Feature

### As Admin:

1. Login as admin/super_admin
2. Open an analysis that has production files
3. You should see:
   - Files with "Pending Review" yellow badge
   - "Approve" (green) and "Reject" (red) buttons
   - "View" button to open the file

4. Test Approval:
   - Click "Approve" on a file
   - Optionally add notes in the prompt
   - File should turn green with "Approved" badge
   - Approve button should disappear

5. Test Rejection:
   - Click "Reject" on a file
   - Add rejection reason in the prompt (required)
   - File should turn red with "Rejected" badge
   - Reject button should disappear

6. Review Notes:
   - Should see review notes displayed below the file info
   - Should see reviewer's name

### As Videographer:

1. Login as videographer
2. Upload a new file
3. File starts with "pending" status
4. Wait for admin to approve/reject
5. See the status update in the file list

---

## Features

### File Statuses:

**Pending** (Default):
- Yellow badge with clock icon
- Both Approve and Reject buttons visible
- No review notes yet

**Approved**:
- Green background and border
- Green badge with checkmark icon
- Only Reject button visible
- Shows approval notes (if any)
- Shows who approved and when

**Rejected**:
- Red background and border
- Red badge with X icon
- Only Approve button visible
- Shows rejection notes (required)
- Shows who rejected and when

### Admin Actions:

- **Approve File**: Mark file as approved (optional notes)
- **Reject File**: Mark file as rejected (required notes explaining why)
- **View File**: Open file in new tab (Google Drive link)
- **Re-review**: Can change approval to rejection or vice versa

---

## Benefits

✅ **Quality Control**: Admin can review videos before they proceed in workflow
✅ **Feedback Loop**: Videographers get notes on what needs improvement
✅ **Workflow Management**: Only approved videos move forward in production
✅ **Accountability**: Track who approved/rejected what and when
✅ **Similar to Script Review**: Consistent approval workflow across all content

---

## Database Schema

```sql
production_files table:
├── approval_status (pending/approved/rejected) - Default: pending
├── reviewed_by (UUID) - References profiles(id)
├── review_notes (TEXT) - Feedback from admin
└── reviewed_at (TIMESTAMPTZ) - When reviewed
```

---

## API Endpoints

### Approve File:
```typescript
productionFilesService.approveFile(fileId, reviewNotes?)
// Sets approval_status = 'approved'
// Sets reviewed_by = current user
// Sets reviewed_at = now
```

### Reject File:
```typescript
productionFilesService.rejectFile(fileId, reviewNotes)
// Sets approval_status = 'rejected'
// Sets reviewed_by = current user
// Sets reviewed_at = now
// reviewNotes is required
```

---

## Next Steps

After implementing this:

1. ✅ Test with a few files
2. Consider adding notifications when files are approved/rejected
3. Consider adding approval required before advancing production stage
4. Add bulk approve/reject for multiple files
5. Add file version history (if file is rejected and re-uploaded)

---

## Summary Checklist

- [ ] Run `add-file-approval-system.sql` in Supabase
- [ ] TypeScript types updated (already done ✅)
- [ ] Service functions added (already done ✅)
- [ ] Admin Dashboard mutations added
- [ ] Admin Dashboard handlers added
- [ ] File display UI updated with approval buttons
- [ ] Test approval workflow
- [ ] Test rejection workflow
- [ ] Verify review notes display correctly

---

**Ready to go!** The file approval system works just like script reviews, giving admins full control over video quality in the production pipeline.
