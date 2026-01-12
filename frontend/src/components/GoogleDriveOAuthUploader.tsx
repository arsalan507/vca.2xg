/**
 * Google Drive OAuth File Uploader
 * Uploads files to videographer's personal Google Drive
 */

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { googleDriveOAuthService } from '@/services/googleDriveOAuthService';

interface GoogleDriveOAuthUploaderProps {
  projectId: string;
  fileType: 'raw-footage' | 'edited-video' | 'final-video';
  onUploadComplete: (fileUrl: string, fileName: string, fileId: string) => void;
  acceptedFileTypes?: string;
  maxSizeMB?: number;
}

export default function GoogleDriveOAuthUploader({
  projectId,
  fileType,
  onUploadComplete,
  acceptedFileTypes = 'video/*',
  maxSizeMB = 500,
}: GoogleDriveOAuthUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Check sign-in status on mount
  const checkSignInStatus = async () => {
    try {
      const signedIn = await googleDriveOAuthService.isUserSignedIn();
      setIsSignedIn(signedIn);
    } catch (err) {
      console.error('Error checking sign-in status:', err);
    }
  };

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

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(false);

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    setSelectedFile(file);
  };

  // Upload handler
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Ensure user is signed in
      if (!isSignedIn) {
        await handleSignIn();
      }

      // Get or create ONLY the folder needed for this file type
      const targetFolderId = await googleDriveOAuthService.getOrCreateFolderForFileType(
        projectId,
        fileType
      );

      console.log(`📤 Uploading to Google Drive folder: ${targetFolderId}`);

      // Upload file with progress tracking
      const result = await googleDriveOAuthService.uploadFile(
        selectedFile,
        targetFolderId,
        (progressData) => {
          setProgress(progressData.percentage);
        }
      );

      setSuccess(true);
      setProgress(100);
      onUploadComplete(result.webViewLink, result.fileName, result.fileId);

      // Reset after 2 seconds
      setTimeout(() => {
        setSelectedFile(null);
        setSuccess(false);
        setProgress(0);
      }, 2000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  // Initialize on component mount
  useEffect(() => {
    checkSignInStatus();
  }, []);

  return (
    <div className="space-y-4">
      {/* Sign-in button if not signed in */}
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

      {/* File upload section */}
      {isSignedIn && (
        <>
          {/* File input */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
              id="file-upload-oauth"
            />
            <label
              htmlFor="file-upload-oauth"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <Upload className="w-10 h-10 text-gray-400" />
              <div className="text-sm text-gray-600">
                {selectedFile ? (
                  <span className="font-medium text-blue-600">{selectedFile.name}</span>
                ) : (
                  <>
                    <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Video files up to {maxSizeMB}MB
              </div>
            </label>
          </div>

          {/* Upload button */}
          {selectedFile && !isUploading && !success && (
            <button
              onClick={handleUpload}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Upload to Google Drive
            </button>
          )}

          {/* Progress bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Uploading to your Google Drive...</span>
                <span className="font-medium text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-center text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Please wait...
              </div>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="flex items-center space-x-2 text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">File uploaded successfully!</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Folder info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p>
              <strong>📁 Upload location:</strong> Your Google Drive → Production Files → {projectId} →{' '}
              {fileType === 'raw-footage' && 'Raw Footage'}
              {fileType === 'edited-video' && 'Edited Videos'}
              {fileType === 'final-video' && 'Final Videos'}
            </p>
            <p className="mt-1 text-blue-600">
              ℹ️ Only the needed folder will be created (not all subfolders)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
