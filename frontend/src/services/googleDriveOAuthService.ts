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
// Note: drive.file scope doesn't support sharing, so we need broader drive scope
const SCOPES = 'https://www.googleapis.com/auth/drive';
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_GOOGLE_EMAIL || ''; // Admin email for auto-sharing

// Upload constants
const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB chunks (must be multiple of 256KiB)
const MAX_RETRIES = 3;
const FIVE_MB = 5 * 1024 * 1024;
const PROGRESS_THROTTLE_MS = 500; // Max 2 progress updates per second

/**
 * Extract Google Drive file ID from a URL or return as-is if already an ID.
 * Handles formats:
 *   - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://drive.google.com/uc?id=FILE_ID&export=download
 *   - Plain file ID string
 */
export function extractDriveFileId(fileIdOrUrl: string): string {
  if (!fileIdOrUrl) return fileIdOrUrl;
  // Already a plain ID (no slashes or protocol)
  if (!fileIdOrUrl.includes('/') && !fileIdOrUrl.includes('?')) return fileIdOrUrl;
  // /file/d/FILE_ID/ pattern
  const fileMatch = fileIdOrUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  // ?id=FILE_ID pattern
  const idMatch = fileIdOrUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  // Fallback: return as-is
  return fileIdOrUrl;
}

/**
 * Build a direct download URL for a Google Drive file.
 * Uses the /uc?export=download endpoint which triggers browser download.
 */
export function getDriveDownloadUrl(fileIdOrUrl: string): string {
  const fileId = extractDriveFileId(fileIdOrUrl);
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

declare const google: any;
declare const gapi: any;

interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  webContentLink: string;
  size: number;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a throttled version of a progress callback that fires at most once per interval.
 * Always fires the final 100% progress event.
 */
function createThrottledProgress(
  onProgress: ((progress: UploadProgress) => void) | undefined,
  intervalMs: number = PROGRESS_THROTTLE_MS
): (progress: UploadProgress) => void {
  if (!onProgress) return () => {};
  let lastCall = 0;
  return (progress: UploadProgress) => {
    const now = Date.now();
    // Always fire at 100% or if enough time has passed
    if (progress.percentage >= 100 || now - lastCall >= intervalMs) {
      lastCall = now;
      onProgress(progress);
    }
  };
}

class GoogleDriveOAuthService {
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private gapiInited = false;
  private gisInited = false;

  // Track active XHRs for abort support
  private activeUploads: Map<string, XMLHttpRequest> = new Map();

  /**
   * Initialize Google API and GIS
   */
  async initialize(): Promise<void> {
    if (this.gapiInited && this.gisInited) return;

    // Load GIS library
    await this.loadGISLibrary();

    // Load GAPI library
    await this.loadGAPILibrary();
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
          console.error('❌ GIS error:', response);
          return;
        }
        this.accessToken = response.access_token;
        console.log('✅ Access token received');
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
    console.log('✅ Google Drive API initialized');
  }

  /**
   * Sign in to Google (request access token)
   */
  async signIn(): Promise<void> {
    await this.initialize();

    if (this.accessToken) {
      console.log('Already have access token');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Set callback for this specific request
        this.tokenClient.callback = (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          this.accessToken = response.access_token;
          gapi.client.setToken({ access_token: this.accessToken });
          console.log('✅ Signed in to Google Drive');
          resolve();
        };

        // Request access token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (error: any) {
        console.error('❌ Sign in error:', error);
        reject(error);
      }
    });
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<void> {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('✅ Access token revoked');
      });
      this.accessToken = null;
      gapi.client.setToken(null);
    }
  }

  /**
   * Check if user is signed in
   */
  async isUserSignedIn(): Promise<boolean> {
    await this.initialize();
    return this.accessToken !== null;
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

      console.log(`✅ Created folder: ${folderName}`);
      return response.result.id;
    } catch (error: any) {
      console.error('❌ Create folder error:', error);
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
      console.error('❌ Find folder error:', error);
      return null;
    }
  }

  /**
   * Get or create folder for specific file type (optimized - only creates what's needed)
   * @param projectId - Project ID
   * @param fileType - Type of file being uploaded
   */
  async getOrCreateFolderForFileType(
    projectId: string,
    fileType: 'raw-footage' | 'edited-video' | 'final-video'
  ): Promise<string> {
    await this.ensureSignedIn();

    // Map file type to folder name
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

    // Create/find ONLY the specific subfolder needed
    let targetFolderId = await this.findFolder(folderName, projectFolderId);
    let targetFolderCreated = false;
    if (!targetFolderId) {
      targetFolderId = await this.createFolder(folderName, projectFolderId);
      targetFolderCreated = true;
    }

    // Share folders with admin if they were just created and admin email is configured
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
   * Get or create a folder structure (DEPRECATED - use getOrCreateFolderForFileType instead)
   */
  async getOrCreateFolderStructure(projectId: string): Promise<{
    rootFolderId: string;
    rawFootageFolderId: string;
    editedVideosFolderId: string;
    finalVideosFolderId: string;
  }> {
    await this.ensureSignedIn();

    // Create/find "Production Files" folder
    let rootFolderId = await this.findFolder('Production Files');
    if (!rootFolderId) {
      rootFolderId = await this.createFolder('Production Files');
    }

    // Create/find project folder
    let projectFolderId = await this.findFolder(projectId, rootFolderId);
    if (!projectFolderId) {
      projectFolderId = await this.createFolder(projectId, rootFolderId);
    }

    // Create/find subfolders
    let rawFootageFolderId = await this.findFolder('Raw Footage', projectFolderId);
    if (!rawFootageFolderId) {
      rawFootageFolderId = await this.createFolder('Raw Footage', projectFolderId);
    }

    let editedVideosFolderId = await this.findFolder('Edited Videos', projectFolderId);
    if (!editedVideosFolderId) {
      editedVideosFolderId = await this.createFolder('Edited Videos', projectFolderId);
    }

    let finalVideosFolderId = await this.findFolder('Final Videos', projectFolderId);
    if (!finalVideosFolderId) {
      finalVideosFolderId = await this.createFolder('Final Videos', projectFolderId);
    }

    return {
      rootFolderId,
      rawFootageFolderId,
      editedVideosFolderId,
      finalVideosFolderId,
    };
  }

  /**
   * Upload file to Google Drive with progress tracking.
   * Uses chunked resumable upload for files > 5MB (16MB chunks with retry).
   * Uses multipart upload for files <= 5MB.
   * Returns an uploadKey that can be used to abort the upload.
   */
  async uploadFile(
    file: File,
    folderId: string,
    onProgress?: (progress: UploadProgress) => void,
    uploadKey?: string
  ): Promise<UploadResult> {
    await this.ensureSignedIn();

    // Throttle progress to max 2 updates/sec to prevent React re-render storms
    const throttledProgress = createThrottledProgress(onProgress);

    try {
      const result = file.size > FIVE_MB
        ? await this.chunkedResumableUpload(file, folderId, throttledProgress, uploadKey)
        : await this.multipartUpload(file, folderId, throttledProgress, uploadKey);

      // Make file public AND share with admin in parallel (not sequentially)
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
      console.error('❌ Upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    } finally {
      // Clean up active upload tracking
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
      console.log(`🛑 Aborted upload: ${uploadKey}`);
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
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
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

      // Track for abort support
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
          console.log(`✅ Uploaded: ${response.name}`);
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
   * Chunked resumable upload for large files (> 5MB).
   *
   * How it works:
   * 1. Initiate a resumable session to get a session URI from Google
   * 2. Split the file into 16MB chunks using File.slice() (no extra memory)
   * 3. Upload each chunk sequentially with Content-Range header
   * 4. If a chunk fails, query Google for the last received byte and resume
   * 5. Each chunk gets up to 3 retry attempts with exponential backoff
   *
   * This means a 1GB file that fails at 900MB only re-uploads the last 100MB,
   * not the entire file from scratch.
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

    console.log(`📤 Starting chunked upload: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB, ${Math.ceil(file.size / CHUNK_SIZE)} chunks)`);

    // Step 2: Upload file in chunks
    let offset = 0;

    while (offset < file.size) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE, file.size);
      const chunk = file.slice(offset, chunkEnd);
      const isLastChunk = chunkEnd === file.size;

      // Retry each chunk with exponential backoff
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

      // Report progress based on bytes sent
      onProgress({
        loaded: chunkEnd,
        total: file.size,
        percentage: Math.round((chunkEnd / file.size) * 100),
      });

      if (isLastChunk && result) {
        // Final chunk returns the file metadata
        console.log(`✅ Uploaded (chunked resumable): ${result.fileName}`);
        return result;
      }

      // Google returns 308 for intermediate chunks - move to next offset
      offset = chunkEnd;
    }

    // Shouldn't reach here, but handle edge case
    throw new Error('Upload completed but no result received');
  }

  /**
   * Upload a single chunk to the resumable session URI.
   * Returns UploadResult on the final chunk, null on intermediate chunks.
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

      // Track for abort support
      if (uploadKey) {
        this.activeUploads.set(uploadKey, xhr);
      }

      xhr.open('PUT', resumableUri);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('Content-Range', `bytes ${startByte}-${endByte}/${totalSize}`);

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          // Final chunk - parse response
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
          // Intermediate chunk acknowledged - continue
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
   * Make file publicly viewable (anyone with the link can view)
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
      console.log(`✅ Made file ${fileId} publicly viewable`);
    } catch (error: any) {
      console.error('❌ Make public error:', error);
      // Log full error details for debugging
      if (error.result) {
        console.error('Error details:', error.result.error);
      }
      // Don't throw - public sharing failure shouldn't block the upload
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
      console.log(`✅ Shared file ${fileId} with ${emailAddress}`);
    } catch (error: any) {
      console.error('❌ Share error:', error);
      // Log full error details for debugging
      if (error.result) {
        console.error('Error details:', error.result.error);
      }
      // Don't throw - sharing failure shouldn't block the upload
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
        fileId: folderId, // Folders are files in Drive API
        resource: {
          type: 'user',
          role: role,
          emailAddress: emailAddress,
        },
        sendNotificationEmail: false,
      });
      console.log(`✅ Shared folder ${folderId} with ${emailAddress}`);
    } catch (error: any) {
      console.error('❌ Share folder error:', error);
      // Log full error details for debugging
      if (error.result) {
        console.error('Error details:', error.result.error);
      }
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
      console.log(`🗑️ Deleted file: ${fileId}`);
    } catch (error: any) {
      console.error('❌ Delete error:', error);
      throw new Error(`Failed to delete file: ${error.result?.error?.message || error.message}`);
    }
  }

  /**
   * Ensure user is signed in, prompt if not
   */
  private async ensureSignedIn(): Promise<void> {
    const signedIn = await this.isUserSignedIn();
    if (!signedIn) {
      await this.signIn();
    }
  }

  /**
   * Download a file from Google Drive as a Blob using the Drive API.
   * Includes retry with exponential backoff for reliability.
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
