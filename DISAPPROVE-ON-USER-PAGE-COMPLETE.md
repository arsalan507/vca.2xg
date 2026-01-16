# Disapprove Button Added to User Analysis Page

## ✅ Implementation Complete

I've successfully added the **disapprove functionality** to the user-specific analysis page at:
```
http://localhost:5173/admin/analyses/by-user/:userId
```

## What Was Changed

### 1. **AnalysisTablePage.tsx** Updates

Added disapprove mutation and handler:

```typescript
// New disapprove mutation
const disapproveMutation = useMutation({
  mutationFn: (data: { id: string; reason: string }) =>
    adminService.disapproveScript(data.id, data.reason),
  onSuccess: () => {
    // Invalidates all relevant queries
    queryClient.invalidateQueries({ queryKey: ['admin', 'analyses-table'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'approved-scripts'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
    toast.success('Script disapproved and sent back to pending');
    setIsDrawerOpen(false);
    setSelectedAnalysis(null);
  },
  onError: (error: any) => {
    toast.error(error.message || 'Failed to disapprove script');
  },
});

// New handler function
const handleDisapprove = (reason: string) => {
  if (!selectedAnalysis) return;
  disapproveMutation.mutate({ id: selectedAnalysis.id, reason });
};
```

Passed to the drawer:
```typescript
<AnalysisSideDrawer
  analysis={selectedAnalysis}
  isOpen={isDrawerOpen}
  onClose={...}
  onApprove={handleApprove}
  onReject={handleReject}
  onDisapprove={handleDisapprove}  // ← NEW
  isSubmitting={approveMutation.isPending || rejectMutation.isPending || disapproveMutation.isPending}
/>
```

### 2. **AnalysisSideDrawer.tsx** Updates

Added missing import:
```typescript
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
```

The drawer already had the disapprove UI (lines 926-987), it just needed:
- The `onDisapprove` prop to be passed from the parent
- The `ExclamationTriangleIcon` import

## How It Works Now

### User Journey:

1. **Admin navigates to user's analyses:**
   ```
   http://localhost:5173/admin/analyses/by-user/fc30aec3-d4c9-4663-9365-10b0222aea9d
   ```

2. **Filter by status (optional):**
   - Click "Approved" tab to see only approved scripts

3. **Click on an approved script** to open the side drawer

4. **Disapprove button appears:**
   - At the bottom of the drawer
   - Orange color with warning icon
   - Info message: "This script is already approved. You can disapprove it to send it back for revision."

5. **Click "Disapprove Script":**
   - Expands to show:
     - Warning about what will happen
     - Text area for reason (required)
     - Cancel / Confirm buttons

6. **Enter reason and confirm:**
   - Script status: APPROVED → PENDING
   - Production stage: Resets to NOT_STARTED
   - Disapproval counter: +1
   - Toast notification: "Script disapproved and sent back to pending"
   - Drawer closes
   - Table refreshes showing updated status

### Visual Flow:

```
┌─────────────────────────────────────┐
│  User Analyses Page                 │
│  /admin/analyses/by-user/:userId    │
│                                     │
│  [All] [Pending] [Approved] [Rejected]
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Script 1 - APPROVED         │   │
│  │ Script 2 - APPROVED    ← Click
│  │ Script 3 - PENDING          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Side Drawer Opens                  │
│  ┌───────────────────────────────┐ │
│  │ Script Details                │ │
│  │ - Content ID: BCH-1001        │ │
│  │ - Status: APPROVED ✅         │ │
│  │ - Hook: ...                   │ │
│  │                               │ │
│  │ [Scroll down]                 │ │
│  │                               │ │
│  │ ℹ️ This script is already     │ │
│  │ approved. You can disapprove  │ │
│  │ it to send back for revision. │ │
│  │                               │ │
│  │ ┌─────────────────────────┐  │ │
│  │ │ 🔸 Disapprove Script    │  │ │
│  │ └─────────────────────────┘  │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Disapprove Form Expands            │
│  ┌───────────────────────────────┐ │
│  │ ⚠️ Disapproving will:          │ │
│  │ • Change status to PENDING    │ │
│  │ • Reset production stage      │ │
│  │ • Allow script writer to edit │ │
│  │                               │ │
│  │ Reason (required):            │ │
│  │ ┌─────────────────────────┐  │ │
│  │ │ Hook needs refinement... │  │ │
│  │ └─────────────────────────┘  │ │
│  │                               │ │
│  │ [Cancel] [Confirm Disapprove] │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Success!                           │
│  ✅ Script disapproved and sent     │
│     back to pending                 │
│                                     │
│  Table auto-refreshes:              │
│  ┌─────────────────────────────┐   │
│  │ Script 1 - APPROVED         │   │
│  │ Script 2 - PENDING ⚠️ 1x    │   │
│  │ Script 3 - PENDING          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Features

### ✅ For APPROVED Scripts:
- **Disapprove Button** appears in drawer
- **Warning message** about consequences
- **Required reason** field
- **Confirmation step** to prevent accidents
- **Real-time updates** after disapproval

### ✅ For PENDING Scripts:
- **Approve Button** (quick approve with default scores)
- **Reject Button** (with required feedback)

### ✅ Data Management:
- **Auto-refresh** all relevant queries:
  - `admin/analyses-table` (current page)
  - `admin/pending-scripts` (review page)
  - `admin/approved-scripts` (review page)
  - `admin/pending-count` (badges/counters)

### ✅ User Feedback:
- **Toast notifications** for success/error
- **Loading states** during submission
- **Disabled states** when reason is empty
- **Visual warnings** about what will happen

## Testing

### Test Scenario 1: Disapprove an Approved Script

1. Go to: `http://localhost:5173/admin/analyses/by-user/:userId`
2. Click "Approved" tab
3. Click on any approved script
4. Scroll to bottom of drawer
5. Click "Disapprove Script"
6. Enter reason: "Hook needs to be more specific"
7. Click "Confirm Disapprove"
8. ✅ Verify: Toast shows success message
9. ✅ Verify: Drawer closes
10. ✅ Verify: Script now shows as PENDING with "⚠️ Disapproved 1x" badge

### Test Scenario 2: Cancel Disapproval

1. Open an approved script
2. Click "Disapprove Script"
3. Click "Cancel"
4. ✅ Verify: Form collapses, no action taken

### Test Scenario 3: Validation

1. Open an approved script
2. Click "Disapprove Script"
3. Try to submit without entering reason
4. ✅ Verify: Button is disabled

### Test Scenario 4: Multiple Disapprovals

1. Disapprove a script once
2. Approve it again (from pending)
3. Disapprove it a second time
4. ✅ Verify: Badge shows "⚠️ Disapproved 2x"

## Database Impact

When you disapprove a script:

```sql
-- Status changes
status: 'APPROVED' → 'PENDING'

-- Counters increment
disapproval_count: disapproval_count + 1

-- Timestamps update
last_disapproved_at: NOW()
updated_at: NOW()

-- Reason stored
disapproval_reason: 'Your reason here'

-- Production stage resets
production_stage:
  IF currently 'NOT_STARTED' or 'PRE_PRODUCTION' → unchanged
  ELSE → 'NOT_STARTED'

-- Production notes appended
production_notes: production_notes + '\n\n🔴 DISAPPROVED on [timestamp]\nReason: [reason]'

-- Team assignments preserved
videographer_id, editor_id, posting_manager_id: unchanged
```

## Files Modified

1. **frontend/src/pages/admin/AnalysisTablePage.tsx**
   - Added `disapproveMutation`
   - Added `handleDisapprove` function
   - Passed `onDisapprove` to drawer
   - Updated `isSubmitting` to include disapprove state

2. **frontend/src/components/admin/AnalysisSideDrawer.tsx**
   - Added `ExclamationTriangleIcon` import
   - UI already existed (from previous implementation)

## Already Implemented (From Earlier)

These were already completed in the previous implementation:

- ✅ Database migration (`add-disapproval-feature.sql`)
- ✅ Database fields (`disapproval_count`, `last_disapproved_at`, `disapproval_reason`)
- ✅ Database function (`disapprove_script()`)
- ✅ Database view (`disapproved_scripts`)
- ✅ Backend API endpoint (`adminService.disapproveScript()`)
- ✅ TypeScript types (`ViralAnalysis` interface)
- ✅ DisapproveModal component
- ✅ AnalysisSideDrawer UI for disapprove
- ✅ NeedApprovalPage integration

## Status

🎉 **FULLY IMPLEMENTED AND READY TO USE**

The disapprove button now appears on:
1. ✅ `/admin/review` - Review page (approved scripts section)
2. ✅ `/admin/analyses/by-user/:userId` - User-specific analyses page

Both pages use the same `AnalysisSideDrawer` component, so the functionality is consistent across the admin panel.

---

**Implementation Date:** January 16, 2026
**Status:** ✅ Complete and Live
