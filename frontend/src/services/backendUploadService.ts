/**
 * Backend Upload Service
 * Handles file uploads to Google Drive via backend API (no OAuth needed!)
 */

import { supabase } from '@/lib/supabase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  success: boolean;
  fileId: string;
  fileName: string;
  webViewLink: string;
  webContentLink: string;
  size: number;
}

export type FileType = 'raw-footage' | 'edited-video' | 'final-video';

class BackendUploadService {
  /**
   * Upload file to Google Drive via backend
   * @param file - File to upload
   * @param fileType - Type of file (raw-footage, edited-video, final-video)
   * @param projectId - Project content ID (e.g., "BCH-1001")
   * @param analysisId - Analysis ID from database
   * @param onProgress - Progress callback
   * @returns Upload result
   */
  async uploadFile(
    file: File,
    fileType: FileType,
    projectId?: string,
    analysisId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) formData.append('projectId', projectId);
      if (analysisId) formData.append('analysisId', analysisId);

      // Upload with progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress({
              loaded: e.loaded,
              total: e.total,
              percentage: Math.round((e.loaded / e.total) * 100),
            });
          }
        });

        // Success
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (error) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        // Error
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        // Timeout
        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timeout'));
        });

        // Open connection
        xhr.open('POST', `${BACKEND_URL}/api/upload/${fileType}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.timeout = 600000; // 10 minutes timeout for large files
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Upload raw footage (for videographers)
   */
  async uploadRawFootage(
    file: File,
    projectId: string,
    analysisId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'raw-footage', projectId, analysisId, onProgress);
  }

  /**
   * Upload edited video (for editors)
   */
  async uploadEditedVideo(
    file: File,
    projectId: string,
    analysisId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'edited-video', projectId, analysisId, onProgress);
  }

  /**
   * Upload final video
   */
  async uploadFinalVideo(
    file: File,
    projectId: string,
    analysisId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'final-video', projectId, analysisId, onProgress);
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BACKEND_URL}/api/upload/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to delete file';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || `Delete failed with status ${response.status}`;
        }
      } catch {
        errorMessage = `Delete failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BACKEND_URL}/api/upload/${fileId}/metadata`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to get file metadata';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || `Request failed with status ${response.status}`;
        }
      } catch {
        errorMessage = `Request failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }

    const result = await response.json();
    return result.metadata;
  }
}

// Export singleton instance
export const backendUploadService = new BackendUploadService();

// Export types
export type { UploadProgress, UploadResult };
