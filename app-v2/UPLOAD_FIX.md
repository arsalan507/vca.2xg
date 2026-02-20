# VCA Upload Fix - Google Drive OAuth Issue

## Problem
After signing in to Google, video uploads are failing.

## Root Causes

### 1. Token Not Persisting
The OAuth token is stored in memory only. After sign-in, if the component remounts or page refreshes, token is lost.

### 2. Drive API Not Ready
Upload attempts might happen before Google Drive API is fully initialized.

### 3. Silent Failures
Errors in the upload flow aren't being logged properly.

---

## Solution

### Step 1: Add Token Persistence to googleDriveOAuthService.ts

Add localStorage persistence for the access token:

```typescript
// File: app-v2/src/services/googleDriveOAuthService.ts

// Add after line 93 (in GoogleDriveOAuthService class)

private TOKEN_STORAGE_KEY = 'google_drive_token';
private TOKEN_EXPIRY_KEY = 'google_drive_token_expiry';

/**
 * Load saved token from localStorage
 */
private loadSavedToken(): void {
  try {
    const savedToken = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    const savedExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);

    if (savedToken && savedExpiry) {
      const expiryTime = parseInt(savedExpiry, 10);
      if (Date.now() < expiryTime) {
        this.accessToken = savedToken;
        this.tokenExpiresAt = expiryTime;
        console.log('[GoogleDrive] Restored token from storage');
      } else {
        console.log('[GoogleDrive] Saved token expired, clearing');
        this.clearSavedToken();
      }
    }
  } catch (error) {
    console.error('[GoogleDrive] Error loading saved token:', error);
  }
}

/**
 * Save token to localStorage
 */
private saveToken(token: string, expiresAt: number): void {
  try {
    localStorage.setItem(this.TOKEN_STORAGE_KEY, token);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, String(expiresAt));
    console.log('[GoogleDrive] Token saved to storage');
  } catch (error) {
    console.error('[GoogleDrive] Error saving token:', error);
  }
}

/**
 * Clear saved token
 */
private clearSavedToken(): void {
  localStorage.removeItem(this.TOKEN_STORAGE_KEY);
  localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
}

// Update initialize() method (line 98-102)
async initialize(): Promise<void> {
  if (this.gapiInited && this.gisInited) {
    // Try to restore token from storage
    this.loadSavedToken();
    return;
  }
  await this.loadGISLibrary();
  await this.loadGAPILibrary();
  // Try to restore token after libraries load
  this.loadSavedToken();
}

// Update initializeGIS() callback (line 133-143)
private initializeGIS(): void {
  this.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (response: any) => {
      if (response.error) {
        console.error('[GoogleDrive] GIS error:', response);
        return;
      }
      this.accessToken = response.access_token;
      const expiresIn = (response.expires_in || 3600) - 300;
      this.tokenExpiresAt = Date.now() + expiresIn * 1000;

      // SAVE TOKEN TO STORAGE
      this.saveToken(this.accessToken, this.tokenExpiresAt);

      console.log('[GoogleDrive] Access token received, expires in', expiresIn, 'seconds');
    },
  });
  this.gisInited = true;
}

// Update signOut() method (line 241-260)
async signOut(): Promise<void> {
  // ... existing code ...

  // ADD: Clear saved token
  this.clearSavedToken();
}
```

### Step 2: Add Better Error Logging to Upload Flow

Update the uploadFiles() function in both UploadPage.tsx files:

```typescript
// In videographerUploadPage.tsx, around line 191-243
try {
  console.log('[Upload] Starting upload for:', file.file.name);

  // Get or create folder structure in user's Drive
  console.log('[Upload] Getting folder for project:', project.content_id || project.id);
  const folderId = await googleDriveOAuthService.getOrCreateFolderForFileType(
    project.content_id || project.id,
    driveFileType
  );
  console.log('[Upload] Folder ID:', folderId);

  // ... existing rename logic ...

  // Upload to user's Google Drive
  console.log('[Upload] Starting Drive upload...');
  const result = await googleDriveOAuthService.uploadFile(
    file.file,
    folderId,
    (progress: UploadProgress) => {
      console.log('[Upload] Progress:', progress.percentage + '%');
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, progress: progress.percentage } : f
        )
      );
    },
    file.id,
    renamedFileName
  );
  console.log('[Upload] Drive upload complete:', result);

  // Record file in database
  console.log('[Upload] Saving to database...');
  const dbRecord = await productionFilesService.createFileRecord({
    analysisId: project.id,
    fileType: selectedFileType,
    fileName: displayName,
    fileUrl: result.webViewLink,
    fileId: result.fileId,
    fileSize: result.size,
    mimeType: file.file.type,
  });
  console.log('[Upload] Database record saved:', dbRecord.id);

  // ... rest of success handling ...
} catch (error) {
  console.error('[Upload] FULL ERROR:', error);
  console.error('[Upload] Error stack:', error instanceof Error ? error.stack : 'No stack');

  // ... existing error handling ...
}
```

### Step 3: Add Upload Readiness Check

Add a function to verify everything is ready before upload:

```typescript
// Add to UploadPage.tsx after the checkGoogleSignIn function

const verifyUploadReadiness = async (): Promise<boolean> => {
  console.log('[Upload] Verifying upload readiness...');

  // Check 1: Google signed in
  const signedIn = await googleDriveOAuthService.isUserSignedIn();
  if (!signedIn) {
    console.error('[Upload] Not signed in to Google');
    toast.error('Please sign in to Google Drive first');
    return false;
  }
  console.log('[Upload] ✓ Signed in to Google');

  // Check 2: Drive API initialized
  try {
    await googleDriveOAuthService.initialize();
    console.log('[Upload] ✓ Google Drive API initialized');
  } catch (error) {
    console.error('[Upload] Drive API initialization failed:', error);
    toast.error('Failed to initialize Google Drive API');
    return false;
  }

  // Check 3: Project loaded
  if (!project) {
    console.error('[Upload] No project loaded');
    toast.error('Project not loaded');
    return false;
  }
  console.log('[Upload] ✓ Project loaded:', project.id);

  console.log('[Upload] All checks passed!');
  return true;
};

// Then update uploadFiles() to call this first:
const uploadFiles = async () => {
  // Verify readiness FIRST
  const ready = await verifyUploadReadiness();
  if (!ready) return;

  // ... rest of existing code ...
};
```

### Step 4: Force Re-initialization on Upload

Add this to handle stale API instances:

```typescript
// In uploadFiles(), before the file loop (around line 178)

// Force re-check and re-initialize
console.log('[Upload] Re-checking Google sign-in status...');
const stillSignedIn = await googleDriveOAuthService.isUserSignedIn();
if (!stillSignedIn) {
  toast.error('Google session expired. Please sign in again.');
  setIsSignedIn(false);
  setIsUploading(false);
  return;
}

// Ensure Drive API is initialized
try {
  await googleDriveOAuthService.initialize();
} catch (error) {
  console.error('[Upload] Failed to initialize Drive API:', error);
  toast.error('Failed to connect to Google Drive');
  setIsUploading(false);
  return;
}
```

---

## Testing Steps

1. **Clear existing data**:
   ```javascript
   // In browser console
   localStorage.clear()
   ```

2. **Sign in to Google**

3. **Check console for**:
   - `[GoogleDrive] Token saved to storage`
   - `[GoogleDrive] Access token received`

4. **Try uploading a file**

5. **Watch console for**:
   - `[Upload] Verifying upload readiness...`
   - `[Upload] ✓ Signed in to Google`
   - `[Upload] ✓ Google Drive API initialized`
   - `[Upload] Starting upload for: filename.mp4`

---

## If Still Failing

Check browser console for the exact error and share:
1. The full error message
2. Which step it fails at
3. Any 401/403 errors in Network tab

## Common Issues

### "Failed to create folder"
- Check Google Client ID is correct
- Verify Drive scope is granted (not just profile scope)

### "Upload failed: 401"
- Token expired
- Clear localStorage and sign in again

### "Failed to save file record"
- Database/PostgREST issue (separate from Drive)
- Check VITE_POSTGREST_URL is accessible

### "Network error during upload"
- File too large (>100MB may timeout)
- Network interrupted
- Try smaller file first
