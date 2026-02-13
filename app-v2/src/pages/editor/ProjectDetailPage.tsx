import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Play, Pause, FileText, Video, Download, Upload, Clock, Loader2, CheckCircle, BarChart3, MessageSquare } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui';
import { editorService } from '@/services/editorService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

type TabType = 'script' | 'files' | 'progress';

// Helper to get file type icon and label
const getFileTypeInfo = (fileType: string) => {
  const types: Record<string, { icon: string; label: string; color: string }> = {
    'RAW_FOOTAGE': { icon: '🎬', label: 'Raw', color: 'bg-gray-100' },
    'A_ROLL': { icon: '🎬', label: 'A-Roll', color: 'bg-orange-100' },
    'B_ROLL': { icon: '🎞️', label: 'B-Roll', color: 'bg-blue-100' },
    'HOOK': { icon: '🎣', label: 'Hook', color: 'bg-purple-100' },
    'BODY': { icon: '📝', label: 'Body', color: 'bg-green-100' },
    'CTA': { icon: '📢', label: 'CTA', color: 'bg-red-100' },
    'AUDIO_CLIP': { icon: '🎵', label: 'Audio', color: 'bg-pink-100' },
    'OTHER': { icon: '📁', label: 'Other', color: 'bg-gray-100' },
    'raw-footage': { icon: '🎬', label: 'Raw', color: 'bg-gray-100' },
    'EDITED_VIDEO': { icon: '✅', label: 'Edited', color: 'bg-green-100' },
    'FINAL_VIDEO': { icon: '🎯', label: 'Final', color: 'bg-emerald-100' },
    'edited-video': { icon: '✅', label: 'Edited', color: 'bg-green-100' },
    'final-video': { icon: '🎯', label: 'Final', color: 'bg-emerald-100' },
  };
  return types[fileType] || { icon: '📁', label: fileType, color: 'bg-gray-100' };
};

// File type constants
const RAW_FILE_TYPES = ['RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER', 'raw-footage'];
const EDITED_FILE_TYPES = ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'];

export default function EditorProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ViralAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('script');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [editingProgress, setEditingProgress] = useState(30);
  const [progressNote, setProgressNote] = useState('');

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

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

  const playVoiceNote = (url: string, noteType: string) => {
    if (playingAudio === noteType) {
      audioElement?.pause();
      setPlayingAudio(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    setAudioElement(audio);
    setPlayingAudio(noteType);
  };

  const handleMarkComplete = async () => {
    try {
      setMarkingComplete(true);
      await editorService.markEditingComplete({ analysisId: id! });
      toast.success('Editing marked as complete!');
      navigate('/editor/my-projects');
    } catch (error: any) {
      console.error('Failed to mark complete:', error);
      toast.error(error.message || 'Failed to mark as complete');
    } finally {
      setMarkingComplete(false);
    }
  };

  const getRawFiles = () => {
    return project?.production_files?.filter(
      (f: any) => RAW_FILE_TYPES.includes(f.file_type) && !f.is_deleted
    ) || [];
  };

  const getEditedFiles = () => {
    return project?.production_files?.filter(
      (f: any) => EDITED_FILE_TYPES.includes(f.file_type) && !f.is_deleted
    ) || [];
  };

  const hasEditedFiles = () => getEditedFiles().length > 0;

  const getTotalSize = () => {
    const totalBytes = project?.production_files
      ?.filter((f: any) => RAW_FILE_TYPES.includes(f.file_type) && !f.is_deleted)
      .reduce((sum: number, f: any) => sum + (f.file_size || 0), 0) || 0;
    if (totalBytes > 1024 * 1024 * 1024) {
      return `${(totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(totalBytes / 1024 / 1024)} MB`;
  };

  const handleSaveProgress = () => {
    // In a real app, this would save to the backend
    toast.success(`Progress saved: ${editingProgress}%`);
  };

  const handleRequestFootage = () => {
    const videographer = project?.videographer?.full_name || project?.videographer?.email || 'videographer';
    toast.success(`Request sent to ${videographer}!`);
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'EDITING': return { label: 'Editing', color: 'bg-green-100 text-green-700' };
      case 'EDIT_REVIEW': return { label: 'Under Review', color: 'bg-amber-100 text-amber-700' };
      case 'READY_TO_POST': return { label: 'Ready to Post', color: 'bg-blue-100 text-blue-700' };
      case 'POSTED': return { label: 'Posted', color: 'bg-emerald-100 text-emerald-700' };
      default: return { label: stage || 'Unknown', color: 'bg-gray-100 text-gray-700' };
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Project" showBack />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Project" showBack />
        <div className="text-center py-12">
          <p className="text-gray-500">Project not found</p>
        </div>
      </>
    );
  }

  const stageInfo = getStageLabel(project.production_stage);
  const rawFiles = getRawFiles();
  const editedFiles = getEditedFiles();

  return (
    <>
      <Header
        title={project.title || 'Untitled'}
        subtitle={project.content_id || 'No ID'}
        showBack
        rightAction={
          <span className={`px-2 py-1 text-[11px] font-semibold rounded-full uppercase ${stageInfo.color}`}>
            {stageInfo.label}
          </span>
        }
      />

      <div className="px-4 py-4 pb-32">
        {/* Quick Info Bar */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto hide-scrollbar">
          <span className="px-3 py-1.5 bg-primary/10 rounded-full text-primary text-sm font-medium whitespace-nowrap">
            {project.profile?.name || 'No profile'}
          </span>
          {project.videographer && (
            <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-600 text-sm whitespace-nowrap">
              Shot by: {project.videographer.full_name || project.videographer.email}
            </span>
          )}
          {project.deadline && (
            <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-600 text-sm whitespace-nowrap flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due {new Date(project.deadline).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Reference Video Link */}
        {project.reference_url && (
          <a
            href={project.reference_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl mb-4 text-white"
          >
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Play className="w-6 h-6 ml-0.5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Reference Video</p>
              <p className="text-sm text-white/80">Tap to view original</p>
            </div>
            <ExternalLink className="w-5 h-5 text-white/80" />
          </a>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          {[
            { id: 'script', label: 'Script', icon: FileText },
            { id: 'files', label: 'Footage', icon: Video },
            { id: 'progress', label: 'Progress', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'script' && (
          <div className="space-y-4 animate-fade-in">
            {/* Why Viral */}
            {project.why_viral && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Why It's Viral
                </h3>
                <p className="text-gray-800">{project.why_viral}</p>
              </div>
            )}

            {/* How To Replicate */}
            {project.how_to_replicate && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  How To Replicate
                </h3>
                <p className="text-gray-800 whitespace-pre-wrap">{project.how_to_replicate}</p>
              </div>
            )}

            {/* Voice Notes */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Voice Notes</h3>
              {project.hook_voice_note_url && (
                <button
                  onClick={() => playVoiceNote(project.hook_voice_note_url!, 'hook')}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {playingAudio === 'hook' ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Hook Explanation</p>
                    <p className="text-sm text-gray-500">{playingAudio === 'hook' ? 'Playing...' : 'Tap to play'}</p>
                  </div>
                </button>
              )}
              {project.why_viral_voice_note_url && (
                <button
                  onClick={() => playVoiceNote(project.why_viral_voice_note_url!, 'whyViral')}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {playingAudio === 'whyViral' ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Why Viral</p>
                    <p className="text-sm text-gray-500">{playingAudio === 'whyViral' ? 'Playing...' : 'Tap to play'}</p>
                  </div>
                </button>
              )}
              {project.how_to_replicate_voice_note_url && (
                <button
                  onClick={() => playVoiceNote(project.how_to_replicate_voice_note_url!, 'howTo')}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {playingAudio === 'howTo' ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Replication Steps</p>
                    <p className="text-sm text-gray-500">{playingAudio === 'howTo' ? 'Playing...' : 'Tap to play'}</p>
                  </div>
                </button>
              )}
              {!project.hook_voice_note_url && !project.why_viral_voice_note_url && !project.how_to_replicate_voice_note_url && (
                <p className="text-sm text-gray-400">No voice notes available</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6 animate-fade-in">
            {/* Raw Footage Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Raw Footage</h3>
                <span className="text-xs text-gray-500">{rawFiles.length} files</span>
              </div>

              {rawFiles.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {rawFiles.map((file: any) => {
                      const typeInfo = getFileTypeInfo(file.file_type);
                      return (
                        <a
                          key={file.id}
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white rounded-xl border border-gray-100 p-3 text-center card-press"
                        >
                          <div className="text-3xl mb-2">{typeInfo.icon}</div>
                          <p className="font-medium text-gray-900 text-sm truncate">{file.file_name?.split('.')[0]}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(0)} MB` : '—'}
                          </p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-2 ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </a>
                      );
                    })}
                  </div>

                  {/* Download All Button */}
                  <button
                    onClick={() => {
                      const rawFiles = getRawFiles();
                      if (rawFiles.length === 0) {
                        toast.error('No files to download');
                        return;
                      }
                      rawFiles.forEach((f: any, i: number) => {
                        const fileId = f.file_id;
                        if (!fileId) return;
                        // Stagger opens to avoid popup blockers
                        setTimeout(() => {
                          window.open(`https://drive.google.com/uc?id=${fileId}&export=download`, '_blank');
                        }, i * 500);
                      });
                      toast.success(`Opening ${rawFiles.length} file(s) for download`);
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 p-4 bg-editor/10 rounded-xl text-editor font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    Download All ({getTotalSize()})
                  </button>
                </>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-xl">
                  <p className="text-gray-500 text-sm">No raw footage uploaded yet</p>
                </div>
              )}
            </div>

            {/* Edited Files */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Edited Videos</h3>
                <span className="text-xs text-gray-500">{editedFiles.length} files</span>
              </div>

              {editedFiles.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {editedFiles.map((file: any) => {
                    const typeInfo = getFileTypeInfo(file.file_type);
                    return (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-50 rounded-xl border border-green-200 p-3 text-center card-press"
                      >
                        <div className="text-3xl mb-2">{typeInfo.icon}</div>
                        <p className="font-medium text-gray-900 text-sm truncate">{file.file_name?.split('.')[0]}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(0)} MB` : '—'}
                        </p>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-2 bg-green-200 text-green-700">
                          {typeInfo.label}
                        </span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No edited videos yet</p>
                  <p className="text-sm text-gray-400 mt-1">Upload your edited video to complete</p>
                </div>
              )}
            </div>

            {project.production_stage === 'EDITING' && (
              <div className="space-y-3">
                <Link to={`/editor/upload/${id}`}>
                  <Button fullWidth className="bg-editor">
                    <Upload className="w-5 h-5" />
                    Upload Final Edit
                  </Button>
                </Link>
                <button
                  onClick={handleRequestFootage}
                  className="w-full py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Request More Footage
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-6 animate-fade-in">
            {/* Progress Update Section */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Update Progress
              </h3>
              <div className="text-center text-3xl font-bold text-editor mb-4">
                {editingProgress}%
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={editingProgress}
                onChange={(e) => setEditingProgress(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-editor"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Note Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Add Note (Optional)
              </h3>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-editor"
                rows={3}
                placeholder="e.g., Waiting for better B-roll..."
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
              />
            </div>

            {/* Save Button */}
            <Button
              fullWidth
              className="bg-editor"
              onClick={handleSaveProgress}
            >
              Save Progress
            </Button>

            {/* Project Info */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Project Details
              </h3>
              <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                {[
                  { label: 'Content ID', value: project.content_id || 'Not assigned' },
                  { label: 'Profile', value: project.profile?.name || 'Not set' },
                  { label: 'Platform', value: project.platform?.replace('_', ' ') || 'Not set' },
                  { label: 'Shoot Type', value: project.shoot_type || 'Indoor' },
                  { label: 'Videographer', value: project.videographer?.full_name || project.videographer?.email || 'Not assigned' },
                  { label: 'Deadline', value: project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Not set' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3">
                    <span className="text-gray-500 text-sm">{item.label}</span>
                    <span className="font-medium text-gray-900 text-sm capitalize">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Review Status Banner */}
      {project.production_stage === 'EDIT_REVIEW' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-white via-white to-transparent pt-4 max-w-mobile mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="font-medium text-amber-700">Under Admin Review</p>
            <p className="text-sm text-amber-600 mt-1">Your edit is being reviewed. You'll be notified of the result.</p>
          </div>
        </div>
      )}

      {/* Rejection Feedback Banner */}
      {project.production_stage === 'EDITING' && project.disapproval_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mx-4 mb-4">
          <p className="text-sm font-medium text-red-700 mb-1">Edit Rejected - Please Revise</p>
          <p className="text-sm text-red-600">{project.disapproval_reason}</p>
        </div>
      )}

      {/* Fixed Bottom Button */}
      {project.production_stage === 'EDITING' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-white via-white to-transparent pt-4 max-w-mobile mx-auto">
          {hasEditedFiles() ? (
            <Button
              fullWidth
              size="lg"
              variant="success"
              onClick={handleMarkComplete}
              disabled={markingComplete}
            >
              {markingComplete ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Mark Editing Complete
                </>
              )}
            </Button>
          ) : (
            <Link to={`/editor/upload/${id}`}>
              <Button fullWidth size="lg" className="bg-editor shadow-lg">
                <Upload className="w-5 h-5" />
                Upload Edited Video
              </Button>
            </Link>
          )}
        </div>
      )}
    </>
  );
}
