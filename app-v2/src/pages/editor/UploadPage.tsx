import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Video, CheckCircle, X, AlertCircle, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';
import { editorService } from '@/services/editorService';
import { googleDriveOAuthService, type UploadProgress } from '@/services/googleDriveOAuthService';
import { productionFilesService } from '@/services/productionFilesService';
import type { ViralAnalysis } from '@/types';

interface Checklist {
  videoLength: boolean;
  audioLevels: boolean;
  textOverlays: boolean;
  ctaClear: boolean;
  noWatermarks: boolean;
}

export default function EditorUploadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ViralAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [_uploadResult, setUploadResult] = useState<{ fileId: string; webViewLink: string } | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [checklist, setChecklist] = useState<Checklist>({
    videoLength: false,
    audioLevels: false,
    textOverlays: false,
    ctaClear: false,
    noWatermarks: false,
  });

  // Google OAuth state
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const checklistItems = [
    { key: 'videoLength', label: 'Video is under 60 seconds' },
    { key: 'audioLevels', label: 'Audio levels are balanced' },
    { key: 'textOverlays', label: 'Text overlays are readable' },
    { key: 'ctaClear', label: 'CTA is clear at the end' },
    { key: 'noWatermarks', label: 'No watermarks or copyrighted content' },
  ] as const;

  const allChecked = Object.values(checklist).every(Boolean);

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
      const data = await editorService.getProjectById(id!);
      setProject(data);
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project');
      navigate('/editor/my-projects');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploadError(null);
    setIsUploaded(false);
    setUploadProgress(0);

    if (!project) {
      toast.error('Project not loaded');
      return;
    }

    if (!isSignedIn) {
      toast.error('Please sign in to Google first');
      return;
    }

    // Start upload immediately
    setIsUploading(true);
    const uploadKey = `editor-${Date.now()}`;

    try {
      // Get or create folder structure in user's Drive
      const folderId = await googleDriveOAuthService.getOrCreateFolderForFileType(
        project.content_id || project.id,
        'edited-video'
      );

      // Upload to user's Google Drive
      const result = await googleDriveOAuthService.uploadFile(
        selectedFile,
        folderId,
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
        },
        uploadKey
      );

      // Record file in database
      await productionFilesService.createFileRecord({
        analysisId: project.id,
        fileType: 'edited-video',
        fileName: selectedFile.name,
        fileUrl: result.webViewLink,
        fileId: result.fileId,
        fileSize: result.size,
        mimeType: selectedFile.type,
      });

      setUploadResult({
        fileId: result.fileId,
        webViewLink: result.webViewLink,
      });
      setIsUploaded(true);
      toast.success('Video uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setIsUploaded(false);
    setUploadProgress(0);
    setUploadError(null);
    setUploadResult(null);
  };

  const cancelUpload = () => {
    // Abort active upload
    googleDriveOAuthService.abortUpload(`editor-${Date.now()}`);
    setIsUploading(false);
    setUploadProgress(0);
    setFile(null);
    toast('Upload cancelled');
  };

  const handleSubmit = async () => {
    if (!allChecked || !isUploaded || !project) {
      toast.error('Complete all requirements');
      return;
    }

    try {
      await editorService.markEditingComplete({
        analysisId: project.id,
        productionNotes: editNotes || undefined,
      });
      toast.success('Edit submitted successfully!');
      navigate('/editor/my-projects');
    } catch (error) {
      console.error('Failed to submit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit edit');
    }
  };

  const toggleCheck = (key: keyof Checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <>
        <Header title="Upload Final Edit" showBack />
        <div className="px-4 py-8 text-center text-gray-500">
          <div className="animate-pulse">Loading project...</div>
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Upload Final Edit" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Project not found</div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Upload Final Edit"
        subtitle={project.profile?.name ? `🎯 ${project.profile.name}` : `${project.content_id || 'Project'} • ${project.title || project.hook?.slice(0, 30) || 'Untitled'}`}
        showBack
      />

      <div className="px-4 py-4 pb-72">
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
                  Sign in to upload your edited video to Google Drive
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
          </>
        )}

        {/* Upload Area */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Final Video</h3>

          {!file ? (
            <label className={`flex flex-col items-center justify-center gap-3 p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl transition-colors ${
              isSignedIn ? 'cursor-pointer active:border-editor active:bg-green-50' : 'opacity-50 cursor-not-allowed'
            }`}>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Video className="w-8 h-8 text-editor" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-800">
                  {isSignedIn ? 'Tap to upload final edit' : 'Sign in to Google first'}
                </p>
                <p className="text-sm text-gray-500">MP4, MOV • Max 500MB</p>
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={!isSignedIn}
              />
            </label>
          ) : (
            <div className={`bg-white rounded-xl border ${uploadError ? 'border-red-200' : 'border-gray-100'} p-4`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isUploaded
                    ? 'bg-green-100'
                    : uploadError
                    ? 'bg-red-100'
                    : isUploading
                    ? 'bg-green-50'
                    : 'bg-gray-100'
                }`}>
                  {isUploaded ? (
                    <CheckCircle className="w-6 h-6 text-success" />
                  ) : uploadError ? (
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  ) : (
                    <Video className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                    {isUploaded && ' • Uploaded'}
                    {uploadError && (
                      <span className="text-red-500"> • {uploadError}</span>
                    )}
                  </p>
                </div>
                {!isUploading && (
                  <button
                    onClick={handleRemoveFile}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isUploading && (
                <div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-editor transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      Uploading... {uploadProgress}%
                    </p>
                    <button
                      onClick={cancelUpload}
                      className="text-xs text-red-500 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {uploadError && !isUploading && (
                <label className="block mt-3">
                  <span className="text-sm text-editor font-medium cursor-pointer">
                    Try uploading again
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Pre-submit Checklist */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pre-submit Checklist</h3>

          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
            {checklistItems.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleCheck(item.key)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center text-sm transition-all ${
                  checklist[item.key]
                    ? 'bg-editor text-white'
                    : 'border-2 border-gray-300 text-transparent'
                }`}>
                  ✓
                </div>
                <span className="text-gray-700">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Edit Notes (Optional)</h3>
          <textarea
            className="w-full p-4 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-editor focus:outline-none"
            rows={3}
            placeholder="Any notes about the edit..."
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Fixed Bottom Button - positioned above bottom nav with safe area */}
      <div className="fixed left-0 right-0 px-4 py-4 bg-white border-t border-gray-100 max-w-mobile mx-auto z-40" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        {!isSignedIn && !checkingAuth ? (
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
        ) : isUploading ? (
          <Button fullWidth size="lg" variant="outline" onClick={cancelUpload}>
            Cancel Upload
          </Button>
        ) : (
          <>
            <Button
              fullWidth
              size="lg"
              variant="success"
              onClick={handleSubmit}
              disabled={!allChecked || !isUploaded || isUploading}
            >
              <Upload className="w-5 h-5" />
              Submit Final Edit
            </Button>
            {(!allChecked || !isUploaded) && (
              <p className="text-center text-xs text-gray-500 mt-2">
                {!isUploaded ? 'Upload video first' : 'Complete all checklist items'}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
