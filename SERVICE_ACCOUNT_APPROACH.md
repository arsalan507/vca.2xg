# Service Account Approach - Google Drive Upload

## Overview

Instead of each organization setting up Google OAuth, **you** (the app owner) create ONE Google Service Account that uploads files to any organization's shared Google Drive folder.

---

## Benefits

### For You (App Owner):
- ✅ Single set of credentials
- ✅ No OAuth popups
- ✅ Automated uploads
- ✅ Easier to maintain
- ✅ Scales to unlimited organizations

### For Organizations (Your Clients):
- ✅ Super simple setup (just share a folder!)
- ✅ No Google Cloud Console access needed
- ✅ No API keys to manage
- ✅ Works immediately

---

## How It Works

```
1. You create Service Account → Gets email: service@project.iam.gserviceaccount.com
2. Organization creates Drive folder → Shares with service account email
3. Your app uploads files → To organization's folder
4. Organization sees files → In their Drive folder
```

---

## Setup Guide

### Part 1: Create Service Account (One-Time Setup)

#### Step 1: Go to Google Cloud Console

Visit: https://console.cloud.google.com/iam-admin/serviceaccounts

Make sure you're in your "Video Production Hub" project.

#### Step 2: Create Service Account

1. Click **"+ CREATE SERVICE ACCOUNT"**
2. Fill in details:
   - **Service account name:** `video-upload-service`
   - **Service account ID:** `video-upload-service` (auto-generated)
   - **Description:** `Service account for uploading videos to client Drive folders`
3. Click **"CREATE AND CONTINUE"**

#### Step 3: Grant Permissions (Optional)

1. Skip this step (click "CONTINUE")
2. We don't need project-level permissions

#### Step 4: Create Key

1. Click **"DONE"** to create the service account
2. Find your new service account in the list
3. Click on it to open details
4. Go to **"KEYS"** tab
5. Click **"ADD KEY"** → **"Create new key"**
6. Choose **"JSON"** format
7. Click **"CREATE"**
8. A JSON file will download - **SAVE THIS SECURELY!**

**⚠️ Important:** This JSON file contains your credentials. Keep it safe and NEVER commit it to Git!

#### Step 5: Enable Google Drive API

1. Go to: https://console.cloud.google.com/apis/library
2. Search for "Google Drive API"
3. Click on it
4. Click **"ENABLE"** (if not already enabled)

#### Step 6: Note Your Service Account Email

Your service account email looks like:
```
video-upload-service@your-project-id.iam.gserviceaccount.com
```

You'll need this email to share folders!

---

### Part 2: How Organizations Set Up (Super Simple!)

Send these instructions to each organization:

#### Instructions for Organizations:

**Subject: Setup Video Upload to Your Google Drive**

Hi [Organization Name],

To enable video uploads to your Google Drive folder:

1. **Create a Google Drive folder** for video production files
   - Name it something like "Video Production Files"

2. **Share the folder** with our service account:
   - Right-click folder → "Share"
   - Add this email: `video-upload-service@your-project-id.iam.gserviceaccount.com`
   - Give it **"Editor"** permission
   - Click "Send"

3. **Copy the folder URL:**
   - Open the folder
   - Copy URL from browser (e.g., `https://drive.google.com/drive/folders/ABC123...`)

4. **Configure in the app:**
   - Login as Admin
   - Go to Settings → Google Drive Settings
   - Paste your folder URL
   - Click Save

**That's it!** Your team can now upload videos directly to your Drive folder.

---

### Part 3: Update Your App Code

You'll need to update the Google Drive service to use service account credentials instead of OAuth.

#### Option A: Backend Upload (Recommended)

**Better approach:** Handle uploads on your backend server:

1. User selects file in frontend
2. File uploads to your backend
3. Backend uses service account to upload to Drive
4. Returns Drive URL to frontend

**Benefits:**
- ✅ Service account credentials stay on server (secure)
- ✅ No browser CORS issues
- ✅ Can handle large files better
- ✅ Progress tracking still works

#### Option B: Frontend Upload (Current Approach)

**Current approach:** Upload directly from browser:

**Issue:** Service account JSON credentials would be exposed in browser (security risk)

**Not recommended** unless you implement a token server.

---

## Implementation Steps

### Recommended: Add Backend Upload Endpoint

#### 1. Create Backend API Endpoint

```typescript
// backend/routes/upload.ts
import { google } from 'googleapis';
import multer from 'multer';
import { Readable } from 'stream';

const upload = multer({ storage: multer.memoryStorage() });

// Load service account credentials
const credentials = require('./path/to/service-account-key.json');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const folderId = req.body.folderId; // From organization's settings

    const drive = google.drive({ version: 'v3', auth });

    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: file.originalname,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },
    });

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get shareable link
    const fileUrl = `https://drive.google.com/file/d/${response.data.id}/view?usp=sharing`;

    res.json({
      success: true,
      fileId: response.data.id,
      fileUrl: fileUrl,
      fileName: file.originalname,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 2. Update Frontend to Use Backend Endpoint

```typescript
// frontend: Update GoogleDriveUploader to upload via your backend
async uploadToBackend(file: File, folderId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folderId', folderId);

  const response = await fetch('/api/upload-to-drive', {
    method: 'POST',
    body: formData,
  });

  return await response.json();
}
```

---

## Security Best Practices

### 1. Protect Service Account Credentials

**DO:**
- ✅ Store JSON key file on server only
- ✅ Use environment variables
- ✅ Add to `.gitignore`
- ✅ Restrict file permissions (chmod 600)

**DON'T:**
- ❌ Commit to Git
- ❌ Expose in frontend code
- ❌ Share publicly
- ❌ Email credentials

### 2. Validate Folder Access

Before uploading, verify the service account has access:

```typescript
async function verifyFolderAccess(folderId: string) {
  try {
    await drive.files.get({ fileId: folderId });
    return true;
  } catch (error) {
    if (error.code === 404) {
      throw new Error('Folder not found or not shared with service account');
    }
    throw error;
  }
}
```

### 3. Rate Limiting

Google Drive API has quotas:
- 1 billion queries/day (free tier)
- 750GB uploads/day
- Implement rate limiting if needed

---

## Testing

### Test with Your Own Folder:

1. Create a test Drive folder
2. Share it with your service account email
3. Copy folder URL
4. Try uploading a small test file
5. Verify file appears in folder

### Test with Organization Folder:

1. Ask organization to share their folder
2. Add folder URL to settings
3. Upload test video
4. Verify organization sees the file

---

## Scaling to Multiple Organizations

### Database Schema:

```sql
-- Add to your organizations/settings table
ALTER TABLE organizations ADD COLUMN drive_folder_id TEXT;
ALTER TABLE organizations ADD COLUMN drive_folder_url TEXT;

-- Or use existing settings
UPDATE app_settings
SET drive_folder_url = 'https://drive.google.com/drive/folders/...'
WHERE organization_id = '...';
```

### Per-Organization Settings:

Each organization configures their own folder URL in Settings page.

Your app automatically:
1. Extracts folder ID from URL
2. Uploads to that specific folder
3. Returns shareable link

---

## Cost

**Service Account:** FREE
**Google Drive API:** FREE (within quotas)
**Storage:** Uses organization's Drive storage (not yours)

---

## Summary

### What You Do (One Time):
1. ✅ Create service account
2. ✅ Download JSON credentials
3. ✅ Add backend upload endpoint
4. ✅ Deploy your app

### What Organizations Do (Simple Setup):
1. ✅ Create Drive folder
2. ✅ Share with service account email
3. ✅ Paste folder URL in app settings

### What Happens (Automatic):
1. ✅ Videographer uploads video
2. ✅ App uploads to organization's Drive
3. ✅ File appears in their folder
4. ✅ Everyone has access

**No OAuth popups. No API keys. Just works!** 🎉

---

## Next Steps

1. Create service account
2. Set up backend upload endpoint (if you want backend approach)
3. Update frontend to use backend API
4. Test with your own Drive folder
5. Provide setup instructions to organizations
6. Scale to unlimited clients!

This is the **professional, scalable approach** used by real SaaS applications.
