# Admin Portal: Toast Message Fix

## Issue

When admin clicks the "Reject" or "Request Reshoot" button for shoot reviews, the success message incorrectly shows:
> "Shoot approved! Moving to editing stage."

This is confusing because the admin rejected the shoot, not approved it.

Same issue occurs for edit reviews:
> "Edit approved! Moving to final review." (shown when requesting revision)

## Root Cause

The mutation success handler (`onSuccess`) was not checking what action was actually performed. It always showed the approval message regardless of whether the admin approved or rejected.

## Solution

Updated both `approveShootMutation` and `approveEditMutation` to check the `production_stage` in the mutation variables and show the appropriate message:

### Shoot Review Messages
- **Approved (EDITING)**: "Shoot approved! Moving to editing stage."
- **Rejected (SHOOTING)**: "Reshoot requested. Videographer has been notified."

### Edit Review Messages
- **Approved (FINAL_REVIEW)**: "Edit approved! Moving to final review."
- **Rejected (EDITING)**: "Revision requested. Editor has been notified."

## Code Changes

### File: [frontend/src/pages/admin/NeedApprovalPage.tsx](frontend/src/pages/admin/NeedApprovalPage.tsx)

**Before:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['admin', 'shoot-reviews'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
  toast.success('Shoot approved! Moving to editing stage.');
  setSelectedShoot(null);
}
```

**After:**
```typescript
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['admin', 'shoot-reviews'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });

  // Show appropriate message based on the stage transition
  if (variables.production_stage === 'EDITING') {
    toast.success('Shoot approved! Moving to editing stage.');
  } else if (variables.production_stage === 'SHOOTING') {
    toast.success('Reshoot requested. Videographer has been notified.');
  }

  setSelectedShoot(null);
}
```

## Testing

Test both approval and rejection flows:

### Shoot Review:
1. Go to Admin Dashboard → Need Approval → Shoots Awaiting Review
2. Click "View Files" on any shoot
3. Click "Approve & Move to Editing" → Should show: "Shoot approved! Moving to editing stage."
4. Click "Request Reshoot" → Should show: "Reshoot requested. Videographer has been notified."

### Edit Review:
1. Go to Admin Dashboard → Need Approval → Edits Awaiting Review
2. Click on any edit
3. Click "Approve" → Should show: "Edit approved! Moving to final review."
4. Click "Request Fix" → Should show: "Revision requested. Editor has been notified."

## Benefits

✅ **Clear feedback** - Admin knows exactly what action was taken
✅ **Accurate messages** - No more confusion between approval and rejection
✅ **Better UX** - Team members get appropriate notifications
✅ **Consistent** - Same pattern applied to both shoot and edit reviews

## Related Files

- [frontend/src/pages/admin/NeedApprovalPage.tsx](frontend/src/pages/admin/NeedApprovalPage.tsx:145-186) - Mutation handlers updated
