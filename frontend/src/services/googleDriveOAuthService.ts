/**
 * Google Drive OAuth Upload Service (Using Google Identity Services - GIS)
 * Uploads files to videographer's personal Google Drive using OAuth
 */

// Google API configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
// Use drive scope to allow file creation, access, and sharing
// Note: drive.file scope doesn't support sharing, so we need broader drive scope
const SCOPES = 'https://www.googleapis.com/auth/drive';
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_GOOGLE_EMAIL || ''; // Admin email for auto-sharing

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

class GoogleDriveOAuthService {
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private gapiInited = false;
  private gisInited = false;

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
   * Upload file to Google Drive with progress tracking
   */
  async uploadFile(
    file: File,
    folderId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    await this.ensureSignedIn();

    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [folderId],
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    try {
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size');

        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
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

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });

      // Auto-share file with admin if email is configured
      if (ADMIN_EMAIL) {
        await this.shareFileWithEmail(result.fileId, ADMIN_EMAIL, 'reader');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Share file with specific email address
   */
  async shareFileWithEmail(fileId: string, emailAddress: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    await this.ensureSignedIn();

    try {
      const response = await gapi.client.drive.permissions.create({
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
      const response = await gapi.client.drive.permissions.create({
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
}

// Export singleton instance
export const googleDriveOAuthService = new GoogleDriveOAuthService();
