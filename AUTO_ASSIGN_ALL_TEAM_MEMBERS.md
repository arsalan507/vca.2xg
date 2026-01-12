# Auto-Assign All Team Members - Implementation Complete

## Summary

Successfully implemented auto-assign functionality for **all team members** (Videographer, Editor, and Posting Manager) based on workload calculation.

## What Was Implemented

### 1. Backend Logic - Assignment Service

**File:** [frontend/src/services/assignmentService.ts](frontend/src/services/assignmentService.ts)

#### Added Auto-Assign Methods

**Auto-Assign Editor** (Lines 170-224)
```typescript
async autoAssignEditor(analysisId: string): Promise<ViralAnalysis> {
  // Get all editors
  const { data: editors, error: eError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'EDITOR');

  // Calculate workload for each editor (count active assignments)
  const workloads = await Promise.all(
    editors.map(async (e) => {
      const { count, error } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', e.id)
        .eq('role', 'EDITOR');
      return { editor: e, workload: count || 0 };
    })
  );

  // Find editor with lowest workload and assign
  const assigned = workloads.reduce((min, current) =>
    current.workload < min.workload ? current : min
  );

  // ... assignment logic
}
```

**Auto-Assign Posting Manager** (Lines 226-280)
```typescript
async autoAssignPostingManager(analysisId: string): Promise<ViralAnalysis> {
  // Get all posting managers
  const { data: postingManagers, error: pmError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'POSTING_MANAGER');

  // Calculate workload for each posting manager (count active assignments)
  const workloads = await Promise.all(
    postingManagers.map(async (pm) => {
      const { count, error } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', pm.id)
        .eq('role', 'POSTING_MANAGER');
      return { postingManager: pm, workload: count || 0 };
    })
  );

  // Find posting manager with lowest workload and assign
  const assigned = workloads.reduce((min, current) =>
    current.workload < min.workload ? current : min
  );

  // ... assignment logic
}
```

#### Updated assignTeam Method (Lines 20-36)

Added auto-assign checks before manual assignment:

```typescript
async assignTeam(analysisId: string, data: AssignTeamData): Promise<ViralAnalysis> {
  // If auto-assign videographer is requested
  if (data.autoAssignVideographer) {
    const assigned = await this.autoAssignVideographer(analysisId);
    data.videographerId = assigned.videographer?.id;
  }

  // If auto-assign editor is requested
  if (data.autoAssignEditor) {
    const assigned = await this.autoAssignEditor(analysisId);
    data.editorId = assigned.editor?.id;
  }

  // If auto-assign posting manager is requested
  if (data.autoAssignPostingManager) {
    const assigned = await this.autoAssignPostingManager(analysisId);
    data.postingManagerId = assigned.posting_manager?.id;
  }

  // ... rest of assignment logic
}
```

### 2. TypeScript Types

**File:** [frontend/src/types/index.ts](frontend/src/types/index.ts:246-253)

Updated `AssignTeamData` interface to include auto-assign flags for all roles:

```typescript
export interface AssignTeamData {
  videographerId?: string;
  editorId?: string;
  postingManagerId?: string;
  autoAssignVideographer?: boolean;
  autoAssignEditor?: boolean;           // NEW
  autoAssignPostingManager?: boolean;   // NEW
}
```

### 3. UI Component - Assign Team Modal

**File:** [frontend/src/components/AssignTeamModal.tsx](frontend/src/components/AssignTeamModal.tsx)

#### Updated Form State (Lines 27-34)

```typescript
const [formData, setFormData] = useState<AssignTeamData>({
  videographerId: analysis.videographer?.id,
  editorId: analysis.editor?.id,
  postingManagerId: analysis.posting_manager?.id,
  autoAssignVideographer: false,
  autoAssignEditor: false,              // NEW
  autoAssignPostingManager: false,      // NEW
});
```

#### Added Auto-Assign Checkbox for Editor (Lines 208-251)

```typescript
{/* Editor Assignment */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <label className="flex items-center text-sm font-medium text-gray-900">
      <FilmIcon className="w-5 h-5 text-purple-600 mr-2" />
      Editor (Optional)
    </label>
    <label className="flex items-center text-sm text-gray-600">
      <input
        type="checkbox"
        checked={formData.autoAssignEditor}
        onChange={(e) =>
          setFormData({ ...formData, autoAssignEditor: e.target.checked })
        }
        className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <SparklesIcon className="w-4 h-4 mr-1" />
      Auto-assign
    </label>
  </div>

  {!formData.autoAssignEditor && (
    <select>
      {/* Editor dropdown */}
    </select>
  )}

  {formData.autoAssignEditor && (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
      <SparklesIcon className="w-4 h-4 inline mr-1" />
      Will auto-assign editor with lowest workload
    </div>
  )}
</div>
```

#### Added Auto-Assign Checkbox for Posting Manager (Lines 254-297)

```typescript
{/* Posting Manager Assignment */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <label className="flex items-center text-sm font-medium text-gray-900">
      <MegaphoneIcon className="w-5 h-5 text-pink-600 mr-2" />
      Posting Manager (Optional)
    </label>
    <label className="flex items-center text-sm text-gray-600">
      <input
        type="checkbox"
        checked={formData.autoAssignPostingManager}
        onChange={(e) =>
          setFormData({ ...formData, autoAssignPostingManager: e.target.checked })
        }
        className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <SparklesIcon className="w-4 h-4 mr-1" />
      Auto-assign
    </label>
  </div>

  {!formData.autoAssignPostingManager && (
    <select>
      {/* Posting Manager dropdown */}
    </select>
  )}

  {formData.autoAssignPostingManager && (
    <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-sm text-pink-700">
      <SparklesIcon className="w-4 h-4 inline mr-1" />
      Will auto-assign posting manager with lowest workload
    </div>
  )}
</div>
```

#### Updated Validation (Lines 88-95)

Updated form validation to check for auto-assign flags:

```typescript
// Validate at least one team member is assigned
if (
  !formData.videographerId &&
  !formData.editorId &&
  !formData.postingManagerId &&
  !formData.autoAssignVideographer &&
  !formData.autoAssignEditor &&            // NEW
  !formData.autoAssignPostingManager       // NEW
) {
  toast.error('Please assign at least one team member');
  return;
}
```

## How It Works

### Auto-Assignment Algorithm

1. **Fetch All Users by Role**
   - Queries `profiles` table for users with specific role (EDITOR or POSTING_MANAGER)

2. **Calculate Workload**
   - For each user, counts active assignments in `project_assignments` table
   - Workload = number of projects currently assigned to that user

3. **Find User with Lowest Workload**
   - Uses `Array.reduce()` to find user with minimum workload
   - If multiple users have same workload, picks the first one

4. **Assign User to Project**
   - Creates `project_assignments` record with:
     - `analysis_id`: The project being assigned
     - `user_id`: The selected user with lowest workload
     - `role`: The role being assigned (EDITOR or POSTING_MANAGER)
     - `assigned_by`: The admin who triggered the assignment

### UI Flow

1. **Admin approves a script**
2. **Assign Team modal opens** with three sections:
   - Videographer (required)
   - Editor (optional)
   - Posting Manager (optional)

3. **For each role, admin can choose:**
   - **Manual assignment:** Select from dropdown
   - **Auto-assignment:** Check "Auto-assign" checkbox
     - Dropdown hides when auto-assign is checked
     - Info message shows: "Will auto-assign [role] with lowest workload"

4. **Submit triggers assignment:**
   - Backend checks auto-assign flags first
   - If auto-assign is enabled, calls respective `autoAssign*()` method
   - Manual selections are processed after auto-assignments

## Benefits

✅ **Fair workload distribution** - Automatically balances assignments across team members

✅ **Time-saving** - Admin doesn't need to manually check workloads

✅ **Flexible** - Can mix auto-assign and manual selection (e.g., auto-assign videographer and editor, manually select posting manager)

✅ **Scalable** - Works with any number of team members per role

✅ **Transparent** - Clear UI feedback shows what will happen

## Testing Checklist

- [ ] Login as Admin
- [ ] Approve a pending script
- [ ] Open "Assign Team" modal
- [ ] Test auto-assign videographer (existing feature)
- [ ] Test auto-assign editor checkbox
  - [ ] Checkbox hides dropdown when checked
  - [ ] Shows purple info message
  - [ ] Successfully assigns editor with lowest workload
- [ ] Test auto-assign posting manager checkbox
  - [ ] Checkbox hides dropdown when checked
  - [ ] Shows pink info message
  - [ ] Successfully assigns posting manager with lowest workload
- [ ] Test mixed assignment (auto + manual)
  - [ ] Auto-assign videographer + manually select editor
  - [ ] Manually select videographer + auto-assign editor and posting manager
- [ ] Test validation
  - [ ] Cannot submit without selecting/auto-assigning at least one role
  - [ ] Shows error: "Please assign at least one team member"
- [ ] Verify assignments in database
  - [ ] Check `project_assignments` table has correct records
  - [ ] Verify `assigned_by` field contains admin's user ID

## Database Impact

No database changes required - uses existing tables:

- `profiles` - to fetch users by role
- `project_assignments` - to count workload and create assignments

## Related Files

- ✅ [frontend/src/services/assignmentService.ts](frontend/src/services/assignmentService.ts) - Backend logic
- ✅ [frontend/src/types/index.ts](frontend/src/types/index.ts) - TypeScript types
- ✅ [frontend/src/components/AssignTeamModal.tsx](frontend/src/components/AssignTeamModal.tsx) - UI component

## Status

🎉 **COMPLETE** - All team members (Videographer, Editor, Posting Manager) can now be auto-assigned based on workload!
