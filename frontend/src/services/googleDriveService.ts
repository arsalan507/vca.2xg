/**
 * Google Drive Upload Service
 * Handles direct file uploads to Google Drive
 */

interface GoogleDriveConfig {
  apiKey: string;
  clientId: string;
  folderId?: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink: string;
  name: string;
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenClient: any = null;
  private gapiInitialized = false;

  /**
   * Initialize Google API and Auth
   */
  async initialize(config: GoogleDriveConfig): Promise<void> {
    if (this.gapiInitialized) return;

    // Load Google API scripts
    await this.loadScript('https://apis.google.com/js/api.js');
    await this.loadScript('https://accounts.google.com/gsi/client');

    return new Promise((resolve, reject) => {
      (window as any).gapi.load('client', async () => {
        try {
          await (window as any).gapi.client.init({
            apiKey: config.apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });

          // Initialize OAuth token client
          this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: config.clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: '', // Will be set per request
            redirect_uri: window.location.origin,
            ux_mode: 'popup', // Use popup mode instead of redirect
          });

          this.gapiInitialized = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Load external script dynamically
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Request OAuth token from user
   */
  async requestAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('Google API not initialized'));
        return;
      }

      this.tokenClient.callback = (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        this.accessToken = response.access_token;
        resolve(response.access_token);
      };

      this.tokenClient.requestAccessToken();
    });
  }

  /**
   * Upload file to Google Drive with progress tracking
   */
  async uploadFile(
    file: File,
    folderId: string | undefined,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    if (!this.accessToken) {
      await this.requestAccessToken();
    }

    // Create metadata
    const metadata = {
      name: file.name,
      mimeType: file.type,
      ...(folderId && { parents: [folderId] }),
    };

    // Create multipart form data
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    // Upload with XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded / e.total) * 100),
          });
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);

          // Get shareable link
          const shareableLink = await this.makeFilePublic(response.id);

          resolve({
            fileId: response.id,
            webViewLink: shareableLink,
            webContentLink: `https://drive.google.com/uc?id=${response.id}&export=download`,
            name: response.name,
          });
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
      xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      xhr.send(form);
    });
  }

  /**
   * Make file publicly accessible and get shareable link
   */
  private async makeFilePublic(fileId: string): Promise<string> {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });

      return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    } catch (error) {
      console.error('Error making file public:', error);
      return `https://drive.google.com/file/d/${fileId}/view`;
    }
  }

  /**
   * Extract folder ID from Google Drive URL
   */
  extractFolderId(driveUrl: string): string | null {
    const patterns = [
      /folders\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /\/d\/([a-zA-Z0-9-_]+)/,
    ];

    for (const pattern of patterns) {
      const match = driveUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.accessToken = null;
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();

// Export types
export type { GoogleDriveConfig, UploadProgress, UploadResult };
