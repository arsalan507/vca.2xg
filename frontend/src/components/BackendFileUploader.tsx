import { useState, useRef } from 'react';
import { CloudArrowUpIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { backendUploadService, type UploadProgress, type FileType } from '@/services/backendUploadService';
import toast from 'react-hot-toast';

interface BackendFileUploaderProps {
  onUploadComplete: (fileUrl: string, fileName: string, fileId: string) => void;
  acceptedFileTypes?: string;
  maxSizeMB?: number;
  fileType: FileType; // 'raw-footage', 'edited-video', or 'final-video'
  projectId?: string; // Content ID like "BCH-1001"
  analysisId?: string; // Database ID
  disabled?: boolean;
}

export default function BackendFileUploader({
  onUploadComplete,
  acceptedFileTypes = 'video/*',
  maxSizeMB = 500,
  fileType,
  projectId,
  analysisId,
  disabled = false,
}: BackendFileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setSelectedFile(file);
    setUploadStatus('idle');
    setProgress({ loaded: 0, total: 0, percentage: 0 });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setUploadStatus('uploading');

      // Upload via backend (no OAuth needed!)
      const result = await backendUploadService.uploadFile(
        selectedFile,
        fileType,
        projectId,
        analysisId,
        (progressData) => {
          setProgress(progressData);
        }
      );

      setUploadStatus('success');
      toast.success(`File uploaded successfully: ${result.fileName}`);

      // Call the callback with the shareable link
      onUploadComplete(result.webViewLink, result.fileName, result.fileId);

      // Reset state
      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus('idle');
        setProgress({ loaded: 0, total: 0, percentage: 0 });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setProgress({ loaded: 0, total: 0, percentage: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getUploadTypeLabel = () => {
    switch (fileType) {
      case 'raw-footage':
        return 'Raw Footage';
      case 'edited-video':
        return 'Edited Video';
      case 'final-video':
        return 'Final Video';
      default:
        return 'File';
    }
  };

  return (
    <div className="w-full">
      {/* File Selection */}
      {!selectedFile && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition">
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes}
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            className="hidden"
            id="backend-file-upload"
          />
          <label
            htmlFor="backend-file-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mb-4" />
            <span className="text-sm font-medium text-gray-700 mb-1">
              Click to select {getUploadTypeLabel().toLowerCase()}
            </span>
            <span className="text-xs text-gray-500">
              {acceptedFileTypes === 'video/*' ? 'Video files' : 'Supported files'} up to {maxSizeMB}MB
            </span>
            {projectId && (
              <span className="text-xs text-primary-600 font-mono mt-2">
                Project: {projectId}
              </span>
            )}
          </label>
        </div>
      )}

      {/* File Selected - Ready to Upload */}
      {selectedFile && uploadStatus === 'idle' && (
        <div className="border border-gray-300 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                {selectedFile.name}
              </h4>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
              {projectId && (
                <p className="text-xs text-primary-600 font-mono mt-1">
                  Project: {projectId}
                </p>
              )}
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload {getUploadTypeLabel()}
          </button>
        </div>
      )}

      {/* Uploading Progress */}
      {uploadStatus === 'uploading' && (
        <div className="border border-blue-300 bg-blue-50 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                {selectedFile?.name}
              </h4>
              <p className="text-xs text-gray-500">
                Uploading to Google Drive...
              </p>
              {projectId && (
                <p className="text-xs text-blue-600 font-mono mt-1">
                  Organizing in: Production Files/{getUploadTypeLabel()}/{projectId}/
                </p>
              )}
            </div>
            <CloudArrowUpIcon className="w-5 h-5 text-blue-600 animate-pulse" />
          </div>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-600">
            <span>{progress.percentage}% complete</span>
            <span>
              {formatFileSize(progress.loaded)} / {formatFileSize(progress.total)}
            </span>
          </div>
        </div>
      )}

      {/* Upload Success */}
      {uploadStatus === 'success' && (
        <div className="border border-green-300 bg-green-50 rounded-lg p-6">
          <div className="flex items-center justify-center text-green-600 mb-2">
            <CheckCircleIcon className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium text-green-900 text-center mb-1">
            Upload Successful!
          </p>
          <p className="text-xs text-green-700 text-center">
            File has been uploaded to Google Drive
          </p>
        </div>
      )}

      {/* Upload Error */}
      {uploadStatus === 'error' && (
        <div className="border border-red-300 bg-red-50 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center text-red-600 mb-2">
                <XCircleIcon className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Upload Failed</span>
              </div>
              <p className="text-xs text-red-700">
                Please try again or contact support
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="w-full bg-white border border-red-300 text-red-700 py-2 px-4 rounded-lg hover:bg-red-50 transition"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
