/**
 * Drive Upload Service (Service Account + Resumable Upload URI)
 *
 * No Google sign-in required for users. Flow:
 * 1. Frontend calls backend to get a resumable upload URI (backend uses service account)
 * 2. Frontend uploads file chunks directly to Google Drive via that URI
 * 3. Frontend calls backend to finalize (set permissions, save DB record)
 *
 * Features:
 * - Chunked resumable upload (16MB chunks) with auto-retry
 * - Exponential backoff retry (3 attempts per chunk)
 * - Throttled progress callbacks (max 2/sec to prevent React re-render storms)
 * - Abort support for cancelling in-flight uploads
 */

import { fetchWithAuth } from '@/lib/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB chunks (must be multiple of 256KiB)
const MAX_RETRIES = 3;
const PROGRESS_THROTTLE_MS = 500; // Max 2 progress updates per second

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  size: number;
}

export interface InitUploadParams {
  contentId: string;
  analysisId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileType: 'raw-footage' | 'edited-video' | 'final-video';
  /** For batch uploads: 0-based index within the current batch (used for auto-numbering) */
  fileIndex?: number;
}

export interface FinalizeParams {
  analysisId: string;
  fileType: string;
  fileName: string;
  fileId: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

class DriveUploadService {
  private activeUploads: Map<string, XMLHttpRequest> = new Map();

  /**
   * Step 1: Ask backend for a resumable upload URI
   */
  async initUpload(params: InitUploadParams): Promise<{ resumableUri: string; fileName: string }> {
    const response = await fetchWithAuth(`${BACKEND_URL}/api/upload/init-resumable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Failed to initialize upload');
    }

    const data = await response.json();
    return { resumableUri: data.resumableUri, fileName: data.fileName };
  }

  /**
   * Step 2: Upload file directly to Google Drive via the resumable URI
   * No auth header needed — the URI itself is the auth.
   */
  async uploadFile(
    file: File,
    resumableUri: string,
    onProgress?: (progress: UploadProgress) => void,
    uploadKey?: string,
    fileName?: string
  ): Promise<UploadResult> {
    const throttledProgress = createThrottledProgress(onProgress);
    const uploadFile = fileName ? new File([file], fileName, { type: file.type }) : file;

    try {
      return await this.chunkedResumableUpload(uploadFile, resumableUri, throttledProgress, uploadKey);
    } catch (error: any) {
      throw new Error(`Failed to upload file: ${error.message}`);
    } finally {
      if (uploadKey) {
        this.activeUploads.delete(uploadKey);
      }
    }
  }

  /**
   * Step 3: Tell backend to finalize — make file public + save DB record
   */
  async finalizeUpload(params: FinalizeParams): Promise<any> {
    const response = await fetchWithAuth(`${BACKEND_URL}/api/upload/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Failed to finalize upload');
    }

    return response.json();
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
   * Chunked resumable upload
   */
  private async chunkedResumableUpload(
    file: File,
    resumableUri: string,
    onProgress: (progress: UploadProgress) => void,
    uploadKey?: string
  ): Promise<UploadResult> {
    console.log(`Starting chunked upload: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);

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
        console.log(`Uploaded: ${result.fileName}`);
        return result;
      }

      offset = chunkEnd;
    }

    throw new Error('Upload completed but no result received');
  }

  /**
   * Upload a single chunk — no Authorization header needed
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
              webViewLink: response.webViewLink || `https://drive.google.com/file/d/${response.id}/view`,
              size: parseInt(response.size, 10),
            });
          } catch {
            reject(new Error('Failed to parse upload response'));
          }
        } else if (xhr.status === 308) {
          // Chunk accepted, more to send
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
}

export const driveUploadService = new DriveUploadService();
