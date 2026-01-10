# Fix OAuth Error: redirect_uri_mismatch

## Current Error:
```
Error 400: redirect_uri_mismatch
Access blocked: This app's request is invalid
```

## ✅ Solution: Update Google Cloud Console OAuth Settings

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/apis/credentials
2. Make sure you're in the correct project (Viral Content Analyzer or whatever you named it)

### Step 2: Edit OAuth 2.0 Client ID

1. Find your **OAuth 2.0 Client ID** in the credentials list
2. Click the **pencil icon (Edit)** to edit it

### Step 3: Add Authorized Origins

Under **"Authorized JavaScript origins"**, add these URLs:

```
http://localhost:5174
http://localhost:5173
http://127.0.0.1:5174
http://127.0.0.1:5173
```

**Why multiple?** Covers different port scenarios and localhost vs 127.0.0.1

### Step 4: Add Authorized Redirect URIs

Under **"Authorized redirect URIs"**, add these URLs:

```
http://localhost:5174
http://localhost:5174/
http://localhost:5173
http://localhost:5173/
http://127.0.0.1:5174
http://127.0.0.1:5174/
http://127.0.0.1:5173
http://127.0.0.1:5173/
```

**Important:** Include both with and without trailing slash

### Step 5: For Production (Later)

When you deploy to production, add your production URLs:

```
https://yourdomain.com
https://yourdomain.com/
```

### Step 6: Save and Wait

1. Click **"Save"** at the bottom
2. **Wait 5 minutes** for Google to propagate the changes
3. Clear browser cache (Cmd+Shift+Delete on Mac, Ctrl+Shift+Delete on Windows)
4. Try uploading again

---

## 🔍 Verify Your Settings

Your OAuth Client should look like this:

**Application type:** Web application

**Authorized JavaScript origins:**
- http://localhost:5174
- http://localhost:5173
- http://127.0.0.1:5174
- http://127.0.0.1:5173

**Authorized redirect URIs:**
- http://localhost:5174
- http://localhost:5174/
- http://localhost:5173
- http://localhost:5173/
- http://127.0.0.1:5174
- http://127.0.0.1:5174/
- http://127.0.0.1:5173
- http://127.0.0.1:5173/

---

## 🚀 After Fixing

1. **Refresh your browser** at http://localhost:5174/
2. **Login as videographer**
3. **Try file upload** - OAuth popup should work now
4. **Allow permissions** when prompted
5. **Upload should succeed** ✅

---

## 🐛 Still Getting Errors?

### Check These:

1. **Correct Client ID?**
   - Make sure the Client ID in Settings matches the one you edited in Google Cloud Console
   - They should end with `.apps.googleusercontent.com`

2. **Popup Blocked?**
   - Allow popups for localhost in your browser settings
   - Look for popup blocker icon in address bar

3. **OAuth Consent Screen Status?**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - If it says "Testing", add your email as a test user
   - Or publish the app (for wider use)

4. **Wait Time?**
   - Google changes can take up to 5 minutes to propagate
   - Be patient and try again after waiting

---

## 📋 Quick Checklist

- [ ] Edited OAuth 2.0 Client ID in Google Cloud Console
- [ ] Added all localhost variations to JavaScript origins
- [ ] Added all localhost variations to redirect URIs
- [ ] Saved changes
- [ ] Waited 5 minutes
- [ ] Cleared browser cache
- [ ] Refreshed the app
- [ ] Tried upload again

---

**Note:** The code has been updated to use popup mode instead of redirect mode, which is more reliable for development environments.
