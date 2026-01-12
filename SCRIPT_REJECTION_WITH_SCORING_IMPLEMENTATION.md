# Script Rejection with Scoring - Implementation Complete

## Summary

Successfully implemented a comprehensive script rejection system with scoring feedback. When an admin clicks "Reject", they now get a detailed modal to provide scores and feedback before rejecting the script.

## What Was Implemented

### 1. Reject Script Modal Component

**File:** [frontend/src/components/RejectScriptModal.tsx](frontend/src/components/RejectScriptModal.tsx)

A full-featured modal component with:

#### Key Features:
- **Script Information Display** - Shows content ID, hook, creator name
- **Rejection Counter Warning** - Shows how many times the script has been rejected
- **Final Rejection Warning** - Red alert box when script has been rejected 4 times (5th rejection = dissolution)
- **Required Feedback Textarea** - Admin must explain rejection reason
- **Four Review Scores** with interactive sliders (1-10 scale):
  - Hook Strength
  - Content Quality
  - Viral Potential
  - Replication Clarity
- **Real-time Average Score** - Calculates overall average dynamically
- **Loading States** - Shows spinner during submission
- **Form Validation** - Cannot submit without feedback

#### Visual Design:
```typescript
// Header
- Red-to-pink gradient background
- Large X-circle icon
- White text with subtitle

// Rejection Warning (when count >= 4)
- Red bordered box
- Warning icon
- Bold text: "FINAL REJECTION - PROJECT WILL BE DISSOLVED"
- Explanation of consequences

// Review Scores
- 4 interactive score inputs using ReviewScoreInput component
- Each score has label, description, and 1-10 range slider
- Color-coded: red (1-3), yellow (4-6), green (7-10)
- Average score displayed prominently

// Action Buttons
- Gray "Cancel" button
- Red "Reject Script" button with icon
- Loading spinner on submission
```

### 2. Updated NeedApprovalPage

**File:** [frontend/src/pages/admin/NeedApprovalPage.tsx](frontend/src/pages/admin/NeedApprovalPage.tsx)

#### Added State Management (Line 30)
```typescript
const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
```

#### Updated Reject Button Handler (Lines 315-317)
```typescript
onClick={() => {
  setSelectedScript(script);
  setIsRejectModalOpen(true);
}}
```

Previously only set `selectedScript`, now also opens the rejection modal.

#### Added handleRejectScript Function (Lines 179-204)
```typescript
const handleRejectScript = async (data: {
  status: 'REJECTED';
  feedback: string;
  hookStrength: number;
  contentQuality: number;
  viralPotential: number;
  replicationClarity: number;
}) => {
  if (!selectedScript) return;

  try {
    await reviewScriptMutation.mutateAsync({
      id: selectedScript.id,
      reviewData: {
        status: data.status,
        feedback: data.feedback,
        hookStrength: data.hookStrength,
        contentQuality: data.contentQuality,
        viralPotential: data.viralPotential,
        replicationClarity: data.replicationClarity,
      },
    });

    toast.success('Script rejected successfully');
    setIsRejectModalOpen(false);
    setSelectedScript(null);
  } catch (error) {
    toast.error('Failed to reject script');
    console.error(error);
  }
};
```

#### Added RejectScriptModal Component (Lines 535-544)
```typescript
<RejectScriptModal
  script={selectedScript}
  isOpen={isRejectModalOpen}
  onClose={() => {
    setIsRejectModalOpen(false);
    setSelectedScript(null);
  }}
  onReject={handleRejectScript}
  isLoading={reviewScriptMutation.isPending}
/>
```

#### Added Import Statement (Line 16)
```typescript
import RejectScriptModal from '@/components/RejectScriptModal';
```

### 3. Reused Existing Components

**File:** [frontend/src/components/ReviewScoreInput.tsx](frontend/src/components/ReviewScoreInput.tsx)

Already existed! This component provides:
- Interactive score buttons (1-10)
- Color-coded feedback (red/yellow/green)
- Hover effects
- Selected score ring indicator
- Large score display

## How It Works

### User Flow

1. **Admin views "Need Approval" page**
   - Sees list of pending scripts
   - Each script shows:
     - Content ID
     - Hook text
     - Creator name
     - Rejection count badge (if > 0)
     - Warning badge if rejected 4+ times

2. **Admin clicks "Reject" button**
   - `RejectScriptModal` opens
   - Modal shows script details
   - If rejection count >= 4, shows red warning box about dissolution

3. **Admin provides feedback**
   - Enters rejection reason in textarea (required)
   - Adjusts 4 review scores using sliders
   - Sees real-time average score calculation

4. **Admin submits rejection**
   - Validation: Feedback must not be empty
   - Calls `handleRejectScript()` function
   - Sends rejection data to backend via `reviewScriptMutation`
   - Backend:
     - Updates analysis status to 'REJECTED'
     - Increments rejection counter
     - Saves feedback and scores
     - If rejection count reaches 5, triggers auto-dissolution

5. **Success feedback**
   - Toast notification: "Script rejected successfully"
   - Modal closes
   - Scripts list refreshes
   - Rejected script moves out of "Need Approval"

### Auto-Dissolution Logic (Backend)

When rejection count reaches 5:
```sql
-- Database trigger: check_rejection_dissolution()
IF NEW.rejection_count >= 5 AND NEW.status = 'REJECTED' THEN
  NEW.is_dissolved := TRUE;
  NEW.dissolution_reason := 'Script rejected 5 times - project automatically dissolved';
END IF;
```

## Visual Warnings

### Rejection Count Badge (in script list)
```typescript
{script.rejection_count > 0 && (
  <span className={
    script.rejection_count >= 4
      ? 'bg-red-100 text-red-800 border-red-300' // Final warning
      : 'bg-orange-100 text-orange-800'          // Normal warning
  }>
    🚨 Rejected {script.rejection_count}x
    {script.rejection_count >= 4 && '(Warning: 1 more = dissolved)'}
  </span>
)}
```

### Dissolution Warning (in reject modal)
```typescript
{script.rejection_count >= 4 && (
  <div className="bg-red-50 border-2 border-red-300">
    <XCircleIcon className="text-red-600" />
    <h3>FINAL REJECTION - PROJECT WILL BE DISSOLVED</h3>
    <p>
      This script has been rejected {script.rejection_count} times.
      Rejecting again will dissolve the project permanently.
    </p>
  </div>
)}
```

## Benefits

✅ **Structured Feedback** - Forces admin to provide detailed, actionable feedback

✅ **Quantitative Scores** - Creators get specific scores to understand weak areas

✅ **Prevents Accidental Rejection** - Modal requires explicit confirmation

✅ **Dissolution Awareness** - Clear warnings before final rejection

✅ **Better Communication** - Scores + written feedback = clearer guidance

✅ **Data for Analytics** - Scores can be used to analyze common rejection reasons

## Testing Checklist

- [ ] Login as Admin
- [ ] Navigate to "Need Approval" page
- [ ] Find a script with 0 rejections
- [ ] Click "Reject" button
  - [ ] Modal opens correctly
  - [ ] Script info displays
  - [ ] No dissolution warning shows
- [ ] Try to submit without feedback
  - [ ] Should fail validation
- [ ] Add feedback and adjust scores
  - [ ] Average score updates in real-time
  - [ ] Sliders work smoothly
- [ ] Click "Cancel"
  - [ ] Modal closes without submitting
- [ ] Click "Reject" again and submit
  - [ ] Shows loading spinner
  - [ ] Success toast appears
  - [ ] Modal closes
  - [ ] Script moves out of "Need Approval"
- [ ] Find a script rejected 4 times
  - [ ] Click "Reject"
  - [ ] Should show red dissolution warning
  - [ ] Submit rejection
  - [ ] Verify project is dissolved in database

## Database Impact

Uses existing database function:
- `increment_rejection_counter(analysis_uuid)` - Increments rejection count
- `check_rejection_dissolution()` - Trigger that auto-dissolves at 5 rejections

## Related Files

- ✅ [frontend/src/components/RejectScriptModal.tsx](frontend/src/components/RejectScriptModal.tsx) - NEW: Rejection modal
- ✅ [frontend/src/pages/admin/NeedApprovalPage.tsx](frontend/src/pages/admin/NeedApprovalPage.tsx) - Updated to use modal
- ✅ [frontend/src/components/ReviewScoreInput.tsx](frontend/src/components/ReviewScoreInput.tsx) - Existing score input component
- ✅ [frontend/src/services/adminService.ts](frontend/src/services/adminService.ts) - Backend rejection logic
- ✅ [simple-rejection-counter-fix.sql](simple-rejection-counter-fix.sql) - Database schema

## Status

🎉 **COMPLETE** - Script rejection now includes detailed scoring and feedback modal!

## Next Steps (Optional Enhancements)

- [ ] Add voice note recording for feedback (field already exists in data type)
- [ ] Show rejection history in modal (list previous rejection reasons)
- [ ] Add "Quick Rejection Reasons" dropdown for common issues
- [ ] Export rejection analytics (most common score distributions)
- [ ] Email notification to creator with scores and feedback
