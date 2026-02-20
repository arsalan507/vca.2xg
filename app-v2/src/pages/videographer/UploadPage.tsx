import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Video, X, CheckCircle, AlertCircle, Loader2, Film, Mic, Play, FileVideo, Trash2, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';
import { videographerService } from '@/services/videographerService';
import { googleDriveOAuthService, type UploadProgress } from '@/services/googleDriveOAuthService';
import { productionFilesService } from '@/services/productionFilesService';
import type { ViralAnalysis } from '@/types';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  errorMessage?: string;
  uploadResult?: {
    fileId: string;
    webViewLink: string;
  };
}

type FileType = 'A_ROLL' | 'B_ROLL' | 'HOOK' | 'BODY' | 'CTA' | 'AUDIO_CLIP';

interface FileTypeOption {
  id: FileType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const FILE_TYPES: FileTypeOption[] = [
  { id: 'A_ROLL', label: 'A-Roll', icon: <Film className="w-5 h-5" />, description: 'Main footage' },
  { id: 'B_ROLL', label: 'B-Roll', icon: <FileVideo className="w-5 h-5" />, description: 'Cutaway shots' },
  { id: 'HOOK', label: 'Hook', icon: <Play className="w-5 h-5" />, description: 'Opening clip' },
  { id: 'BODY', label: 'Body', icon: <Video className="w-5 h-5" />, description: 'Main content' },
  { id: 'CTA', label: 'CTA', icon: <Play className="w-5 h-5" />, description: 'Call to action' },
  { id: 'AUDIO_CLIP', label: 'Audio', icon: <Mic className="w-5 h-5" />, description: 'Audio clips' },
];

export default function UploadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ViralAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [_currentUploadIndex, setCurrentUploadIndex] = useState(-1);
  const [selectedFileType, setSelectedFileType] = useState<FileType>('A_ROLL');
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [productionNotes, setProductionNotes] = useState('');

  // Google OAuth state
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (id) loadProject();
    checkGoogleSignIn();
  }, [id]);

  const checkGoogleSignIn = async () => {
    try {
      setCheckingAuth(true);
      const signedIn = await googleDriveOAuthService.isUserSignedIn();
      setIsSignedIn(signedIn);
    } catch (error) {
      console.error('Error checking sign-in status:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await googleDriveOAuthService.signIn();
      setIsSignedIn(true);
      toast.success('Signed in to Google Drive!');
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in to Google');
    } finally {
      setIsSigningIn(false);
    }
  };

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await videographerService.getProjectById(id!);
      setProject(data);
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project');
      navigate('/videographer/my-projects');
    } finally {
      setLoading(false);
    }
  };

  // Get category emoji based on title
  const getCategoryEmoji = (project: ViralAnalysis) => {
    const title = (project.title || '').toLowerCase();
    if (title.includes('fitness') || title.includes('gym') || title.includes('workout')) return '🏋️';
    if (title.includes('food') || title.includes('recipe') || title.includes('cook')) return '🍳';
    if (title.includes('coffee') || title.includes('cafe')) return '☕';
    if (title.includes('office') || title.includes('work')) return '👨‍💼';
    if (title.includes('home') || title.includes('decor') || title.includes('diy') || title.includes('routine') || title.includes('morning')) return '🏠';
    if (title.includes('travel') || title.includes('outdoor') || title.includes('street')) return '🌳';
    if (title.includes('tech') || title.includes('gadget')) return '📱';
    if (title.includes('fashion') || title.includes('style')) return '👗';
    if (title.includes('music') || title.includes('dance')) return '💃';
    if (title.includes('tutorial')) return '📚';
    return '🎬';
  };

  // Get shoot type info
  const getShootTypeInfo = (shootType?: string) => {
    const type = (shootType || 'indoor').toLowerCase();
    if (type.includes('outdoor')) return { emoji: '🌳', label: 'Outdoor', bg: 'rgba(34, 197, 94, 0.1)' };
    if (type.includes('studio')) return { emoji: '🎬', label: 'Studio', bg: 'rgba(147, 51, 234, 0.1)' };
    if (type.includes('store') || type.includes('shop')) return { emoji: '🏪', label: 'In Store', bg: 'rgba(99, 102, 241, 0.1)' };
    return { emoji: '🏠', label: 'Indoor', bg: 'rgba(249, 115, 22, 0.1)' };
  };

  // Get platform info
  const getPlatformInfo = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('youtube') && p.includes('short')) return { emoji: '🎬', label: 'YouTube Shorts' };
    if (p.includes('youtube')) return { emoji: '▶️', label: 'YouTube Long' };
    if (p.includes('tiktok')) return { emoji: '🎵', label: 'TikTok' };
    return { emoji: '📸', label: 'Instagram' };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadFile[] = Array.from(selectedFiles).map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      progress: 0,
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('Please add files to upload');
      return;
    }

    if (!project) {
      toast.error('Project not loaded');
      return;
    }

    if (!isSignedIn) {
      toast.error('Please sign in to Google first');
      return;
    }

    setIsUploading(true);

    // Map our file type to Drive folder type
    const driveFileType = 'raw-footage'; // All videographer uploads go to raw-footage folder

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.status === 'complete') continue;

      setCurrentUploadIndex(i);

      // If retrying a previously failed upload that has a Drive fileId, delete the orphaned file first
      if (file.status === 'error' && file.uploadResult?.fileId) {
        try {
          console.log('[UploadPage] Cleaning up orphaned file from previous attempt:', file.uploadResult.fileId);
          await googleDriveOAuthService.deleteFile(file.uploadResult.fileId);
        } catch (cleanupError) {
          console.warn('[UploadPage] Failed to delete orphaned file, continuing anyway:', cleanupError);
        }
      }

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: 'uploading' as const, progress: 0, errorMessage: undefined } : f
        )
      );

      let driveUploadResult: any = null;

      try {
        // Get or create folder structure in user's Drive
        const folderId = await googleDriveOAuthService.getOrCreateFolderForFileType(
          project.content_id || project.id,
          driveFileType
        );

        // Generate auto-renamed file name: {content_id}_raw_{NN}.{ext}
        let renamedFileName: string | undefined;
        if (project.content_id) {
          const ext = file.file.name.split('.').pop() || 'mov';
          // Count existing raw files + already-uploaded files in this batch
          const existingFiles = project.production_files?.filter((f: any) => !f.is_deleted) || [];
          const alreadyUploadedInBatch = files.filter((f2, idx) => idx < i && f2.status === 'complete').length;
          const rawNum = existingFiles.length + alreadyUploadedInBatch + 1;
          renamedFileName = `${project.content_id}_raw_${String(rawNum).padStart(2, '0')}.${ext}`;
        }

        // Upload to user's Google Drive
        driveUploadResult = await googleDriveOAuthService.uploadFile(
          file.file,
          folderId,
          (progress: UploadProgress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id ? { ...f, progress: progress.percentage } : f
              )
            );
          },
          file.id,
          renamedFileName
        );

        // Record file in database with selected file type
        const displayName = renamedFileName || file.file.name;
        try {
          const dbRecord = await productionFilesService.createFileRecord({
            analysisId: project.id,
            fileType: selectedFileType,
            fileName: displayName,
            fileUrl: driveUploadResult.webViewLink,
            fileId: driveUploadResult.fileId,
            fileSize: driveUploadResult.size,
            mimeType: file.file.type,
          });
          console.log('[UploadPage] File record saved to DB:', dbRecord);
        } catch (dbError: any) {
          console.error('Failed to save file record to database:', dbError);
          const errMsg = dbError?.message || dbError?.details || 'Database error';

          // Database save failed - delete the orphaned file from Drive
          if (driveUploadResult?.fileId) {
            try {
              console.log('[UploadPage] Database save failed, deleting orphaned Drive file:', driveUploadResult.fileId);
              await googleDriveOAuthService.deleteFile(driveUploadResult.fileId);
              toast.error(`Upload failed: ${errMsg}. Cleaned up Drive file. Tap to retry.`);
            } catch (deleteError) {
              console.error('[UploadPage] Failed to delete orphaned Drive file:', deleteError);
              toast.error(`Upload failed: ${errMsg}. WARNING: File may be orphaned in Drive. Contact admin.`);
              // Store the fileId so we can clean it up on retry
              throw new Error(`Database save failed. File orphaned in Drive (ID: ${driveUploadResult.fileId}). ${errMsg}`);
            }
          }

          throw new Error(`Failed to save to database: ${errMsg}`);
        }

        // Mark as complete
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'complete' as const,
                  progress: 100,
                  uploadResult: {
                    fileId: driveUploadResult.fileId,
                    webViewLink: driveUploadResult.webViewLink,
                  },
                }
              : f
          )
        );
      } catch (error) {
        console.error('Upload failed:', error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'error' as const,
                  errorMessage: error instanceof Error ? error.message : 'Upload failed',
                  // Store Drive fileId if upload succeeded but DB save failed, so we can clean it up on retry
                  uploadResult: driveUploadResult ? {
                    fileId: driveUploadResult.fileId,
                    webViewLink: driveUploadResult.webViewLink,
                  } : undefined,
                }
              : f
          )
        );
      }
    }

    setIsUploading(false);
    setCurrentUploadIndex(-1);

    // Reload project to get updated file list
    await loadProject();

    // Read current file states without calling toast inside updater (avoids React setState-in-render)
    let completedCount = 0;
    let failedCount = 0;
    setFiles((prev) => {
      completedCount = prev.filter((f) => f.status === 'complete').length;
      failedCount = prev.filter((f) => f.status === 'error').length;
      return prev; // Don't modify yet
    });

    // Show toasts outside of setState to avoid React render warnings
    if (failedCount > 0) {
      toast.error(`${failedCount} file(s) failed to upload. Check errors above.`);
      setFiles((prev) => prev.filter((f) => f.status !== 'complete'));
    } else if (completedCount > 0) {
      toast.success('All files uploaded successfully!');
      setFiles([]);
    }
  };

  const handleMarkComplete = async () => {
    if (!project) return;

    // Check if there are existing files
    const existingFiles = project.production_files?.filter((f: any) => !f.is_deleted) || [];
    if (existingFiles.length === 0 && files.filter(f => f.status === 'complete').length === 0) {
      toast.error('Please upload at least one file first');
      return;
    }

    try {
      await videographerService.markShootingComplete(project.id, productionNotes || undefined);
      toast.success('Shooting marked as complete!');
      navigate('/videographer/my-projects');
    } catch (error) {
      console.error('Failed to mark complete:', error);
      toast.error('Failed to mark shooting as complete');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      setDeletingFileId(fileId);
      await productionFilesService.softDeleteFile(fileId);
      toast.success('File deleted');
      await loadProject();
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Failed to delete file');
    } finally {
      setDeletingFileId(null);
    }
  };

  const cancelUpload = () => {
    // Abort all active uploads
    files.forEach(file => {
      if (file.status === 'uploading') {
        googleDriveOAuthService.abortUpload(file.id);
      }
    });

    setIsUploading(false);
    setCurrentUploadIndex(-1);
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'uploading' ? { ...f, status: 'pending' as const, progress: 0 } : f
      )
    );
    toast('Upload cancelled');
  };

  const completedCount = files.filter((f) => f.status === 'complete').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const existingFiles = project?.production_files?.filter((f: any) => !f.is_deleted) || [];

  // Get file type label
  const getFileTypeLabel = (fileType: string) => {
    const type = FILE_TYPES.find(t => t.id === fileType);
    return type?.label || fileType.replace(/_/g, ' ').replace('raw-footage', 'Raw Footage');
  };

  if (loading) {
    return (
      <>
        <Header title="Upload Footage" showBack />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Upload Footage" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Project not found</div>
      </>
    );
  }

  const shootType = getShootTypeInfo(project.shoot_type);
  const platform = getPlatformInfo(project.platform);
  const categoryEmoji = getCategoryEmoji(project);

  return (
    <>
      <Header
        title="Upload Footage"
        subtitle={project.profile?.name ? `🎯 ${project.profile.name}` : `${project.content_id || 'Project'} • ${project.title || project.hook?.slice(0, 30) || 'Untitled'}`}
        showBack
      />

      <div className="px-4 py-4 pb-72">
        {/* Project Info Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: shootType.bg }}
            >
              {categoryEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
              {project.profile?.name && (
                <p className="text-sm text-orange-600 font-medium mb-1">
                  🎯 {project.profile.name}
                </p>
              )}
              <p className="text-xs text-gray-400 font-mono">{project.content_id || 'No ID'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                  {platform.emoji} {platform.label}
                </span>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                  {shootType.emoji} {shootType.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Google Sign-in Section */}
        {checkingAuth ? (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6 text-center">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-blue-700">Checking Google sign-in...</p>
          </div>
        ) : !isSignedIn ? (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Sign in with Google</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Sign in to upload files to your Google Drive
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isSigningIn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Signed In Badge */}
            <div className="bg-green-50 rounded-xl border border-green-200 p-3 mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Connected to Google Drive</span>
            </div>

            {/* File Type Selection */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-800 mb-3">File Type</h2>
              <div className="grid grid-cols-3 gap-2">
                {FILE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedFileType(type.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                      selectedFileType === type.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className={`mb-1 ${selectedFileType === type.id ? 'text-orange-500' : 'text-gray-400'}`}>
                      {type.icon}
                    </div>
                    <span className={`text-sm font-medium ${selectedFileType === type.id ? 'text-orange-600' : 'text-gray-700'}`}>
                      {type.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Area */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-800 mb-3">Upload Files</h2>
              <label className="flex flex-col items-center justify-center gap-2 p-6 bg-white border-2 border-dashed border-gray-200 rounded-xl cursor-pointer active:border-orange-500 active:bg-orange-50 transition-colors">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-800">Tap to add files</p>
                  <p className="text-xs text-gray-400">MP4, MOV • Max 1GB each</p>
                </div>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* Pending Upload Files */}
            {files.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-800">
                    Pending Upload
                    {errorCount > 0 && (
                      <span className="text-red-500 text-sm font-normal ml-2">• {errorCount} failed</span>
                    )}
                  </h2>
                  <span className="text-sm text-gray-500">{completedCount}/{files.length}</span>
                </div>

                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center gap-3 p-3 bg-white rounded-xl border ${
                        file.status === 'error' ? 'border-red-200' : 'border-gray-100'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          file.status === 'complete'
                            ? 'bg-green-100'
                            : file.status === 'uploading'
                            ? 'bg-orange-100'
                            : file.status === 'error'
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {file.status === 'complete' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : file.status === 'uploading' ? (
                          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                        ) : file.status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Video className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">{file.file.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {(file.file.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">
                            {getFileTypeLabel(selectedFileType)}
                          </span>
                          {file.status === 'error' && (
                            <span className="text-xs text-red-500">{file.errorMessage}</span>
                          )}
                        </div>

                        {/* Progress bar */}
                        {file.status === 'uploading' && (
                          <div className="mt-2">
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-500 transition-all duration-300"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {file.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(file.id)}
                          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Previously Uploaded Files */}
        {existingFiles.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Previously Uploaded
              <span className="text-sm font-normal text-gray-400 ml-2">{existingFiles.length} files</span>
            </h2>

            <div className="space-y-2">
              {existingFiles.map((file: any) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {file.file_url ? (
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 truncate text-sm flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">{file.file_name}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ) : (
                      <p className="font-medium text-gray-900 truncate text-sm">{file.file_name}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {file.file_size && (
                        <span className="text-xs text-gray-400">
                          {(file.file_size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded">
                        {getFileTypeLabel(file.file_type)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    disabled={deletingFileId === file.id}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-50"
                  >
                    {deletingFileId === file.id ? (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Production Notes (optional) - in scrollable area */}
        {isSignedIn && existingFiles.length > 0 && (
          <div className="mb-6">
            <label htmlFor="production-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Production Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="production-notes"
              placeholder="Add any notes for the editor (e.g., special shots, lighting info, challenges faced, preferred takes...)"
              value={productionNotes}
              onChange={(e) => setProductionNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              aria-label="Production notes for editor"
            />
            <p className="text-xs text-gray-500 mt-1">
              These notes will help the editor understand your footage and creative decisions
            </p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Buttons - positioned above bottom nav with safe area */}
      <div className="fixed left-0 right-0 px-4 py-3 bg-white border-t border-gray-100 max-w-mobile mx-auto z-40" style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
        <div className="flex flex-col gap-2">
          {isUploading ? (
            <Button fullWidth size="lg" variant="outline" onClick={cancelUpload}>
              Cancel Upload
            </Button>
          ) : !isSignedIn && !checkingAuth ? (
            <Button
              fullWidth
              size="lg"
              className="bg-blue-500 hover:bg-blue-600"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
            >
              {isSigningIn ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Sign in to Google
            </Button>
          ) : (
            <>
              {/* Upload button when files are pending */}
              {isSignedIn && files.length > 0 && completedCount < files.length && (
                <Button
                  fullWidth
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={uploadFiles}
                >
                  <Upload className="w-5 h-5" />
                  Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
                </Button>
              )}

              {/* Mark Complete button */}
              <Button
                fullWidth
                size="lg"
                variant="success"
                onClick={handleMarkComplete}
                disabled={existingFiles.length === 0}
              >
                <CheckCircle className="w-5 h-5" />
                Mark Shoot Complete
              </Button>

              {/* Save & Continue Later */}
              <button
                onClick={() => navigate('/videographer/my-projects')}
                className="w-full text-center text-sm text-gray-500 font-medium py-2 hover:text-gray-700"
              >
                Save & Continue Later
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
