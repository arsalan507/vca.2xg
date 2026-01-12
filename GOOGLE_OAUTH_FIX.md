# Fix Google OAuth Error - Step by Step

## Problem
You're seeing: `Error 400: redirect_uri_mismatch` when trying to upload files to Google Drive.

## Root Cause
The OAuth redirect URI in your code doesn't match what's configured in Google Cloud Console.

## Solution: Add Authorized Redirect URIs

### Step 1: Go to Google Cloud Console
1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: **"Video Production Hub"** or **"video-production-hub"**

### Step 2: Navigate to Credentials
1. Click on the menu (☰) → **APIs & Services** → **Credentials**
2. Find your **OAuth 2.0 Client ID** (it should be named something like "Web client" or similar)
3. Click on it to edit

### Step 3: Add Authorized JavaScript Origins
In the **Authorized JavaScript origins** section, add:
```
http://localhost:5174
http://localhost:5173
https://your-production-domain.com
```

### Step 4: Add Authorized Redirect URIs
In the **Authorized redirect URIs** section, add:
```
http://localhost:5174
http://localhost:5173
https://your-production-domain.com
```

**Important:** The redirect URIs must match your application's origin exactly (including the port number).

### Step 5: Save and Test
1. Click **Save** at the bottom
2. Wait 1-2 minutes for changes to propagate
3. Refresh your app and try uploading again

## Current Setup Detection

Your app is running on: **http://localhost:5174**

So you MUST add exactly:
- JavaScript Origin: `http://localhost:5174`
- Redirect URI: `http://localhost:5174`

## Verification Checklist

- [ ] Added `http://localhost:5174` to Authorized JavaScript origins
- [ ] Added `http://localhost:5174` to Authorized redirect URIs
- [ ] Clicked Save in Google Cloud Console
- [ ] Waited 1-2 minutes
- [ ] Refreshed the application
- [ ] Tried uploading again

## If Still Not Working

1. Check that you have both **API Key** and **Client ID** configured:
   - Go to Settings page
   - Verify Google API Key is set
   - Verify Google Client ID is set

2. Make sure Google Drive API is enabled:
   - Go to APIs & Services → Library
   - Search for "Google Drive API"
   - Click Enable if not already enabled

## Alternative: Use Service Account (Advanced)

If you want to avoid user authentication entirely, you'll need to:
1. Create a Supabase Edge Function
2. Store service account credentials securely in Supabase
3. Upload files via the backend function

This is more secure but requires backend implementation. Let me know if you want help with this approach instead.
