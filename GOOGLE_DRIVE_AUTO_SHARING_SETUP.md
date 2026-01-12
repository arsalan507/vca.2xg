# Google Drive Auto-Sharing Setup Guide

## What This Does

When videographers upload files to their personal Google Drive, the files and folders are **automatically shared** with the admin's Google account. This allows admins to view and review files without needing access to each videographer's Drive.

---

## How It Works

1. **Videographer uploads file** → File goes to their personal Google Drive
2. **Auto-sharing triggers** → File is automatically shared with admin email
3. **Admin can view** → Admin can access the file from their own Google account

**Key Features:**
- Admins get read-only access (can view but not edit)
- No notification emails sent (silent sharing)
- Folders are also shared for easy navigation
- Works across different Google accounts

---

## Setup Steps

### 1. Configure Admin Email

The admin email is already configured in `frontend/.env.local`:

```env
VITE_ADMIN_GOOGLE_EMAIL="arsalanahmed507@gmail.com"
```

**To change it:**
1. Open `frontend/.env.local`
2. Update the email address to your admin's Google account
3. Save the file
4. Restart the development server

### 2. Restart Development Server

After adding the environment variable, restart your development server:

```bash
cd frontend
npm run dev
```

### 3. Test the Auto-Sharing

1. **As Videographer:**
   - Sign in with a videographer account
   - Create a new project
   - Upload a video file
   - Check console logs - you should see: `✅ Shared file [...] with arsalanahmed507@gmail.com`

2. **As Admin:**
   - Sign in with the admin account (`arsalanahmed507@gmail.com`)
   - Go to your Google Drive
   - Look for "Shared with me" section
   - You should see the uploaded files/folders there

---

## How Sharing Works

### Files Shared:
- All uploaded video files
- Production Files folder (root)
- Project-specific folders (e.g., GEN-1767940087)
- Type-specific folders (Raw Footage, Edited Videos, etc.)

### Permission Level:
- **Reader** (view only) - Admins can view but not edit or delete

### Console Logs:
```
✅ Created folder: Production Files
✅ Shared folder [...] with arsalanahmed507@gmail.com
✅ Created folder: GEN-1767940087
✅ Shared folder [...] with arsalanahmed507@gmail.com
✅ Created folder: Raw Footage
✅ Shared folder [...] with arsalanahmed507@gmail.com
✅ Uploaded: video.mp4
✅ Shared file [...] with arsalanahmed507@gmail.com
```

---

## Accessing Shared Files as Admin

### Option 1: Shared with Me (Recommended)
1. Go to [Google Drive](https://drive.google.com)
2. Click "Shared with me" in the left sidebar
3. You'll see all files shared by videographers
4. Files are organized by project ID

### Option 2: Add to My Drive (Optional)
1. Right-click on a shared folder
2. Select "Add shortcut to Drive"
3. Choose where to place it in your Drive
4. Access it like your own folder

---

## Troubleshooting

### Files Not Appearing in "Shared with Me"

**Check 1: Admin email configured correctly**
- Open `frontend/.env.local`
- Verify `VITE_ADMIN_GOOGLE_EMAIL` matches your admin's Google account
- Restart dev server after changes

**Check 2: Console logs**
- Open browser DevTools (F12)
- Look for "✅ Shared file" messages
- If you see "❌ Share error", check the error message

**Check 3: Google Drive permissions**
- Files are shared with read-only access
- No email notifications are sent
- Files appear under "Shared with me" section

### Permission Errors

If you see permission errors in console:
```
❌ Share error: insufficient permissions
```

**Solution:** The OAuth scope needs to be updated to allow sharing.

Currently the scope is: `https://www.googleapis.com/auth/drive.file`

This scope already includes permission to share files created by the app.

### Sharing Fails Silently

Auto-sharing failures are **non-blocking** - they won't prevent file upload:
- Upload will succeed even if sharing fails
- Console will show warning: `Failed to share file with [...], but upload succeeded`
- Videographer won't see any error
- Check console for specific error details

---

## Alternative: Shared Company Account

If auto-sharing doesn't work for your workflow, you can use a **shared company Google account** instead:

### Setup:
1. Create a company Google account: `production@yourcompany.com`
2. All users (videographers, editors, admins) sign in with this account
3. Everyone has access to all files
4. No sharing needed

### To Disable Auto-Sharing:
1. Open `frontend/.env.local`
2. Remove or comment out `VITE_ADMIN_GOOGLE_EMAIL`
3. Restart dev server

---

## Security Notes

- **Read-Only Access:** Admins can only view files, not edit or delete
- **No Notifications:** Sharing happens silently without email spam
- **Scope Limited:** App can only share files it created (not other Drive files)
- **Secure:** Uses official Google Drive API with OAuth authentication

---

## Summary

✅ **Automatic file sharing** with admin email
✅ **Read-only access** for admins
✅ **No email notifications** (silent sharing)
✅ **Non-blocking** (upload succeeds even if sharing fails)
✅ **Organized by project** in "Shared with me"

This setup provides the best of both worlds:
- Videographers keep files in their own Drive (privacy)
- Admins can access all files (visibility)
- No manual sharing needed (automation)

🎉 **You're all set!**
