# Videographer Project Workflow - Complete Guide

## How It Works Now

### 1. Videographer Creates New Project
- Click "New Project" button on Videographer Dashboard
- Fill in:
  - Project Title (required)
  - Reference Link (required)
  - Project Description (optional)
  - Estimated Shoot Date (optional)
  - People Required (optional)
- Project is created with:
  - `status: 'APPROVED'` (auto-approved, no admin approval needed)
  - `production_stage: 'SHOOTING'` (ready to start shooting)
  - Videographer automatically assigned to the project
- Project immediately appears in "My Assigned Projects"

### 2. Upload Footage to Google Drive
- Open the project from "My Assigned Projects"
- Click "Add File" button
- Sign in to Google Drive (first time only)
- Upload video files (raw footage, A-rolls, B-rolls, etc.)
- Files are uploaded to: `Your Google Drive → Production Files → [Project ID] → Raw Footage/`
- Only the needed folder is created (optimized workflow)

### 3. Submit for Admin Review
- When shooting is complete, open the project
- Go to "Production Details" section
- Change "Update Production Stage" dropdown from "🎬 Shooting" to "✅ Submit for Review"
- Add any production notes
- Click "Submit for Review" button
- Project stage changes to `SHOOT_REVIEW`

### 4. Admin Reviews Shoot
- Project now appears in Admin Dashboard → "Shoot Reviews" section
- Admin can:
  - View all uploaded files
  - Review production notes
  - **Approve**: Moves project to `EDITING` stage
  - **Reject**: Sends back to `SHOOTING` stage with feedback

---

## Why Projects Don't Show in Admin Review Initially

When you create a project, it starts in `SHOOTING` stage (not `SHOOT_REVIEW`). This is intentional:

1. **Videographer creates project** → `SHOOTING` stage (working on it)
2. **Videographer uploads footage** → Still `SHOOTING` stage
3. **Videographer submits for review** → Changes to `SHOOT_REVIEW` stage
4. **Admin sees it in "Shoot Reviews"** → Can approve/reject

**This workflow lets you work on projects without admin interruption until you're ready.**

---

## Current Workflow Status

### ✅ Fixed Issues:
1. Google OAuth upload working with new GIS API
2. Only creates needed folders (not all 3)
3. Projects appear in "My Assigned Projects" after creation
4. RLS policies fixed for project assignments
5. Added UI to submit projects for admin review

### 📋 Testing Steps:
1. Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Create a new test project
3. Upload a video file
4. Verify only "Raw Footage" folder is created in Google Drive
5. Change stage to "Submit for Review"
6. Check Admin Dashboard → "Shoot Reviews" section

---

## Folder Structure (Same Google Account)

If videographers and editors use the same Google account:

### Your Google Drive:
```
My Drive/
└── Production Files/
    ├── BCH-1001/
    │   ├── Raw Footage/          ← Videographer uploads here
    │   ├── Edited Videos/        ← Editor uploads here (created when needed)
    │   └── Final Videos/         ← Final videos (created when needed)
    └── BCH-1002/
        └── Raw Footage/          ← Only this folder exists until editor uploads
```

**Same account = Same Drive = Same folders (no duplicates)**

---

## Next Steps

1. Hard refresh your browser to get the latest code
2. Open the "Arsalan" project in Videographer Dashboard
3. Change the production stage to "✅ Submit for Review"
4. Click "Submit for Review"
5. Check Admin Dashboard → Should appear in "Shoot Reviews"

This completes the videographer workflow! 🎉
