# Fix OAuth Error: access_denied (403)

## Current Error:
```
Error 403: access_denied
Video Production Hub has not completed the Google verification process
The app is currently being tested and can only be accessed by developer-approved testers
```

## ✅ Solution: Add Test Users to OAuth Consent Screen

Your OAuth app is in "Testing" mode, which means only approved test users can access it.

---

## Step-by-Step Fix:

### Step 1: Go to OAuth Consent Screen

1. Visit: https://console.cloud.google.com/apis/credentials/consent
2. Make sure you're in the correct project (Video Production Hub)

### Step 2: Add Test Users

1. You should see **"OAuth consent screen"** configuration
2. Look for **"Test users"** section
3. Click **"+ ADD USERS"** button

### Step 3: Add Email Addresses

Add these email addresses as test users:

```
arsalanahmed507@gmail.com
```

Add any other team members who need to use the upload feature:
- Your videographers' emails
- Your editors' emails
- Any admin emails

**Note:** You can add up to 100 test users while in Testing mode.

### Step 4: Save

1. Click **"Save"**
2. Wait a few seconds for changes to apply

---

## Alternative: Publish the App (For Wider Use)

If you want **anyone** to use your app without adding them individually:

### Option A: Publish to Internal (Google Workspace Only)

If you have a Google Workspace organization:
1. Change publishing status from "Testing" to "Internal"
2. This allows all users in your organization

### Option B: Publish Externally (Not Recommended Yet)

⚠️ **Not recommended for now** because it requires Google verification which can take weeks.

---

## Quick Fix Summary:

1. ✅ Go to: https://console.cloud.google.com/apis/credentials/consent
2. ✅ Click **"+ ADD USERS"** in Test users section
3. ✅ Add: `arsalanahmed507@gmail.com`
4. ✅ Add any other team member emails
5. ✅ Click **"Save"**
6. ✅ Try upload again immediately (no waiting needed)

---

## After Adding Test Users:

1. **Refresh** your browser at http://localhost:5174/
2. **Clear cache** if needed (Cmd+Shift+Delete)
3. **Login as videographer**
4. **Try file upload** again
5. **OAuth popup should work** ✅

---

## 📋 Verify Your OAuth Consent Screen:

Your consent screen should show:

**Publishing status:** Testing ⚠️

**Test users:**
- arsalanahmed507@gmail.com
- (other team members...)

**User type:** External

**Scopes:**
- Google Drive API (.../auth/drive.file)

---

## 🎯 Expected Flow After Fix:

1. Click upload button
2. OAuth popup opens
3. Shows: "Video Production Hub wants to access your Google Drive"
4. Click "Allow"
5. Upload proceeds with progress bar
6. Success! ✅

---

## 🐛 Still Getting Errors?

### "This app isn't verified"
- Normal for apps in Testing mode
- Click **"Continue"** (or "Advanced" → "Go to Video Production Hub")
- This is safe for your own app

### Popup Blocked
- Allow popups for localhost:5174 in browser settings
- Look for popup blocker icon in address bar

### Wrong Email Error
- Make sure you're logged into Google with the email you added as test user
- Try logging out of all Google accounts and log back in with correct one

---

## 📚 Additional Resources:

- [Google OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [OAuth Credentials](https://console.cloud.google.com/apis/credentials)
- [Test Users Documentation](https://support.google.com/cloud/answer/10311615)

---

**Note:** In Testing mode, you can have up to 100 test users. This is perfect for your team until you're ready to publish the app publicly.
