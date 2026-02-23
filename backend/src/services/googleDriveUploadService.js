/**
 * Google Drive Upload Service using Service Account
 * Uploads files to centralized company Google Drive without OAuth popups
 */

const { google } = require('googleapis');
const stream = require('stream');

class GoogleDriveUploadService {
  constructor() {
    this.auth = null;
    this.drive = null;
  }

  /**
   * Initialize Google Drive API with service account
   */
  async initialize() {
    if (this.drive) return; // Already initialized

    try {
      // Parse service account credentials from environment variable
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);

      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive.file', // Create/manage files created by this app
          'https://www.googleapis.com/auth/drive.readonly', // Read all files the service account has access to
        ],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      console.log('✅ Google Drive Service Account initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive Service Account:', error.message);
      throw new Error('Google Drive service account not configured');
    }
  }

  /**
   * Upload file to Google Drive
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} fileName - Original file name
   * @param {string} mimeType - File MIME type
   * @param {string} folderId - Target folder ID
   * @param {object} metadata - Additional metadata (optional)
   * @returns {Promise<{fileId: string, webViewLink: string, webContentLink: string}>}
   */
  async uploadFile(fileBuffer, fileName, mimeType, folderId, metadata = {}) {
    await this.initialize();

    try {
      // Create readable stream from buffer
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileBuffer);

      // Prepare file metadata
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
        ...metadata, // Allow custom metadata
      };

      console.log(`📤 Uploading ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) to folder ${folderId}`);

      // Upload file to Google Drive
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: mimeType,
          body: bufferStream,
        },
        fields: 'id, name, webViewLink, webContentLink, size',
        supportsAllDrives: true, // Support Shared Drives to avoid service account quota issues
      });

      console.log(`✅ Uploaded: ${response.data.name} (ID: ${response.data.id})`);

      // Make file publicly accessible (anyone with link can view)
      await this.makeFilePublic(response.data.id);

      return {
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        size: response.data.size,
      };
    } catch (error) {
      console.error('❌ Upload error:', error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Make file publicly accessible (anyone with link)
   * @param {string} fileId - File ID
   */
  async makeFilePublic(fileId) {
    try {
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true, // Support Shared Drives
      });
      console.log(`🔓 Made file ${fileId} publicly accessible`);
    } catch (error) {
      console.error('⚠️  Warning: Could not make file public:', error.message);
      // Don't throw - file is uploaded, just not public
    }
  }

  /**
   * Create folder in Google Drive
   * @param {string} folderName - Folder name
   * @param {string} parentFolderId - Parent folder ID
   * @returns {Promise<string>} - New folder ID
   */
  async createFolder(folderName, parentFolderId) {
    await this.initialize();

    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id, name',
        supportsAllDrives: true, // Support Shared Drives
      });

      console.log(`📁 Created folder: ${response.data.name} (ID: ${response.data.id})`);
      return response.data.id;
    } catch (error) {
      console.error('❌ Folder creation error:', error.message);
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  /**
   * Check if folder exists
   * @param {string} folderName - Folder name to search
   * @param {string} parentFolderId - Parent folder to search in
   * @returns {Promise<string|null>} - Folder ID if exists, null otherwise
   */
  async findFolder(folderName, parentFolderId) {
    await this.initialize();

    try {
      if (!folderName || !parentFolderId) return null;
      const safeFolderName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const safeParentId = parentFolderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const response = await this.drive.files.list({
        q: `name='${safeFolderName}' and '${safeParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true, // Support Shared Drives
        includeItemsFromAllDrives: true, // Include files from all drives
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      return null;
    } catch (error) {
      console.error('❌ Folder search error:', error.message);
      return null;
    }
  }

  /**
   * Get or create project folder
   * Creates organized folder structure: ParentFolder/ProjectID/
   * @param {string} projectId - Project content ID (e.g., "BCH-1001")
   * @param {string} parentFolderId - Parent folder ID
   * @returns {Promise<string>} - Project folder ID
   */
  async getOrCreateProjectFolder(projectId, parentFolderId) {
    await this.initialize();

    try {
      // Check if project folder exists
      let projectFolderId = await this.findFolder(projectId, parentFolderId);

      // Create if doesn't exist
      if (!projectFolderId) {
        projectFolderId = await this.createFolder(projectId, parentFolderId);
      }

      return projectFolderId;
    } catch (error) {
      console.error('❌ Project folder error:', error.message);
      throw new Error(`Failed to get/create project folder: ${error.message}`);
    }
  }

  /**
   * Delete file from Google Drive
   * @param {string} fileId - File ID to delete
   */
  async deleteFile(fileId) {
    await this.initialize();

    try {
      await this.drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true, // Support Shared Drives
      });
      console.log(`🗑️  Deleted file: ${fileId}`);
    } catch (error) {
      console.error('❌ Delete error:', error.message);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Download file from Google Drive as a readable stream
   * @param {string} fileId - File ID
   * @returns {Promise<import('stream').Readable>} - Readable stream
   */
  async downloadFileStream(fileId) {
    await this.initialize();

    const response = await this.drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    return response.data;
  }

  /**
   * Create a resumable upload session and return the resumable URI.
   * The URI is a capability URL — no auth header is needed when uploading chunks to it.
   * @param {string} fileName - File name for the upload
   * @param {string} mimeType - File MIME type
   * @param {number} fileSize - File size in bytes
   * @param {string} folderId - Target Drive folder ID
   * @returns {Promise<string>} - Resumable upload URI
   */
  async createResumableSession(fileName, mimeType, fileSize, folderId) {
    await this.initialize();

    try {
      const authClient = await this.auth.getClient();
      const accessToken = (await authClient.getAccessToken()).token;

      const metadata = {
        name: fileName,
        parents: [folderId],
      };

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType || 'application/octet-stream',
            'X-Upload-Content-Length': String(fileSize),
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create resumable session: ${response.status} ${errorText}`);
      }

      const resumableUri = response.headers.get('Location');
      if (!resumableUri) {
        throw new Error('No resumable session URI returned from Google Drive');
      }

      console.log(`📤 Created resumable session for ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      return resumableUri;
    } catch (error) {
      console.error('❌ Resumable session error:', error.message);
      throw new Error(`Failed to create resumable upload session: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId - File ID
   * @returns {Promise<object>} - File metadata
   */
  async getFileMetadata(fileId) {
    await this.initialize();

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink',
        supportsAllDrives: true, // Support Shared Drives
      });

      return response.data;
    } catch (error) {
      console.error('❌ Get metadata error:', error.message);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new GoogleDriveUploadService();
