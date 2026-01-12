# Google OAuth Upload Setup Guide

## What This Does

Files will now upload to **each videographer's personal Google Drive** when they sign in with their Google account. No more service account issues!

---

## Step 1: Set Up Google OAuth Credentials

### 1.1 Go to Google Cloud Console
Visit: https://console.cloud.google.com

### 1.2 Select Your Project
- Click on the project dropdown at the top
- Select your existing project: **"video-production-hub"** (or create a new one)

### 1.3 Enable Google Drive API
1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Drive API"**
3. Click on it and click **"Enable"** (if not already enabled)

### 1.4 Create OAuth 2.0 Credentials
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. If you see a warning about configuring the OAuth consent screen, click **"Configure Consent Screen"**:
   - User Type: **External**
   - App name: **"Viral Content Analyzer"**
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"**
   - Scopes: Click **"Add or Remove Scopes"**, search for `drive.file`, select it, click **"Update"**, then **"Save and Continue"**
   - Test users: Add your email and any videographer emails
   - Click **"Save and Continue"**
4. Now create the OAuth client ID:
   - Application type: **"Web application"**
   - Name: **"Viral Content Analyzer - Web Client"**
   - **Authorized JavaScript origins**:
     - Add: `http://localhost:5174`
     - Add: `http://localhost:5173`
   - **Authorized redirect URIs**:
     - Add: `http://localhost:5174`
     - Add: `http://localhost:5173`
   - Click **"Create"**

5. **Copy the Client ID** (it looks like: `123456789-abcdef.apps.googleusercontent.com`)

---

## Step 2: Update Environment Variables

Open `frontend/.env` and update the Google Client ID:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
```

Replace `YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with the Client ID you copied.

**Example:**
```env
VITE_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
```

---

## Step 3: Restart the Frontend

```bash
# Stop the frontend (Ctrl+C in the terminal)
# Then restart it
cd frontend
npm run dev
```

---

## Step 4: Test the Upload Flow

### 4.1 Login as a Videographer
1. Go to http://localhost:5174
2. Login with a videographer account

### 4.2 Open a Project
1. Click on any project in your dashboard
2. Click "Upload Files" or similar button

### 4.3 Sign in to Google Drive
1. You'll see a button: **"Sign in with Google"**
2. Click it
3. A Google OAuth popup will appear
4. Select your Google account
5. Click **"Allow"** to grant access

### 4.4 Upload a Video
1. After signing in, you'll see the upload area
2. Click to select a video file
3. Click **"Upload to Google Drive"**
4. Watch the progress bar
5. Success! ✅

### 4.5 Verify in Google Drive
1. Open your Google Drive: https://drive.google.com
2. You should see a new folder structure:
   ```
   Production Files/
   └── BCH-1001/  (or whatever the project ID is)
       ├── Raw Footage/
       │   └── your-video.mp4
       ├── Edited Videos/
       └── Final Videos/
   ```

---

## How It Works

### Before (Service Account - BROKEN):
```
User uploads → Service account tries to write to personal Drive → ❌ ERROR
```

### Now (OAuth - WORKS):
```
User clicks upload → Google OAuth popup → User signs in → File uploads to THEIR Drive → ✅ SUCCESS
```

### Folder Structure Created:
```
Production Files/
├── [Project ID 1]/
│   ├── Raw Footage/
│   ├── Edited Videos/
│   └── Final Videos/
├── [Project ID 2]/
│   ├── Raw Footage/
│   ├── Edited Videos/
│   └── Final Videos/
...
```

Each videographer's files go to **their own Google Drive**, automatically organized by project!

---

## Benefits

✅ **No more OAuth errors** - Uses proper user authentication
✅ **Personal Drive storage** - Each videographer uses their own Google Drive
✅ **Automatic organization** - Folders created automatically by project ID
✅ **No storage limits** - Uses each user's personal Drive storage
✅ **Easy sharing** - Videographers can easily share folders from their own Drive

---

## Troubleshooting

### Issue: "This app's request is invalid"
**Solution:** Make sure you added the correct redirect URIs in Google Cloud Console:
- `http://localhost:5174`
- `http://localhost:5173`

### Issue: "Access blocked: This app isn't verified"
**Solution:** This is normal during development. Click **"Advanced"** → **"Go to Viral Content Analyzer (unsafe)"** to proceed. This warning won't appear once you publish the app.

### Issue: OAuth popup is blocked
**Solution:** Make sure pop-ups are enabled in your browser settings for localhost.

### Issue: Folders not appearing in Google Drive
**Solution:**
1. Check if you signed in with the correct Google account
2. Refresh your Google Drive
3. Check the "My Drive" section (not "Shared with me")

### Issue: "Failed to sign in to Google Drive"
**Solution:**
1. Clear browser cache and cookies
2. Try a different browser
3. Make sure the Google Client ID is correct in `.env`
4. Restart the frontend server

---

## For Production Deployment

When deploying to production (your VPS), update the OAuth credentials:

1. Go back to Google Cloud Console → Credentials
2. Edit your OAuth client ID
3. Add your production URLs:
   - **Authorized JavaScript origins**: `https://yourdomain.com`
   - **Authorized redirect URIs**: `https://yourdomain.com`
4. Update `frontend/.env.production`:
   ```env
   VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
   ```
5. Rebuild and deploy

---

## Summary

🎉 **Setup Complete!**

- ✅ Google OAuth credentials created
- ✅ Frontend configured with Client ID
- ✅ Upload component ready
- ✅ VideographerDashboard updated
- ✅ Files upload to personal Google Drive
- ✅ Automatic folder organization

**Test it now by uploading a video!**
