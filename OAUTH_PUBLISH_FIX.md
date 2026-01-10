# Fix: Publish OAuth App for Testing

## Problem:
Email not eligible as test user in Google OAuth consent screen.

## ✅ Solution: Publish App to "Production" (Testing Mode)

Don't worry - "Publishing to production" for internal testing is safe and doesn't require Google verification for personal use.

---

## Step-by-Step:

### Step 1: Go to OAuth Consent Screen

Visit: https://console.cloud.google.com/apis/credentials/consent

### Step 2: Review Your App Configuration

Make sure these are filled in:

**App information:**
- App name: `Video Production Hub` (or your choice)
- User support email: `arsalanahmed507@gmail.com`
- App logo: (optional, can skip)

**App domain:**
- Application home page: (can leave blank for testing)
- Privacy policy: (can leave blank for testing)
- Terms of service: (can leave blank for testing)

**Authorized domains:** (optional for localhost testing)

**Developer contact information:**
- Email addresses: `arsalanahmed507@gmail.com`

### Step 3: Configure Scopes

1. Click **"EDIT APP"** or **"ADD OR REMOVE SCOPES"**
2. Make sure you have this scope:
   ```
   https://www.googleapis.com/auth/drive.file
   ```
3. This scope allows: "See, edit, create, and delete only the specific Google Drive files you use with this app"
4. Click **"UPDATE"** or **"SAVE AND CONTINUE"**

### Step 4: Skip Test Users (Since It's Not Working)

1. In the "Test users" section, just click **"SAVE AND CONTINUE"**
2. We'll publish the app instead

### Step 5: Publish the App

1. You should see a **"PUBLISH APP"** button or link
2. Click **"PUBLISH APP"**
3. A warning will appear saying "Your app will be available to any user with a Google Account"
4. Click **"CONFIRM"**

### Step 6: Verification Status

You'll see a warning:
```
⚠️ Your app needs verification
```

**This is okay!** For personal/internal use, you can bypass this:
- When users try to login, they'll see "This app hasn't been verified"
- They can click **"Advanced"** → **"Go to Video Production Hub (unsafe)"**
- This is **safe for your own app** - it just means Google hasn't reviewed it

---

## Alternative: Use Internal User Type (If You Have Google Workspace)

If you have Google Workspace (not regular Gmail):

1. In OAuth consent screen, change **User type** from "External" to "Internal"
2. This makes the app available to all users in your organization
3. No verification needed
4. No test user restrictions

**Note:** This only works with Google Workspace accounts, not personal Gmail.

---

## After Publishing:

### What Happens:
1. ✅ Anyone with a Google Account can use your app
2. ⚠️ They'll see "unverified app" warning
3. ✅ They can click "Advanced" → "Continue" to proceed
4. ✅ Upload will work perfectly

### Try Upload Again:
1. Refresh browser at http://localhost:5174/
2. Login as videographer
3. Try file upload
4. You'll see OAuth popup
5. Click **"Advanced"** → **"Go to Video Production Hub (unsafe)"**
6. Click **"Allow"**
7. Upload proceeds! ✅

---

## Security Note:

**Is this safe?**
- ✅ Yes, for your own app
- ✅ You control the code
- ✅ Only requests Drive file access (minimal scope)
- ✅ Only works with files created by your app

**The "unverified" warning exists because:**
- Google hasn't manually reviewed your app
- For public apps, you'd need verification (takes weeks)
- For personal/team apps, bypass is fine

---

## Summary Checklist:

- [ ] Go to OAuth Consent Screen
- [ ] Fill in required fields (app name, support email, developer email)
- [ ] Add Drive scope (`https://www.googleapis.com/auth/drive.file`)
- [ ] Skip test users section
- [ ] Click "PUBLISH APP"
- [ ] Click "CONFIRM" on warning
- [ ] Try upload again
- [ ] Click "Advanced" → "Continue" when you see unverified warning
- [ ] Allow permissions
- [ ] Upload works! ✅

---

## Still Having Issues?

### Check These:

1. **Correct Project?**
   - Make sure you're in "Video Production Hub" project
   - Check project dropdown at top of Google Cloud Console

2. **API Enabled?**
   - Go to: https://console.cloud.google.com/apis/library
   - Search "Google Drive API"
   - Should say "API Enabled" (green checkmark)

3. **Correct Credentials?**
   - In your app Settings, verify:
     - API Key matches Google Cloud Console
     - Client ID matches Google Cloud Console
     - Both end with proper format

4. **Clear Browser Data?**
   - Clear cookies and cache
   - Try in incognito/private window
   - Try different browser

---

**Bottom line:** Publishing your app for testing is **safe** and **normal** for personal/team apps. The "unverified" warning is expected and can be bypassed safely.
