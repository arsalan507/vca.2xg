# Rejected Script Edit & Resubmit - Implementation Complete

## Summary

Script writers can now **edit and resubmit rejected scripts**. Previously, rejected scripts only had a "View" button. Now they have a prominent **"Revise & Resubmit"** button with clear feedback about why the script was rejected.

## Problem

When a script was rejected by the admin:
- ❌ Script writers could only **view** the rejected script
- ❌ No way to edit and resubmit the script
- ❌ Rejection feedback was hidden (only visible to admins)
- ❌ No visual indicator of rejection count or dissolution warning

## Solution

### 1. **Edit Button for Rejected Scripts** (AnalysesPage.tsx:397-409)

Updated the script card buttons to show "Revise & Resubmit" for rejected scripts:

```typescript
{(analysis.status === 'PENDING' || analysis.status === 'REJECTED') && !analysis.is_dissolved && (
  <button
    onClick={() => openModal(analysis)}
    className={`flex-1 inline-flex justify-center items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-md ${
      analysis.status === 'REJECTED'
        ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'  // RED for rejected
        : 'border-primary-300 text-primary-700 bg-primary-50 hover:bg-primary-100'  // BLUE for pending
    }`}
  >
    <PencilIcon className="h-4 w-4 mr-1" />
    {analysis.status === 'REJECTED' ? 'Revise & Resubmit' : 'Edit'}
  </button>
)}
```

**Key Features:**
- ✅ Shows for both `PENDING` and `REJECTED` scripts
- ✅ Hidden if script is dissolved (`is_dissolved === true`)
- ✅ Red-themed button for rejected scripts
- ✅ Blue-themed button for pending scripts
- ✅ Clear "Revise & Resubmit" label for rejected scripts

### 2. **Rejection Counter Badge** (AnalysesPage.tsx:357-375)

Added visual badges to show rejection status on script cards:

```typescript
<div className="flex flex-col items-end space-y-1">
  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(analysis.status)}`}>
    {analysis.status}
  </span>

  {/* Rejection Count Badge */}
  {analysis.status === 'REJECTED' && analysis.rejection_count !== undefined && analysis.rejection_count > 0 && (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
      analysis.rejection_count >= 4
        ? 'bg-red-100 text-red-800 border border-red-300'  // FINAL WARNING
        : 'bg-orange-100 text-orange-800'  // NORMAL REJECTION
    }`}>
      🔄 Rejected {analysis.rejection_count}x
    </span>
  )}

  {/* Dissolution Badge */}
  {analysis.is_dissolved && (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-600 text-white">
      ⚠️ Dissolved
    </span>
  )}
</div>
```

**Visual Feedback:**
- 🟡 **Orange badge**: "🔄 Rejected 1x" → "🔄 Rejected 3x"
- 🔴 **Red badge with border**: "🔄 Rejected 4x" (final warning)
- ⚫ **Gray badge**: "⚠️ Dissolved" (no edits allowed)

### 3. **Rejection Feedback Section** (AnalysesPage.tsx:878-932)

Added a **prominent red feedback box** in the view modal for script writers:

```typescript
{!isAdmin && viewingAnalysis.status === 'REJECTED' && (viewingAnalysis.feedback || viewingAnalysis.feedback_voice_note_url) && (
  <div className="bg-red-50 border-2 border-red-300 p-6 rounded-lg">
    <h3 className="text-lg font-bold text-red-800 mb-3 flex items-center">
      <svg>...</svg>
      Rejection Feedback - Please Review & Revise
    </h3>

    {/* Written Feedback */}
    {viewingAnalysis.feedback && (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-red-700 mb-2">Admin Feedback:</h4>
        <p className="text-gray-800 whitespace-pre-wrap bg-white p-4 rounded border border-red-200">
          {viewingAnalysis.feedback}
        </p>
      </div>
    )}

    {/* Voice Feedback */}
    {viewingAnalysis.feedback_voice_note_url && (
      <div>
        <h4 className="text-sm font-semibold text-red-700 mb-2">Voice Feedback:</h4>
        <audio controls className="w-full">...</audio>
      </div>
    )}

    {/* Rejection Count Warning */}
    {viewingAnalysis.rejection_count !== undefined && viewingAnalysis.rejection_count > 0 && (
      <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded">
        <p className="text-sm text-orange-800">
          <strong>⚠️ Warning:</strong> This script has been rejected {viewingAnalysis.rejection_count} time{viewingAnalysis.rejection_count > 1 ? 's' : ''}.
          {viewingAnalysis.rejection_count >= 4 && (
            <span className="block mt-1 font-bold text-red-700">
              🚨 One more rejection will permanently dissolve this project!
            </span>
          )}
        </p>
      </div>
    )}

    {/* Dissolution Notice */}
    {viewingAnalysis.is_dissolved && (
      <div className="mt-4 p-3 bg-gray-800 text-white rounded">
        <p className="text-sm font-bold">
          ⛔ This project has been dissolved due to multiple rejections. No further revisions are allowed.
        </p>
        {viewingAnalysis.dissolution_reason && (
          <p className="text-xs mt-1 text-gray-300">{viewingAnalysis.dissolution_reason}</p>
        )}
      </div>
    )}
  </div>
)}
```

**What Script Writers See:**
1. **Red header**: "Rejection Feedback - Please Review & Revise"
2. **Written feedback**: Admin's text explanation
3. **Voice feedback**: Audio player for admin's voice note (if provided)
4. **Warning badges**:
   - Orange: "⚠️ Warning: This script has been rejected X times"
   - Red: "🚨 One more rejection will permanently dissolve this project!" (at 4 rejections)
5. **Dissolution notice**: Black box if already dissolved

### 4. **View Modal Edit Button** (AnalysesPage.tsx:1023-1038)

Updated the "Edit Analysis" button in the view modal:

```typescript
{!isAdmin && (viewingAnalysis.status === 'PENDING' || viewingAnalysis.status === 'REJECTED') && !viewingAnalysis.is_dissolved && (
  <button
    onClick={() => {
      closeViewModal();
      openModal(viewingAnalysis);
    }}
    className={`px-6 py-2 border rounded-lg font-medium flex items-center ${
      viewingAnalysis.status === 'REJECTED'
        ? 'border-red-600 text-red-600 hover:bg-red-50 bg-red-50'
        : 'border-primary-600 text-primary-600 hover:bg-primary-50'
    }`}
  >
    <PencilIcon className="w-5 h-5 mr-2" />
    {viewingAnalysis.status === 'REJECTED' ? 'Revise & Resubmit' : 'Edit Analysis'}
  </button>
)}
```

**Features:**
- ✅ Shows for both pending and rejected scripts
- ✅ Hidden if dissolved
- ✅ Red-themed for rejected scripts
- ✅ "Revise & Resubmit" label for rejected scripts

## User Flow

### Script Writer's Experience

#### 1. **View Analyses List**
```
┌────────────────────────────────────────┐
│ Hook: "Amazing video idea..."          │
│                                         │  ┌─────────────┐
│ Emotion: Curiosity                      │  │  REJECTED   │
│ Outcome: Shares                         │  └─────────────┘
│                                         │  ┌─────────────┐
│ [View]  [Revise & Resubmit]            │  │🔄 Rejected  │
│                                         │  │   4x        │
└────────────────────────────────────────┘  └─────────────┘
         RED button                          ORANGE/RED badge
```

#### 2. **Click View to See Rejection Feedback**
```
┌──────────────────────────────────────────────────────────┐
│ Analysis Details                          [REJECTED]      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ [Hook, Analysis, Emotion, Outcome sections...]            │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 🚨 Rejection Feedback - Please Review & Revise     │  │
│ │                                                     │  │
│ │ Admin Feedback:                                     │  │
│ │ ┌─────────────────────────────────────────────┐   │  │
│ │ │ The hook is too generic. Make it more       │   │  │
│ │ │ specific and attention-grabbing. The        │   │  │
│ │ │ replication strategy is unclear.            │   │  │
│ │ └─────────────────────────────────────────────┘   │  │
│ │                                                     │  │
│ │ ⚠️ Warning: This script has been rejected 4 times. │  │
│ │ 🚨 One more rejection will permanently dissolve    │  │
│ │    this project!                                    │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ [Revise & Resubmit]  [Close]                             │
│      RED button                                           │
└──────────────────────────────────────────────────────────┘
```

#### 3. **Click "Revise & Resubmit"**
- Opens the **edit modal** with all previous data pre-filled
- Script writer makes improvements based on feedback
- Clicks "Update Analysis"
- Script status changes back to `PENDING`
- Admin reviews again

#### 4. **If Dissolved (5+ rejections)**
```
┌────────────────────────────────────────┐
│ Hook: "Amazing video idea..."          │
│                                         │  ┌─────────────┐
│ Emotion: Curiosity                      │  │  REJECTED   │
│ Outcome: Shares                         │  └─────────────┘
│                                         │  ┌─────────────┐
│ [View]    (No edit button)             │  │⚠️ Dissolved │
│                                         │  └─────────────┘
└────────────────────────────────────────┘  GRAY badge
```

## Benefits

✅ **Clear feedback loop** - Script writers see exactly why their script was rejected

✅ **Multiple revision attempts** - Can revise and resubmit up to 4 times (5th rejection = dissolution)

✅ **Visual warnings** - Rejection count badges warn before dissolution

✅ **Voice + text feedback** - Admins can provide detailed feedback via text or voice

✅ **Prevents accidental dissolution** - Clear warning at 4 rejections

✅ **Disabled after dissolution** - No edit button if project is dissolved

## Testing Checklist

### Script Writer Tests

- [ ] Login as Script Writer
- [ ] Submit a new script
- [ ] Have Admin reject it with feedback
- [ ] Check script list shows:
  - [ ] "REJECTED" status badge
  - [ ] "🔄 Rejected 1x" orange badge
  - [ ] "Revise & Resubmit" red button
- [ ] Click "View" to see rejection feedback:
  - [ ] Red feedback box appears
  - [ ] Admin's written feedback displays
  - [ ] Warning message shows rejection count
- [ ] Click "Revise & Resubmit" from:
  - [ ] Card button
  - [ ] View modal button
- [ ] Edit modal opens with previous data pre-filled
- [ ] Make changes and submit
- [ ] Script status changes to "PENDING"
- [ ] Have Admin reject 4 times total:
  - [ ] Check badge turns RED at 4th rejection
  - [ ] Check warning says "One more rejection will dissolve"
- [ ] Have Admin reject 5th time:
  - [ ] Check "⚠️ Dissolved" badge appears
  - [ ] Check "Revise & Resubmit" button disappears
  - [ ] Check view modal shows dissolution notice
  - [ ] Confirm no edit button anywhere

### Admin Tests

- [ ] Login as Admin
- [ ] Go to "Need Approval" page
- [ ] Click "Reject" on a script
- [ ] Rejection modal opens with:
  - [ ] Score sliders
  - [ ] Feedback textarea
  - [ ] Rejection counter display
- [ ] Submit rejection with feedback
- [ ] Verify script writer receives feedback
- [ ] Reject same script 5 times
- [ ] Verify project auto-dissolves at 5th rejection

## Related Files

- ✅ [frontend/src/pages/AnalysesPage.tsx](frontend/src/pages/AnalysesPage.tsx) - Main script writer page
  - Line 357-375: Rejection counter badges
  - Line 397-409: "Revise & Resubmit" button on cards
  - Line 878-932: Rejection feedback section in view modal
  - Line 1023-1038: "Revise & Resubmit" button in view modal
- ✅ [frontend/src/components/RejectScriptModal.tsx](frontend/src/components/RejectScriptModal.tsx) - Admin rejection modal
- ✅ [frontend/src/pages/admin/NeedApprovalPage.tsx](frontend/src/pages/admin/NeedApprovalPage.tsx) - Admin approval page
- ✅ [frontend/src/services/adminService.ts](frontend/src/services/adminService.ts) - Backend rejection logic
- ✅ [simple-rejection-counter-fix.sql](simple-rejection-counter-fix.sql) - Database schema

## Status

🎉 **COMPLETE** - Script writers can now view rejection feedback and revise rejected scripts!

## Summary of Changes

| Before | After |
|--------|-------|
| ❌ Only "View" button for rejected scripts | ✅ "Revise & Resubmit" button |
| ❌ No rejection feedback visible | ✅ Red feedback box with admin comments |
| ❌ No rejection count indicator | ✅ Orange/red badges showing rejection count |
| ❌ No dissolution warning | ✅ Clear warning at 4 rejections |
| ❌ No way to edit rejected scripts | ✅ Full edit capability (until dissolved) |
