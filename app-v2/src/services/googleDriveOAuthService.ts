/**
 * Google Drive OAuth Upload Service (Using Google Identity Services - GIS)
 * Uploads files to videographer's personal Google Drive using OAuth
 *
 * Performance optimizations for large video files (1GB+):
 * - Chunked resumable upload (16MB chunks) with auto-resume on failure
 * - Exponential backoff retry (3 attempts per chunk)
 * - Debounced progress callbacks (max 2/sec to avoid React re-render storms)
 * - Abort support for cancelling in-flight uploads
 */

// Google API configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
// Use drive scope to allow file creation, access, and sharing
const SCOPES = 'https://www.googleapis.com/auth/drive';
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_GOOGLE_EMAIL || '';

// Upload constants
const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB chunks (must be multiple of 256KiB)
const MAX_RETRIES = 3;
const FIVE_MB = 5 * 1024 * 1024;
const PROGRESS_THROTTLE_MS = 500; // Max 2 progress updates per second

declare const google: any;
declare const gapi: any;

export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  webContentLink: string;
  size: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Extract Google Drive file ID from a URL or return as-is if already an ID.
 */
export function extractDriveFileId(fileIdOrUrl: string): string {
  if (!fileIdOrUrl) return fileIdOrUrl;
  if (!fileIdOrUrl.includes('/') && !fileIdOrUrl.includes('?')) return fileIdOrUrl;
  const fileMatch = fileIdOrUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = fileIdOrUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return fileIdOrUrl;
}

/**
 * Build a direct download URL for a Google Drive file.
 */
export function getDriveDownloadUrl(fileIdOrUrl: string): string {
  const fileId = extractDriveFileId(fileIdOrUrl);
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a throttled version of a progress callback
 */
function createThrottledProgress(
  onProgress: ((progress: UploadProgress) => void) | undefined,
  intervalMs: number = PROGRESS_THROTTLE_MS
): (progress: UploadProgress) => void {
  if (!onProgress) return () => {};
  let lastCall = 0;
  return (progress: UploadProgress) => {
    const now = Date.now();
    if (progress.percentage >= 100 || now - lastCall >= intervalMs) {
      lastCall = now;
      onProgress(progress);
    }
  };
}

class GoogleDriveOAuthService {
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private gapiInited = false;
  private gisInited = false;
  private activeUploads: Map<string, XMLHttpRequest> = new Map();

  // LocalStorage keys for token persistence
  private readonly TOKEN_STORAGE_KEY = 'google_drive_token';
  private readonly TOKEN_EXPIRY_KEY = 'google_drive_token_expiry';

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
          console.log('[GoogleDrive] Restored token from storage (expires in', Math.round((expiryTime - Date.now()) / 1000 / 60), 'minutes)');
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
      console.log('[GoogleDrive] Token saved to storage (expires in', Math.round((expiresAt - Date.now()) / 1000 / 60), 'minutes)');
    } catch (error) {
      console.error('[GoogleDrive] Error saving token:', error);
    }
  }

  /**
   * Clear saved token from localStorage
   */
  private clearSavedToken(): void {
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    console.log('[GoogleDrive] Cleared saved token');
  }

  /**
   * Initialize Google API and GIS
   */
  async initialize(): Promise<void> {
    if (this.gapiInited && this.gisInited) {
      // Try to restore token from storage if we don't have one
      if (!this.accessToken) {
        this.loadSavedToken();
      }
      return;
    }
    await this.loadGISLibrary();
    await this.loadGAPILibrary();
    // Try to restore token after libraries load
    this.loadSavedToken();
  }

  /**
   * Load Google Identity Services (GIS) library
   */
  private loadGISLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.accounts) {
        this.initializeGIS();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        this.initializeGIS();
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize GIS token client
   */
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
        // Token expires in expires_in seconds (default 3600). Set expiry 5 min early to be safe.
        const expiresIn = (response.expires_in || 3600) - 300;
        this.tokenExpiresAt = Date.now() + expiresIn * 1000;

        // Save token to localStorage for persistence
        if (this.accessToken) {
          this.saveToken(this.accessToken, this.tokenExpiresAt);
        }

        console.log('[GoogleDrive] Access token received, expires in', expiresIn, 'seconds');
      },
    });
    this.gisInited = true;
  }

  /**
   * Load Google API (gapi) library
   */
  private loadGAPILibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof gapi !== 'undefined' && gapi.client) {
        this.initializeGAPI();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('client', async () => {
          await this.initializeGAPI();
          resolve();
        });
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize GAPI client
   */
  private async initializeGAPI(): Promise<void> {
    await gapi.client.init({
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    this.gapiInited = true;
    console.log('Google Drive API initialized');
  }

  /**
   * Sign in to Google (request access token)
   */
  async signIn(): Promise<void> {
    await this.initialize();

    // Only skip re-auth if token exists AND is not expired
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      console.log('Already have valid access token');
      return;
    }

    // Clear expired token
    if (this.accessToken) {
      console.log('Access token expired, requesting new one');
      this.accessToken = null;
      this.tokenExpiresAt = 0;
    }

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient.callback = async (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          this.accessToken = response.access_token;
          const expiresIn = (response.expires_in || 3600) - 300;
          this.tokenExpiresAt = Date.now() + expiresIn * 1000;
          gapi.client.setToken({ access_token: this.accessToken });

          // Save token to localStorage for persistence
          if (this.accessToken) {
            this.saveToken(this.accessToken, this.tokenExpiresAt);
          }

          console.log('[GoogleDrive] Signed in to Google Drive');

          // Verify Drive API access with a test call
          try {
            await gapi.client.drive.about.get({ fields: 'user' });
            console.log('[GoogleDrive] Google Drive API access verified');
          } catch (verifyError: any) {
            console.error('[GoogleDrive] Drive API verification failed:', verifyError);
            this.accessToken = null;
            this.tokenExpiresAt = 0;
            this.clearSavedToken();
            reject(new Error('Google Drive access denied. Please ensure you granted Drive permissions.'));
            return;
          }

          resolve();
        };

        // Force re-authentication when token is expired (don't use prompt: '' which fails silently)
        this.tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (error: any) {
        console.error('Sign in error:', error);
        reject(error);
      }
    });
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<void> {
    // Abort all active uploads before revoking token
    for (const [key, xhr] of this.activeUploads) {
      xhr.abort();
      console.log(`Aborted upload on sign-out: ${key}`);
    }
    this.activeUploads.clear();

    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('[GoogleDrive] Access token revoked');
      });
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      gapi.client.setToken(null);
    }

    // Clear saved token from localStorage
    this.clearSavedToken();

    this.tokenClient = null;
    this.gisInited = false;
  }

  /**
   * Check if user is signed in
   */
  async isUserSignedIn(): Promise<boolean> {
    await this.initialize();

    // Try to restore token from storage if we don't have one
    if (!this.accessToken) {
      this.loadSavedToken();
    }

    // Verify token is still valid
    const isValid = this.accessToken !== null && Date.now() < this.tokenExpiresAt;

    if (!isValid && this.accessToken) {
      // Token expired, clear it
      console.log('[GoogleDrive] Token expired, clearing');
      this.clearSavedToken();
      this.accessToken = null;
      this.tokenExpiresAt = 0;
    }

    return isValid;
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(folderName: string, parentFolderId?: string): Promise<string> {
    await this.ensureSignedIn();

    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    try {
      const response = await gapi.client.drive.files.create({
        resource: metadata,
        fields: 'id',
      });

      console.log(`Created folder: ${folderName}`);
      return response.result.id;
    } catch (error: any) {
      console.error('Create folder error:', error);
      // If auth error, clear token so next ensureSignedIn() will re-authenticate
      if (error.status === 401 || error.result?.error?.code === 401) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
      }
      throw new Error(`Failed to create folder: ${error.result?.error?.message || error.message}`);
    }
  }

  /**
   * Find a folder by name
   */
  async findFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    await this.ensureSignedIn();

    try {
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      const response = await gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      const folders = response.result.files;
      if (folders && folders.length > 0) {
        return folders[0].id;
      }

      return null;
    } catch (error: any) {
      console.error('Find folder error:', error);
      // Re-throw auth errors instead of silently returning null
      if (error.status === 401 || error.status === 403 || error.result?.error?.code === 401 || error.result?.error?.code === 403) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        throw new Error(`Google Drive access error: ${error.result?.error?.message || 'Authentication failed. Please sign in again.'}`);
      }
      return null;
    }
  }

  /**
   * Get or create folder for specific file type
   */
  async getOrCreateFolderForFileType(
    projectId: string,
    fileType: 'raw-footage' | 'edited-video' | 'final-video'
  ): Promise<string> {
    await this.ensureSignedIn();

    const folderMap = {
      'raw-footage': 'Raw Footage',
      'edited-video': 'Edited Videos',
      'final-video': 'Final Videos',
    };

    const folderName = folderMap[fileType];

    // Create/find "Production Files" folder
    let rootFolderId = await this.findFolder('Production Files');
    let rootFolderCreated = false;
    if (!rootFolderId) {
      rootFolderId = await this.createFolder('Production Files');
      rootFolderCreated = true;
    }

    // Create/find project folder
    let projectFolderId = await this.findFolder(projectId, rootFolderId);
    let projectFolderCreated = false;
    if (!projectFolderId) {
      projectFolderId = await this.createFolder(projectId, rootFolderId);
      projectFolderCreated = true;
    }

    // Create/find the specific subfolder
    let targetFolderId = await this.findFolder(folderName, projectFolderId);
    let targetFolderCreated = false;
    if (!targetFolderId) {
      targetFolderId = await this.createFolder(folderName, projectFolderId);
      targetFolderCreated = true;
    }

    // Share folders with admin if configured
    if (ADMIN_EMAIL) {
      if (rootFolderCreated) {
        await this.shareFolderWithEmail(rootFolderId, ADMIN_EMAIL, 'reader');
      }
      if (projectFolderCreated) {
        await this.shareFolderWithEmail(projectFolderId, ADMIN_EMAIL, 'reader');
      }
      if (targetFolderCreated) {
        await this.shareFolderWithEmail(targetFolderId, ADMIN_EMAIL, 'reader');
      }
    }

    return targetFolderId;
  }

  /**
   * Upload file to Google Drive with progress tracking
   */
  async uploadFile(
    file: File,
    folderId: string,
    onProgress?: (progress: UploadProgress) => void,
    uploadKey?: string,
    fileName?: string
  ): Promise<UploadResult> {
    await this.ensureSignedIn();

    const throttledProgress = createThrottledProgress(onProgress);

    // If a custom fileName is provided, create a renamed File object
    const uploadFile = fileName ? new File([file], fileName, { type: file.type }) : file;

    try {
      const result = uploadFile.size > FIVE_MB
        ? await this.chunkedResumableUpload(uploadFile, folderId, throttledProgress, uploadKey)
        : await this.multipartUpload(uploadFile, folderId, throttledProgress, uploadKey);

      // Make file public and share with admin
      const permissionPromises: Promise<void>[] = [
        this.retryWithBackoff(() => this.makeFilePublic(result.fileId)),
      ];
      if (ADMIN_EMAIL) {
        permissionPromises.push(
          this.retryWithBackoff(() => this.shareFileWithEmail(result.fileId, ADMIN_EMAIL, 'reader'))
        );
      }
      await Promise.all(permissionPromises);

      return result;
    } catch (error: any) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    } finally {
      if (uploadKey) {
        this.activeUploads.delete(uploadKey);
      }
    }
  }

  /**
   * Abort an in-flight upload by its key
   */
  abortUpload(uploadKey: string): void {
    const xhr = this.activeUploads.get(uploadKey);
    if (xhr) {
      xhr.abort();
      this.activeUploads.delete(uploadKey);
      console.log(`Aborted upload: ${uploadKey}`);
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000;
          console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms:`, error.message);
          await sleep(delayMs);
        }
      }
    }
    throw lastError;
  }

  /**
   * Multipart upload for small files (<= 5MB)
   */
  private async multipartUpload(
    file: File,
    folderId: string,
    onProgress: (progress: UploadProgress) => void,
    uploadKey?: string
  ): Promise<UploadResult> {
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [folderId],
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (uploadKey) {
        this.activeUploads.set(uploadKey, xhr);
      }

      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size');
      xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          console.log(`Uploaded: ${response.name}`);
          resolve({
            fileId: response.id,
            fileName: response.name,
            webViewLink: response.webViewLink,
            webContentLink: response.webContentLink || '',
            size: parseInt(response.size, 10),
          });
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onabort = () => reject(new Error('Upload cancelled'));
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  }

  /**
   * Chunked resumable upload for large files (> 5MB)
   */
  private async chunkedResumableUpload(
    file: File,
    folderId: string,
    onProgress: (progress: UploadProgress) => void,
    uploadKey?: string
  ): Promise<UploadResult> {
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [folderId],
    };

    // Step 1: Initiate resumable upload session
    const resumableUri = await this.retryWithBackoff(async () => {
      const initResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink,size',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': file.type || 'application/octet-stream',
            'X-Upload-Content-Length': String(file.size),
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(`Failed to initiate resumable upload: ${initResponse.status} ${errorText}`);
      }

      const uri = initResponse.headers.get('Location');
      if (!uri) {
        throw new Error('No resumable session URI returned from Google Drive');
      }
      return uri;
    });

    console.log(`Starting chunked upload: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);

    // Step 2: Upload file in chunks
    let offset = 0;

    while (offset < file.size) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE, file.size);
      const chunk = file.slice(offset, chunkEnd);
      const isLastChunk = chunkEnd === file.size;

      const result = await this.retryWithBackoff(async () => {
        return await this.uploadChunk(
          resumableUri,
          chunk,
          offset,
          chunkEnd - 1,
          file.size,
          file.type || 'application/octet-stream',
          uploadKey
        );
      });

      onProgress({
        loaded: chunkEnd,
        total: file.size,
        percentage: Math.round((chunkEnd / file.size) * 100),
      });

      if (isLastChunk && result) {
        console.log(`Uploaded (chunked): ${result.fileName}`);
        return result;
      }

      offset = chunkEnd;
    }

    throw new Error('Upload completed but no result received');
  }

  /**
   * Upload a single chunk
   */
  private uploadChunk(
    resumableUri: string,
    chunk: Blob,
    startByte: number,
    endByte: number,
    totalSize: number,
    contentType: string,
    uploadKey?: string
  ): Promise<UploadResult | null> {
    return new Promise<UploadResult | null>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (uploadKey) {
        this.activeUploads.set(uploadKey, xhr);
      }

      xhr.open('PUT', resumableUri);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('Content-Range', `bytes ${startByte}-${endByte}/${totalSize}`);

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              fileId: response.id,
              fileName: response.name,
              webViewLink: response.webViewLink,
              webContentLink: response.webContentLink || '',
              size: parseInt(response.size, 10),
            });
          } catch {
            reject(new Error('Failed to parse upload response'));
          }
        } else if (xhr.status === 308) {
          resolve(null);
        } else {
          reject(new Error(`Chunk upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onabort = () => reject(new Error('Upload cancelled'));
      xhr.onerror = () => reject(new Error('Network error during chunk upload'));
      xhr.send(chunk);
    });
  }

  /**
   * Make file publicly viewable
   */
  async makeFilePublic(fileId: string): Promise<void> {
    await this.ensureSignedIn();

    try {
      await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: {
          type: 'anyone',
          role: 'reader',
        },
      });
      console.log(`Made file ${fileId} publicly viewable`);
    } catch (error: any) {
      console.warn(`Failed to make file public, but upload succeeded`);
    }
  }

  /**
   * Share file with specific email address
   */
  async shareFileWithEmail(fileId: string, emailAddress: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    await this.ensureSignedIn();

    try {
      await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: {
          type: 'user',
          role: role,
          emailAddress: emailAddress,
        },
        sendNotificationEmail: false,
      });
      console.log(`Shared file ${fileId} with ${emailAddress}`);
    } catch (error: any) {
      console.warn(`Failed to share file with ${emailAddress}, but upload succeeded`);
    }
  }

  /**
   * Share folder with specific email address
   */
  async shareFolderWithEmail(folderId: string, emailAddress: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    await this.ensureSignedIn();

    try {
      await gapi.client.drive.permissions.create({
        fileId: folderId,
        resource: {
          type: 'user',
          role: role,
          emailAddress: emailAddress,
        },
        sendNotificationEmail: false,
      });
      console.log(`Shared folder ${folderId} with ${emailAddress}`);
    } catch (error: any) {
      console.warn(`Failed to share folder with ${emailAddress}`);
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.ensureSignedIn();

    try {
      await gapi.client.drive.files.delete({
        fileId: fileId,
      });
      console.log(`Deleted file: ${fileId}`);
    } catch (error: any) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete file: ${error.result?.error?.message || error.message}`);
    }
  }

  /**
   * Ensure user is signed in
   */
  private async ensureSignedIn(): Promise<void> {
    const signedIn = await this.isUserSignedIn();
    if (!signedIn) {
      await this.signIn();
    }
  }

  /**
   * Download a file from Google Drive as a Blob
   */
  async downloadFileAsBlob(fileIdOrUrl: string): Promise<Blob> {
    await this.ensureSignedIn();
    const fileId = extractDriveFileId(fileIdOrUrl);
    return this.retryWithBackoff(async () => {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to download file ${fileId}: ${response.statusText}`);
      }
      return response.blob();
    });
  }
}

// Export singleton instance
export const googleDriveOAuthService = new GoogleDriveOAuthService();
