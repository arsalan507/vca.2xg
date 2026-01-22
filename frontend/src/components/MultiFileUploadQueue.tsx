/**
 * Multi-File Upload Queue Component
 * Allows videographers to select multiple files and assign tags to each before batch upload
 */

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, X, Film, Video, Music, FileVideo } from 'lucide-react';
import { googleDriveOAuthService } from '@/services/googleDriveOAuthService';

// File type options for videographers (raw footage)
export const VIDEOGRAPHER_FILE_TYPES = [
  { value: 'A_ROLL', label: 'A-Roll (Main Footage)', icon: Film },
  { value: 'B_ROLL', label: 'B-Roll (Supplementary)', icon: Video },
  { value: 'HOOK', label: 'Hook', icon: FileVideo },
  { value: 'BODY', label: 'Body', icon: FileVideo },
  { value: 'CTA', label: 'CTA (Call to Action)', icon: FileVideo },
  { value: 'AUDIO_CLIP', label: 'Audio Clip', icon: Music },
  { value: 'OTHER', label: 'Other', icon: FileVideo },
] as const;

// File type options for editors (edited videos)
export const EDITOR_FILE_TYPES = [
  { value: 'EDITED_VIDEO', label: 'Edited Video', icon: Film },
  { value: 'FINAL_VIDEO', label: 'Final Video', icon: Video },
  { value: 'OTHER', label: 'Other', icon: FileVideo },
] as const;

// Combined for type
export const FILE_TYPE_OPTIONS = [...VIDEOGRAPHER_FILE_TYPES, ...EDITOR_FILE_TYPES] as const;

export type FileTypeValue = string;

interface QueuedFile {
  id: string;
  file: File;
  fileType: FileTypeValue;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  uploadResult?: {
    fileUrl: string;
    fileName: string;
    fileId: string;
  };
}

interface FileTypeOption {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MultiFileUploadQueueProps {
  projectId: string;
  onUploadComplete: (files: Array<{
    fileUrl: string;
    fileName: string;
    fileId: string;
    fileType: FileTypeValue;
  }>) => void;
  onSingleFileComplete?: (file: {
    fileUrl: string;
    fileName: string;
    fileId: string;
    fileType: FileTypeValue;
  }) => void;
  acceptedFileTypes?: string;
  maxSizeMB?: number;
  /** File type options to show in dropdown (defaults to VIDEOGRAPHER_FILE_TYPES) */
  fileTypeOptions?: FileTypeOption[];
  /** Default file type when adding new files */
  defaultFileType?: string;
  /** Google Drive folder type: 'raw-footage' | 'edited-video' | 'final-video' */
  driveFolder?: 'raw-footage' | 'edited-video' | 'final-video';
}

export default function MultiFileUploadQueue({
  projectId,
  onUploadComplete,
  onSingleFileComplete,
  acceptedFileTypes = 'video/*,audio/*',
  maxSizeMB = 500,
  fileTypeOptions = VIDEOGRAPHER_FILE_TYPES as unknown as FileTypeOption[],
  defaultFileType = 'A_ROLL',
  driveFolder = 'raw-footage',
}: MultiFileUploadQueueProps) {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check sign-in status on mount
  useEffect(() => {
    const checkSignInStatus = async () => {
      try {
        const signedIn = await googleDriveOAuthService.isUserSignedIn();
        setIsSignedIn(signedIn);
      } catch (err) {
        console.error('Error checking sign-in status:', err);
      }
    };
    checkSignInStatus();
  }, []);

  // Sign in to Google Drive
  const handleSignIn = async () => {
    try {
      setError(null);
      await googleDriveOAuthService.signIn();
      setIsSignedIn(true);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in to Google Drive');
    }
  };

  // Handle multiple file selection
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);

    const newQueuedFiles: QueuedFile[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        errors.push(`${file.name}: exceeds ${maxSizeMB}MB limit`);
        return;
      }

      newQueuedFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        fileType: defaultFileType as FileTypeValue,
        status: 'pending',
        progress: 0,
      });
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    setQueuedFiles((prev) => [...prev, ...newQueuedFiles]);

    // Reset input to allow selecting same files again
    e.target.value = '';
  };

  // Update file type for a queued file
  const updateFileType = (fileId: string, newType: FileTypeValue) => {
    setQueuedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, fileType: newType } : f))
    );
  };

  // Remove a file from queue
  const removeFile = (fileId: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Upload all files
  const handleUploadAll = async () => {
    const pendingFiles = queuedFiles.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    const completedFiles: Array<{
      fileUrl: string;
      fileName: string;
      fileId: string;
      fileType: FileTypeValue;
    }> = [];

    for (const queuedFile of pendingFiles) {
      try {
        // Update status to uploading
        setQueuedFiles((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id ? { ...f, status: 'uploading', progress: 0 } : f
          )
        );

        // Get or create folder for this file type
        const targetFolderId = await googleDriveOAuthService.getOrCreateFolderForFileType(
          projectId,
          driveFolder
        );

        // Upload file with progress tracking
        const result = await googleDriveOAuthService.uploadFile(
          queuedFile.file,
          targetFolderId,
          (progressData) => {
            setQueuedFiles((prev) =>
              prev.map((f) =>
                f.id === queuedFile.id ? { ...f, progress: progressData.percentage } : f
              )
            );
          }
        );

        // Update status to success
        setQueuedFiles((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id
              ? {
                  ...f,
                  status: 'success',
                  progress: 100,
                  uploadResult: {
                    fileUrl: result.webViewLink,
                    fileName: result.fileName,
                    fileId: result.fileId,
                  },
                }
              : f
          )
        );

        const completedFile = {
          fileUrl: result.webViewLink,
          fileName: result.fileName,
          fileId: result.fileId,
          fileType: queuedFile.fileType,
        };

        completedFiles.push(completedFile);

        // Call single file complete callback if provided
        if (onSingleFileComplete) {
          onSingleFileComplete(completedFile);
        }
      } catch (err: any) {
        console.error('Upload error for file:', queuedFile.file.name, err);
        setQueuedFiles((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id
              ? { ...f, status: 'error', error: err.message || 'Upload failed' }
              : f
          )
        );
      }
    }

    setIsUploading(false);

    // Call batch complete callback
    if (completedFiles.length > 0) {
      onUploadComplete(completedFiles);
    }
  };

  // Clear completed/errored files
  const clearCompleted = () => {
    setQueuedFiles((prev) => prev.filter((f) => f.status === 'pending' || f.status === 'uploading'));
  };

  // Get counts
  const pendingCount = queuedFiles.filter((f) => f.status === 'pending').length;
  const uploadingCount = queuedFiles.filter((f) => f.status === 'uploading').length;
  const successCount = queuedFiles.filter((f) => f.status === 'success').length;
  const errorCount = queuedFiles.filter((f) => f.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Sign-in prompt if not signed in */}
      {!isSignedIn && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 mb-3">
            Sign in to Google to upload files to your Drive
          </p>
          <button
            onClick={handleSignIn}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Sign in with Google
          </button>
        </div>
      )}

      {isSignedIn && (
        <>
          {/* File input - multiple files */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFilesChange}
              disabled={isUploading}
              multiple
              className="hidden"
              id="multi-file-upload"
            />
            <label
              htmlFor="multi-file-upload"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <Upload className="w-10 h-10 text-gray-400" />
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-blue-600">Click to select files</span> or drag and drop
              </div>
              <div className="text-xs text-gray-500">
                Select multiple video/audio files (up to {maxSizeMB}MB each)
              </div>
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm whitespace-pre-line">{error}</span>
            </div>
          )}

          {/* Queued files list */}
          {queuedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">
                  Upload Queue ({queuedFiles.length} file{queuedFiles.length !== 1 ? 's' : ''})
                </h4>
                {(successCount > 0 || errorCount > 0) && (
                  <button
                    onClick={clearCompleted}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear completed
                  </button>
                )}
              </div>

              {/* File list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {queuedFiles.map((qf) => {
                  const TypeIcon = fileTypeOptions.find((o) => o.value === qf.fileType)?.icon || FileVideo;

                  return (
                    <div
                      key={qf.id}
                      className={`border rounded-lg p-3 ${
                        qf.status === 'success'
                          ? 'border-green-200 bg-green-50'
                          : qf.status === 'error'
                          ? 'border-red-200 bg-red-50'
                          : qf.status === 'uploading'
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status icon */}
                        <div className="flex-shrink-0 mt-1">
                          {qf.status === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : qf.status === 'error' ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : qf.status === 'uploading' ? (
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          ) : (
                            <TypeIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {qf.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(qf.file.size / (1024 * 1024)).toFixed(1)} MB
                          </p>

                          {/* Progress bar for uploading */}
                          {qf.status === 'uploading' && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 transition-all duration-300"
                                  style={{ width: `${qf.progress}%` }}
                                />
                              </div>
                              <p className="text-xs text-blue-600 mt-1">{qf.progress}%</p>
                            </div>
                          )}

                          {/* Error message */}
                          {qf.status === 'error' && qf.error && (
                            <p className="text-xs text-red-600 mt-1">{qf.error}</p>
                          )}
                        </div>

                        {/* File type selector (only for pending) */}
                        {qf.status === 'pending' && (
                          <select
                            value={qf.fileType}
                            onChange={(e) => updateFileType(qf.id, e.target.value as FileTypeValue)}
                            className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            {fileTypeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Remove button (only for pending) */}
                        {qf.status === 'pending' && (
                          <button
                            onClick={() => removeFile(qf.id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status summary */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {pendingCount > 0 && <span>{pendingCount} pending</span>}
                {uploadingCount > 0 && <span className="text-blue-600">{uploadingCount} uploading</span>}
                {successCount > 0 && <span className="text-green-600">{successCount} completed</span>}
                {errorCount > 0 && <span className="text-red-600">{errorCount} failed</span>}
              </div>

              {/* Upload button */}
              {pendingCount > 0 && !isUploading && (
                <button
                  onClick={handleUploadAll}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''} to Google Drive
                </button>
              )}

              {/* Uploading indicator */}
              {isUploading && (
                <div className="flex items-center justify-center gap-2 text-blue-600 py-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Uploading files... Please wait</span>
                </div>
              )}
            </div>
          )}

          {/* Folder info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p>
              <strong>📁 Upload location:</strong> Your Google Drive → Production Files → {projectId} → {
                driveFolder === 'raw-footage' ? 'Raw Footage' :
                driveFolder === 'edited-video' ? 'Edited Videos' :
                driveFolder === 'final-video' ? 'Final Videos' : 'Raw Footage'
              }
            </p>
          </div>
        </>
      )}
    </div>
  );
}
