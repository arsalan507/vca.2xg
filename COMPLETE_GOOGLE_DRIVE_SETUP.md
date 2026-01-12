# Complete Google Drive Service Account Setup

Great progress! Your backend is already fully implemented. You just need to configure the environment variables.

## What You've Done So Far ✅

1. ✅ Created service account: `production-uploader@your-project.iam.gserviceaccount.com`
2. ✅ Downloaded service account JSON key file
3. ✅ Created folder structure in Google Drive:
   - Production Files/Raw Footage/
   - Production Files/Edited Videos/
   - Production Files/Final Videos/
4. ✅ Shared all folders with service account email

## Next Steps

### Step 1: Get Folder IDs

You need to get the folder IDs for each of your three folders:

1. Open Google Drive and navigate to "Production Files/Raw Footage/"
2. Look at the URL - it will look like:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
                                          ^^^^^^^^^^^^^^^^^^^^
                                          This is the folder ID
   ```
3. Copy this ID
4. Repeat for "Edited Videos" and "Final Videos"

**Save these three folder IDs - you'll need them next!**

### Step 2: Configure Backend Environment Variables

Edit `/Users/arsalan/Desktop/ViralContentAnalyzer/backend/.env`:

```env
PORT=3001
SUPABASE_URL=your-actual-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
FRONTEND_URL=http://localhost:5174

# Google Drive Service Account
# IMPORTANT: This must be the ENTIRE JSON file content on ONE LINE
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_KEY_HERE\n-----END PRIVATE KEY-----\n","client_email":"production-uploader@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Google Drive Folder IDs (paste the IDs you copied above)
GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
GOOGLE_DRIVE_EDITED_VIDEO_FOLDER_ID=2b3c4d5e6f7g8h9i0j1k
GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID=3c4d5e6f7g8h9i0j1k2l
```

**How to add the service account JSON on one line:**

1. Open your downloaded service account JSON file
2. Copy the ENTIRE contents
3. Remove all line breaks (it should be one long line)
4. Paste it as the value for `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`

**Or use this command to convert it automatically:**

```bash
# Navigate to backend directory
cd backend

# Convert JSON to single line (replace path/to/your-key.json with actual path)
cat ~/Downloads/your-service-account-key.json | tr -d '\n' | tr -d ' ' > temp-credentials.txt

# Now copy the contents of temp-credentials.txt and paste into .env
cat temp-credentials.txt
```

### Step 3: Install Dependencies (If Needed)

```bash
cd backend
npm install
```

(Dependencies should already be installed, but run this to be safe)

### Step 4: Start the Backend Server

```bash
cd backend
npm run dev
```

You should see:
```
🚀 Backend server running on http://localhost:3001
📊 Health check: http://localhost:3001/health
📤 Upload endpoints: http://localhost:3001/api/upload/*
✅ Google Drive Service Account initialized
```

### Step 5: Test the Backend

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3001/health
```

You should get:
```json
{"status":"ok","message":"Backend server is running"}
```

### Step 6: Update Frontend to Use Backend Upload

Now we need to update the frontend to use the backend API instead of the client-side Google Drive API.

I'll create the updated frontend components in the next step. The backend is ready!

---

## How It Works Now

### Before (OAuth - requires user sign-in):
```
User → Frontend → Google OAuth Popup → User Authenticates → Upload to Drive
```

### After (Service Account - no sign-in needed):
```
User → Frontend → Backend API → Service Account → Upload to Drive
```

### File Organization

Files will be automatically organized like this:

```
Production Files/
├── Raw Footage/
│   ├── BCH-1001/
│   │   ├── footage1.mp4
│   │   └── footage2.mp4
│   └── BCH-1002/
│       └── raw.mp4
├── Edited Videos/
│   ├── BCH-1001/
│   │   └── edited_v1.mp4
│   └── BCH-1002/
│       └── final_edit.mp4
└── Final Videos/
    ├── BCH-1001/
    │   └── final.mp4
    └── BCH-1002/
        └── published.mp4
```

Each project (identified by content_id like "BCH-1001") gets its own subfolder automatically!

---

## Troubleshooting

### Error: "Google Drive service account not configured"

- Make sure `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` is set correctly in `.env`
- Ensure the JSON is on ONE LINE with no line breaks
- Check that the JSON is valid

### Error: "Raw footage folder not configured"

- Make sure all three folder IDs are set in `.env`
- Verify the folder IDs are correct (check Google Drive URLs)

### Error: "Failed to upload file"

- Verify that you shared the folders with the service account email
- Check that the service account has "Editor" permissions on the folders
- Make sure Google Drive API is enabled in Google Cloud Console

### Files Upload But Are Not Visible

- Check that the service account has access to the folders
- Verify folder sharing settings (service account email should be listed)

---

## Next: Update Frontend

Once the backend is running successfully, let me know and I'll update the frontend to use the new backend upload API instead of the OAuth approach.

This will:
- Remove the Google sign-in popup
- Upload files directly through your backend
- Work on any deployment platform (Vercel, Coolify, OVH, anywhere!)
