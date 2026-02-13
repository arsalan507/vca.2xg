import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Video, CheckCircle, X, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';
import { editorService } from '@/services/editorService';
import { backendUploadService, type UploadProgress } from '@/services/backendUploadService';
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
  }, [id]);

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

    // Start upload immediately
    setIsUploading(true);

    try {
      const result = await backendUploadService.uploadEditedVideo(
        selectedFile,
        project.content_id || project.id,
        project.id,
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
        }
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
    backendUploadService.cancelUpload();
    setIsUploading(false);
    setUploadProgress(0);
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

      <div className="px-4 py-4 pb-32">
        {/* Upload Area */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Final Video</h3>

          {!file ? (
            <label className="flex flex-col items-center justify-center gap-3 p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer active:border-editor active:bg-green-50 transition-colors">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Video className="w-8 h-8 text-editor" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-800">Tap to upload final edit</p>
                <p className="text-sm text-gray-500">MP4, MOV • Max 500MB</p>
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
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
      </div>
    </>
  );
}
