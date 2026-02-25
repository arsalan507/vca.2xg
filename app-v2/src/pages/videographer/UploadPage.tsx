import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Video, X, CheckCircle, AlertCircle, Loader2, Film, Mic, Play, FileVideo, Trash2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';
import { videographerService } from '@/services/videographerService';
import { driveUploadService, type UploadProgress } from '@/services/driveUploadService';
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
  const [showScript, setShowScript] = useState(true);

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

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

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.status === 'complete') continue;

      setCurrentUploadIndex(i);

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: 'uploading' as const, progress: 0, errorMessage: undefined } : f
        )
      );

      try {
        // Step 1: Get resumable upload URI from backend
        const { resumableUri, fileName: renamedFileName } = await driveUploadService.initUpload({
          contentId: project.content_id || project.id,
          analysisId: project.id,
          fileName: file.file.name,
          mimeType: file.file.type,
          fileSize: file.file.size,
          fileType: 'raw-footage',
          fileIndex: i,
        });

        // Step 2: Upload file directly to Google Drive
        const driveResult = await driveUploadService.uploadFile(
          file.file,
          resumableUri,
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

        // Step 3: Finalize — make public + save to DB
        await driveUploadService.finalizeUpload({
          analysisId: project.id,
          fileType: selectedFileType,
          fileName: renamedFileName,
          fileId: driveResult.fileId,
          fileUrl: driveResult.webViewLink,
          fileSize: driveResult.size,
          mimeType: file.file.type,
        });

        // Mark as complete
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'complete' as const,
                  progress: 100,
                  uploadResult: {
                    fileId: driveResult.fileId,
                    webViewLink: driveResult.webViewLink,
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

    // Read current file states
    let completedCount = 0;
    let failedCount = 0;
    setFiles((prev) => {
      completedCount = prev.filter((f) => f.status === 'complete').length;
      failedCount = prev.filter((f) => f.status === 'error').length;
      return prev;
    });

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
    files.forEach(file => {
      if (file.status === 'uploading') {
        driveUploadService.abortUpload(file.id);
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

        {/* Script & Shooting Info */}
        {(project.hook || project.script_body || project.script_cta || project.production_notes || (project as any).character_tags?.length > 0 || (project.cast_composition && (project.cast_composition as any).total > 0)) && (
          <div className="mb-6">
            <button
              onClick={() => setShowScript(v => !v)}
              className={`w-full flex items-center justify-between bg-yellow-50 border-2 border-yellow-200 px-4 py-3 ${showScript ? 'rounded-t-xl' : 'rounded-xl'}`}
            >
              <span className="text-sm font-bold text-yellow-800">✨ Script & Shooting Info</span>
              {showScript ? <ChevronUp className="w-4 h-4 text-yellow-700" /> : <ChevronDown className="w-4 h-4 text-yellow-700" />}
            </button>
            {showScript && (
              <div className="border-2 border-yellow-200 border-t-0 rounded-b-xl overflow-hidden">
                {/* Characters & Cast */}
                {((project as any).character_tags?.length > 0 || (project.cast_composition && (project.cast_composition as any).total > 0)) && (
                  <div className="bg-indigo-50 px-4 py-3 border-b border-yellow-200">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">🎭 Characters & Cast</p>
                    {(project as any).character_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(project as any).character_tags.map((tag: any) => (
                          <span key={tag.id} className="px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm" style={{ backgroundColor: tag.color || '#6366f1' }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {project.cast_composition && (project.cast_composition as any).total > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(project.cast_composition as unknown as Record<string, unknown>)
                          .filter(([key, val]) => key !== 'total' && key !== 'include_owner' && typeof val === 'number' && val > 0)
                          .map(([key, val]) => (
                            <span key={key} className="px-2 py-1 rounded text-[11px] font-medium bg-white text-indigo-700 border border-indigo-200">
                              {key.replace(/_/g, ' ')} × {val as number}
                            </span>
                          ))}
                        {(project.cast_composition as any).include_owner && (
                          <span className="px-2 py-1 rounded text-[11px] font-medium bg-orange-100 text-orange-700 border border-orange-200">+ Owner</span>
                        )}
                        <span className="px-2 py-1 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                          Total: {(project.cast_composition as any).total}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Hook - highlighted */}
                {project.hook && (
                  <div className="bg-orange-50 px-4 py-3 border-b border-yellow-200">
                    <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wide mb-1">🎣 HOOK</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{project.hook}</p>
                  </div>
                )}

                {/* Script Body */}
                {project.script_body && (
                  <div className="bg-white px-4 py-3 border-b border-yellow-200">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">📝 SCRIPT</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{project.script_body}</p>
                  </div>
                )}

                {/* CTA */}
                {project.script_cta && (
                  <div className="bg-green-50 px-4 py-3 border-b border-yellow-200">
                    <p className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1">📣 CTA</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{project.script_cta}</p>
                  </div>
                )}

                {/* Team Notes */}
                {project.production_notes && (
                  <div className="bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">📋 TEAM NOTES</p>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{project.production_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

        {/* Production Notes (optional) */}
        {existingFiles.length > 0 && (
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

      {/* Fixed Bottom Buttons */}
      <div className="fixed left-0 right-0 px-4 py-3 bg-white border-t border-gray-100 max-w-mobile mx-auto z-40" style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
        <div className="flex flex-col gap-2">
          {isUploading ? (
            <Button fullWidth size="lg" variant="outline" onClick={cancelUpload}>
              Cancel Upload
            </Button>
          ) : (
            <>
              {/* Upload button when files are pending */}
              {files.length > 0 && completedCount < files.length && (
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
