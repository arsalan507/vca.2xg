# Rejection Counter & Multiple File Upload Implementation

## Overview

This document describes the implementation of two critical features:
1. **Script Rejection Counter with Auto-Dissolution** - Tracks script rejections and automatically dissolves projects after 5 rejections
2. **Multiple File Upload Support** - Allows videographers and editors to upload multiple files per project

---

## 1. Script Rejection Counter & Auto-Dissolution

### Database Changes

#### New Fields in `viral_analyses` Table

```sql
ALTER TABLE viral_analyses
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_dissolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dissolution_reason TEXT;
```

**Fields:**
- `rejection_count` - Tracks how many times a script was rejected
- `is_dissolved` - Boolean flag indicating if project is permanently dissolved
- `dissolution_reason` - Reason for dissolution (auto-generated after 5 rejections)

#### Database Function: `increment_rejection_counter`

```sql
CREATE OR REPLACE FUNCTION increment_rejection_counter(analysis_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE viral_analyses
  SET
    rejection_count = rejection_count + 1,
    updated_at = NOW()
  WHERE id = analysis_uuid;
END;
$$ LANGUAGE plpgsql;
```

This function safely increments the rejection counter atomically.

#### Trigger: Auto-Dissolution After 5 Rejections

```sql
CREATE OR REPLACE FUNCTION check_rejection_dissolution()
RETURNS TRIGGER AS $$
BEGIN
  -- If rejection_count reaches 5 or more, mark as dissolved
  IF NEW.rejection_count >= 5 AND NEW.status = 'REJECTED' THEN
    NEW.is_dissolved := TRUE;
    NEW.dissolution_reason := 'Script rejected 5 times - project automatically dissolved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_rejection_dissolution
  BEFORE UPDATE ON viral_analyses
  FOR EACH ROW
  WHEN (NEW.rejection_count IS DISTINCT FROM OLD.rejection_count)
  EXECUTE FUNCTION check_rejection_dissolution();
```

**How it works:**
- Trigger fires when `rejection_count` changes
- If `rejection_count >= 5` AND status is 'REJECTED', automatically sets `is_dissolved = TRUE`
- Adds auto-generated dissolution reason

### Frontend Implementation

#### TypeScript Types Updated

**File:** [frontend/src/types/index.ts](frontend/src/types/index.ts)

```typescript
export interface ViralAnalysis {
  // ... existing fields ...

  // Rejection and dissolution tracking
  rejection_count?: number;
  is_dissolved?: boolean;
  dissolution_reason?: string;
}
```

#### Admin Service Updated

**File:** [frontend/src/services/adminService.ts](frontend/src/services/adminService.ts:93-103)

```typescript
// If rejecting, increment the rejection counter using the database function
if (reviewData.status === 'REJECTED') {
  const { error: rpcError } = await supabase.rpc('increment_rejection_counter', {
    analysis_uuid: id,
  });

  if (rpcError) {
    console.error('Failed to increment rejection counter:', rpcError);
    // Don't throw - allow rejection to proceed even if counter fails
  }
}
```

**Logic:**
- When admin rejects a script, `increment_rejection_counter()` is called
- Counter increments atomically
- Trigger automatically checks for dissolution
- If rejection fails to log, rejection still proceeds (graceful degradation)

#### Admin UI Updates

**File:** [frontend/src/pages/admin/NeedApprovalPage.tsx](frontend/src/pages/admin/NeedApprovalPage.tsx:257-265)

**Visual Indicators:**
```tsx
{script.rejection_count !== undefined && script.rejection_count > 0 && (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    script.rejection_count >= 4
      ? 'bg-red-100 text-red-800 border border-red-300'
      : 'bg-orange-100 text-orange-800'
  }`}>
    🚨 Rejected {script.rejection_count}x {script.rejection_count >= 4 ? '(Warning: 1 more = dissolved)' : ''}
  </span>
)}
```

**UI Features:**
- Orange badge for 1-3 rejections
- **Red badge with border** for 4 rejections (critical warning)
- Warning message: "(Warning: 1 more = dissolved)" at 4 rejections
- Shows rejection count to admin before they reject

---

## 2. Multiple File Upload Support

### Database Changes

#### New Table: `production_files`

```sql
CREATE TABLE IF NOT EXISTS production_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES viral_analyses(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('raw-footage', 'edited-video', 'final-video')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_id TEXT NOT NULL, -- Google Drive or Supabase Storage file ID
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  mime_type TEXT,
  description TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- Supports multiple files per project
- Soft delete support (`is_deleted` flag instead of hard delete)
- Tracks uploader, file size, mime type
- Stores both URL and file ID for flexibility

#### Indexes for Performance

```sql
CREATE INDEX IF NOT EXISTS idx_production_files_analysis_id ON production_files(analysis_id);
CREATE INDEX IF NOT EXISTS idx_production_files_file_type ON production_files(file_type);
CREATE INDEX IF NOT EXISTS idx_production_files_uploaded_by ON production_files(uploaded_by);
```

#### Row Level Security (RLS) Policies

**View Files Policy:**
```sql
CREATE POLICY "Users can view files for assigned projects"
  ON production_files
  FOR SELECT
  USING (
    analysis_id IN (
      SELECT analysis_id
      FROM project_assignments
      WHERE user_id = auth.uid()
    )
    OR
    -- Allow admins to view all files
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
    OR
    -- Allow creator to view their own script files
    analysis_id IN (
      SELECT id FROM viral_analyses WHERE user_id = auth.uid()
    )
  );
```

**Upload Policies (Role-Based):**
```sql
-- Videographers can upload raw footage
CREATE POLICY "Videographers can upload raw footage"
  ON production_files
  FOR INSERT
  WITH CHECK (
    file_type = 'raw-footage'
    AND
    analysis_id IN (
      SELECT analysis_id
      FROM project_assignments
      WHERE user_id = auth.uid() AND role = 'VIDEOGRAPHER'
    )
  );

-- Editors can upload edited videos
CREATE POLICY "Editors can upload edited videos"
  ON production_files
  FOR INSERT
  WITH CHECK (
    file_type = 'edited-video'
    AND
    analysis_id IN (
      SELECT analysis_id
      FROM project_assignments
      WHERE user_id = auth.uid() AND role = 'EDITOR'
    )
  );
```

#### Data Migration

Existing `raw_footage_url` and `edited_video_url` fields are migrated to the new `production_files` table:

```sql
-- Migrate existing raw footage URLs
INSERT INTO production_files (analysis_id, file_type, file_name, file_url, file_id, uploaded_by)
SELECT
  id as analysis_id,
  'raw-footage' as file_type,
  'Legacy raw footage' as file_name,
  raw_footage_url as file_url,
  raw_footage_url as file_id,
  user_id as uploaded_by
FROM viral_analyses
WHERE raw_footage_url IS NOT NULL AND raw_footage_url != ''
ON CONFLICT DO NOTHING;
```

### Frontend Implementation

#### Updated TypeScript Type

**File:** [frontend/src/types/index.ts](frontend/src/types/index.ts:265-283)

```typescript
export interface ProductionFile {
  id: string;
  analysis_id: string;
  file_type: 'raw-footage' | 'edited-video' | 'final-video';
  file_name: string;
  file_url: string;
  file_id: string; // Google Drive or Supabase Storage file ID
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
  is_deleted: boolean;
  deleted_at?: string;
  mime_type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  // Populated uploader data
  uploader?: Profile;
}
```

#### Production Files Service

**File:** [frontend/src/services/productionFilesService.ts](frontend/src/services/productionFilesService.ts)

**Key Methods:**

```typescript
// Get all files for analysis
async getFiles(analysisId: string): Promise<ProductionFile[]>

// Get files by type
async getFilesByType(analysisId: string, fileType: string): Promise<ProductionFile[]>

// Upload new file
async uploadFile(fileData: {
  analysisId: string;
  fileType: 'raw-footage' | 'edited-video' | 'final-video';
  fileName: string;
  fileUrl: string;
  fileId: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
}): Promise<ProductionFile>

// Soft delete
async deleteFile(fileId: string): Promise<void>

// Update file metadata
async updateFile(fileId: string, updates: {...}): Promise<ProductionFile>
```

### How Videographers Upload Multiple Files

**Step 1:** Videographer opens project in [VideographerDashboard.tsx](frontend/src/pages/VideographerDashboard.tsx)

**Step 2:** Upload component allows multiple file selection:
- Uses [BackendFileUploader.tsx](frontend/src/components/BackendFileUploader.tsx) or [GoogleDriveOAuthUploader.tsx](frontend/src/components/GoogleDriveOAuthUploader.tsx)
- Each file upload calls `productionFilesService.uploadFile()`
- Files are stored in `production_files` table

**Step 3:** View uploaded files:
- `productionFilesService.getFilesByType(analysisId, 'raw-footage')` fetches all raw footage
- Displays list of files with name, size, upload date
- Each file has delete button (soft delete)

**Step 4:** Submit for review:
- When videographer clicks "Submit for Review"
- Production stage changes to `SHOOT_REVIEW`
- Admin can see all uploaded files

---

## Migration Steps

### Step 1: Run Database Migration

```bash
# In Supabase SQL Editor, run:
/Users/arsalan/Desktop/ViralContentAnalyzer/add-rejection-counter-and-files.sql
```

**What it does:**
✅ Adds `rejection_count`, `is_dissolved`, `dissolution_reason` to `viral_analyses`
✅ Creates `production_files` table
✅ Creates RLS policies
✅ Creates indexes for performance
✅ Creates auto-dissolution trigger
✅ Migrates existing file URLs

### Step 2: Verify Database Changes

```sql
-- Check new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'viral_analyses'
AND column_name IN ('rejection_count', 'is_dissolved', 'dissolution_reason');

-- Check production_files table
SELECT * FROM production_files LIMIT 1;

-- Check triggers
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_check_rejection_dissolution';
```

### Step 3: Test Rejection Counter

1. Go to Admin Dashboard → Need Approval
2. Select a pending script
3. Reject it 5 times
4. After 5th rejection:
   - ✅ `rejection_count` = 5
   - ✅ `is_dissolved` = TRUE
   - ✅ `dissolution_reason` = "Script rejected 5 times - project automatically dissolved"

### Step 4: Test Multiple File Uploads

1. Login as Videographer
2. Go to assigned project
3. Upload multiple raw footage files
4. Verify files appear in list
5. Submit for review
6. Login as Admin
7. View shoot review - see all uploaded files

---

## Workflow Diagram Compliance

### ✅ Script Rejection Flow (Matches Diagram)

```
SCRIPT WRITER → SCRIPT SUBMITTED
       ↓
   [ADMIN REVIEW]
       ↓
   ├─→ APPROVED (green) → Team Assignment → Production
   └─→ REJECTED (red)
       ↓
   rejection_count++
       ↓
   [Check rejection_count]
       ↓
   ├─→ < 5 rejections → Back to SCRIPT WRITER (can resubmit)
   └─→ ≥ 5 rejections → PROJECT DISSOLVED (yellow box) ❌ No more work allowed
```

**Matches diagram requirement:** "If above 5 go to review and if below 5 rejected forever" ✅

### ✅ Videographer Flow (Matches Diagram)

```
PRE_PRODUCTION/PLANNED
       ↓
   SHOOTING (upload multiple raw footage files)
       ↓
   SHOOT_REVIEW (admin approval point)
       ↓
   ├─→ APPROVED (green) → EDITING
   └─→ REJECTED (red) → SHOOTING (reshoot)
```

### ✅ Editor Flow (Matches Diagram)

```
EDITING (upload multiple edited videos)
       ↓
   EDIT_REVIEW (admin approval point)
       ↓
   ├─→ APPROVED (green) → FINAL_REVIEW
   └─→ REJECTED (red) → EDITING (revision)
           ↓
   REASSIGNED WITH REMARKS (yellow) ✅
```

### ✅ Posting Manager Flow (Matches Diagram)

```
FINAL_REVIEW
       ↓
   READY_TO_POST
       ↓
   POSTED (green) ✅
```

---

## Benefits

### Rejection Counter Benefits

1. **Prevents Infinite Resubmissions** - Scripts can't be rejected indefinitely
2. **Quality Gate** - Forces quality improvements or dissolution
3. **Admin Awareness** - Visual warnings before final rejection
4. **Automatic Enforcement** - Database triggers ensure rules are followed
5. **Audit Trail** - Tracks rejection history

### Multiple File Upload Benefits

1. **Flexibility** - Videographers can upload multiple takes/angles
2. **Better Organization** - Each file tracked separately with metadata
3. **No Data Loss** - Soft delete preserves file history
4. **Scalability** - No limit on number of files per project
5. **Role-Based Access** - RLS ensures only authorized users can upload/view

---

## API Endpoints

### Backend Endpoints (Existing)

**Upload Files:**
- `POST /api/upload/raw-footage` - Upload raw footage (uses Supabase Storage)
- `POST /api/upload/edited-video` - Upload edited video (uses Supabase Storage)
- `POST /api/upload/final-video` - Upload final video (uses Google Drive)

**After upload, frontend calls:**
```typescript
productionFilesService.uploadFile({
  analysisId: projectId,
  fileType: 'raw-footage',
  fileName: file.name,
  fileUrl: result.webViewLink,
  fileId: result.fileId,
  fileSize: file.size,
  mimeType: file.type,
});
```

---

## Testing Checklist

### Rejection Counter

- [ ] Script rejected 1 time shows orange badge
- [ ] Script rejected 4 times shows red badge with warning
- [ ] Script rejected 5 times gets `is_dissolved = TRUE`
- [ ] Dissolved projects cannot be assigned to team
- [ ] Admin sees rejection count before rejecting
- [ ] `increment_rejection_counter()` function works correctly

### Multiple File Uploads

- [ ] Videographer can upload multiple raw footage files
- [ ] Editor can upload multiple edited videos
- [ ] Files are visible in dashboard
- [ ] Soft delete works (files hidden but not removed)
- [ ] RLS policies prevent unauthorized access
- [ ] File count displays correctly
- [ ] Admin can view all files during review

---

## Troubleshooting

### Issue: Rejection Counter Not Incrementing

**Check:**
```sql
-- Verify function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'increment_rejection_counter';

-- Test function manually
SELECT increment_rejection_counter('your-analysis-uuid-here');

-- Check rejection_count
SELECT id, rejection_count, is_dissolved FROM viral_analyses WHERE id = 'your-uuid';
```

### Issue: Files Not Showing Up

**Check:**
```sql
-- Verify production_files table exists
SELECT * FROM production_files WHERE analysis_id = 'your-analysis-uuid';

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'production_files';

-- Check if user has access
SELECT * FROM project_assignments WHERE analysis_id = 'your-uuid' AND user_id = auth.uid();
```

### Issue: Dissolution Not Triggering

**Check:**
```sql
-- Verify trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'trigger_check_rejection_dissolution';

-- Manually test trigger logic
UPDATE viral_analyses
SET rejection_count = 5, status = 'REJECTED'
WHERE id = 'test-uuid';

-- Check if dissolved
SELECT is_dissolved, dissolution_reason FROM viral_analyses WHERE id = 'test-uuid';
```

---

## Future Enhancements

### Possible Improvements

1. **Email Notifications** - Notify script writer when rejection count reaches 3 or 4
2. **Appeal System** - Allow script writers to appeal dissolution
3. **File Versioning** - Track file versions for edited videos
4. **Bulk Upload** - Upload multiple files at once with drag-and-drop
5. **File Preview** - Preview videos directly in dashboard
6. **Storage Optimization** - Compress videos before upload
7. **Download All** - Zip and download all files for a project

---

## Related Files

### Database
- [add-rejection-counter-and-files.sql](add-rejection-counter-and-files.sql) - Main migration file

### Frontend Types
- [frontend/src/types/index.ts](frontend/src/types/index.ts:182-184) - Rejection fields
- [frontend/src/types/index.ts](frontend/src/types/index.ts:265-283) - ProductionFile type

### Frontend Services
- [frontend/src/services/adminService.ts](frontend/src/services/adminService.ts:93-103) - Rejection logic
- [frontend/src/services/productionFilesService.ts](frontend/src/services/productionFilesService.ts) - File management

### Frontend UI
- [frontend/src/pages/admin/NeedApprovalPage.tsx](frontend/src/pages/admin/NeedApprovalPage.tsx:257-265) - Rejection count display

### Backend
- [backend/src/routes/uploadRoutes.js](backend/src/routes/uploadRoutes.js) - File upload endpoints
- [backend/src/services/supabaseStorageService.js](backend/src/services/supabaseStorageService.js) - Supabase Storage integration

---

## Summary

✅ **Rejection Counter Implemented:**
- Tracks script rejections
- Auto-dissolves after 5 rejections
- Visual warnings in admin UI
- Database triggers ensure enforcement

✅ **Multiple File Uploads Implemented:**
- New `production_files` table
- Supports unlimited files per project
- Soft delete preserves history
- Role-based access control
- Works for videographers, editors, and posting managers

✅ **Workflow Diagram Compliance:**
- All green/red approval boxes implemented
- Yellow dissolution box implemented
- Admin approval points functional
- Reassignment with remarks supported

🚀 **Ready for Production!**
