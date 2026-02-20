# ✅ UPLOAD FIX APPLIED - Google Drive Token Persistence

## What Was Fixed

The **main issue** was that Google OAuth tokens were stored only in memory. After signing in:
- Tokens would be lost if the page refreshed
- Tokens would be lost if the component re-rendered
- **Result**: User appeared "signed in" but uploads would fail

## Changes Made

### 1. Added Token Persistence (localStorage)
**File**: `app-v2/src/services/googleDriveOAuthService.ts`

Added three new methods:
- `loadSavedToken()` - Restores token from localStorage on startup
- `saveToken()` - Saves token to localStorage after sign-in
- `clearSavedToken()` - Removes token on sign-out

### 2. Updated Key Methods

**`initialize()`**
- Now loads saved token from localStorage if available
- Restores session automatically on page load

**`initializeGIS()` callback**
- Saves token to localStorage immediately after receiving it
- Logs expiration time for debugging

**`signIn()`**
- Saves token to localStorage after verification
- Clears saved token if Drive API verification fails

**`signOut()`**
- Clears saved token from localStorage

**`isUserSignedIn()`**
- Attempts to restore token from localStorage if not in memory
- Clears expired tokens automatically

## How to Test

### Step 1: Clear Old Data
```javascript
// In browser console (F12)
localStorage.clear()
location.reload()
```

### Step 2: Sign In to Google
1. Go to Videographer or Editor Upload page
2. Click "Sign in with Google"
3. Grant Drive permissions
4. Check browser console for:
   ```
   [GoogleDrive] Access token received, expires in XX seconds
   [GoogleDrive] Token saved to storage (expires in XX minutes)
   [GoogleDrive] Google Drive API access verified
   ```

### Step 3: Verify Token Persistence
```javascript
// In browser console
localStorage.getItem('google_drive_token')  // Should show token
localStorage.getItem('google_drive_token_expiry')  // Should show timestamp
```

### Step 4: Test Upload Without Refresh
1. Select a video file
2. Upload should start immediately
3. Check console for:
   ```
   [Upload] Starting upload for: filename.mp4
   [Upload] Getting folder for project: CONTENT_ID
   [Upload] Folder ID: xxxxx
   [Upload] Starting Drive upload...
   [Upload] Progress: XX%
   [Upload] Drive upload complete
   ```

### Step 5: Test Upload After Refresh
1. **Refresh the page** (F5)
2. You should see:
   ```
   [GoogleDrive] Restored token from storage (expires in XX minutes)
   ```
3. Try uploading another file - should work without re-signing in

### Step 6: Test Sign Out
1. Sign out from Google Drive
2. Check console for:
   ```
   [GoogleDrive] Cleared saved token
   ```
3. Verify localStorage is cleared:
   ```javascript
   localStorage.getItem('google_drive_token')  // Should be null
   ```

## Expected Behavior Now

### ✅ Before Fix
- Sign in ✅
- Upload works ✅
- **Page refresh** → Token lost ❌
- **Must sign in again** ❌

### ✅ After Fix
- Sign in ✅
- Upload works ✅
- **Page refresh** → Token restored ✅
- **Upload still works** ✅
- Token auto-expires after ~55 minutes ✅

## Troubleshooting

### "Upload failed: 401"
**Problem**: Token expired or invalid

**Solution**:
```javascript
// Clear and sign in again
localStorage.removeItem('google_drive_token')
localStorage.removeItem('google_drive_token_expiry')
// Then sign in to Google again
```

### "Failed to create folder"
**Problem**: Insufficient Drive permissions

**Solution**:
1. Sign out
2. Sign in again
3. Make sure you grant ALL permissions (not just profile)
4. Look for scope: `https://www.googleapis.com/auth/drive`

### Upload starts but fails silently
**Problem**: Network issue or file too large

**Check**:
1. Browser Network tab for failed requests
2. File size (keep under 100MB for testing)
3. Console for error messages

### Token expires too quickly
**Current**: Token expires in ~55 minutes (3600s - 300s buffer)

**To extend** (if needed):
```typescript
// In googleDriveOAuthService.ts line ~196
const expiresIn = (response.expires_in || 3600) - 300;  // 5 min buffer
// Change to:
const expiresIn = (response.expires_in || 3600) - 60;   // 1 min buffer
```

## Debug Commands

```javascript
// Check if signed in
await googleDriveOAuthService.isUserSignedIn()

// Check token expiry
const expiry = localStorage.getItem('google_drive_token_expiry')
const minutesLeft = (parseInt(expiry) - Date.now()) / 1000 / 60
console.log('Token expires in', minutesLeft, 'minutes')

// Manual sign out
await googleDriveOAuthService.signOut()

// Clear all auth data
localStorage.clear()
```

## Next Steps

1. **Test the fix** following the steps above
2. **If uploads still fail**, check browser console for exact error
3. **Share the error** with:
   - Full error message
   - Network tab screenshot (if 401/403)
   - Which step it failed at

## Files Modified

- ✅ `app-v2/src/services/googleDriveOAuthService.ts` (Token persistence added)

## Files NOT Modified (but reference the fix doc for future enhancements)

- `app-v2/src/pages/videographer/UploadPage.tsx`
- `app-v2/src/pages/editor/UploadPage.tsx`

These can be enhanced with the logging suggestions from `UPLOAD_FIX.md` if you still face issues.
