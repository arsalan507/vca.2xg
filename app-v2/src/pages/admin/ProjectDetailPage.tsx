import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ExternalLink,
  Play,
  Pause,
  User,
  Video,
  Scissors,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Mic,
  FileVideo,
  Download,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import { adminService } from '@/services/adminService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

interface SkipEntry {
  id: string;
  user_id: string;
  role: string;
  skipped_at: string;
  full_name?: string;
  email?: string;
}

type TabType = 'details' | 'files' | 'team';

interface EditReviewState {
  showRejectModal: boolean;
  rejectReason: string;
  submitting: boolean;
}

const PRODUCTION_STAGES = [
  { id: 'PLANNING', label: 'Planning', color: 'bg-blue-500' },
  { id: 'SHOOTING', label: 'Shooting', color: 'bg-orange-500' },
  { id: 'READY_FOR_EDIT', label: 'Ready for Edit', color: 'bg-purple-500' },
  { id: 'EDITING', label: 'Editing', color: 'bg-pink-500' },
  { id: 'EDIT_REVIEW', label: 'Edit Review', color: 'bg-amber-500' },
  { id: 'READY_TO_POST', label: 'Ready to Post', color: 'bg-green-500' },
  { id: 'POSTED', label: 'Posted', color: 'bg-emerald-500' },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ViralAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [skips, setSkips] = useState<SkipEntry[]>([]);
  const [removingSkip, setRemovingSkip] = useState<string | null>(null);
  const [editReview, setEditReview] = useState<EditReviewState>({
    showRejectModal: false,
    rejectReason: '',
    submitting: false,
  });

  useEffect(() => {
    if (id) {
      loadProject();
      loadSkips();
    }
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
      const data = await adminService.getAnalysis(id!);
      setProject(data);
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project');
      navigate('/admin/production');
    } finally {
      setLoading(false);
    }
  };

  const loadSkips = async () => {
    try {
      const data = await adminService.getProjectSkips(id!);
      setSkips(data);
    } catch {
      // Silently fail — table may not exist yet
    }
  };

  const handleRemoveSkip = async (skipId: string) => {
    try {
      setRemovingSkip(skipId);
      await adminService.removeSkip(skipId);
      setSkips((prev) => prev.filter((s) => s.id !== skipId));
      toast.success('Project restored to available list');
    } catch {
      toast.error('Failed to remove skip');
    } finally {
      setRemovingSkip(null);
    }
  };

  const handleApproveEdit = async () => {
    try {
      setEditReview((prev) => ({ ...prev, submitting: true }));
      await adminService.approveEditedVideo(id!);
      toast.success('Edit approved! Project moved to Ready to Post.');
      loadProject();
    } catch (error) {
      console.error('Failed to approve edit:', error);
      toast.error('Failed to approve edit');
    } finally {
      setEditReview((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleRejectEdit = async () => {
    if (!editReview.rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    try {
      setEditReview((prev) => ({ ...prev, submitting: true }));
      await adminService.rejectEditedVideo(id!, editReview.rejectReason.trim());
      toast.success('Edit rejected. Project sent back to editor.');
      setEditReview({ showRejectModal: false, rejectReason: '', submitting: false });
      loadProject();
    } catch (error) {
      console.error('Failed to reject edit:', error);
      toast.error('Failed to reject edit');
    } finally {
      setEditReview((prev) => ({ ...prev, submitting: false }));
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

  const getPlatformIcon = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram_reel': return '📸';
      case 'youtube_shorts': return '🎬';
      case 'youtube_long': return '▶️';
      default: return '📹';
    }
  };

  const getPlatformLabel = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram_reel': return 'Instagram Reel';
      case 'youtube_shorts': return 'YouTube Shorts';
      case 'youtube_long': return 'YouTube Long';
      default: return 'Video';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  const getCurrentStageIndex = () => {
    if (!project?.production_stage) return 0;
    const stages = ['PLANNING', 'SHOOTING', 'READY_FOR_EDIT', 'EDITING', 'EDIT_REVIEW', 'READY_TO_POST', 'POSTED'];
    const stage = project.production_stage.toUpperCase().replace(/-/g, '_');
    if (['NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'].includes(stage)) return 0;
    if (['SHOOT_REVIEW'].includes(stage)) return 2;
    if (['FINAL_REVIEW'].includes(stage)) return 5;
    return stages.indexOf(stage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-4"
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {project.content_id && (
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                {project.content_id}
              </span>
            )}
            <span>{getPlatformIcon(project.platform)} {getPlatformLabel(project.platform)}</span>
          </div>
        </div>
        {getStatusBadge(project.status)}
      </motion.div>

      {/* Production Stage Progress */}
      {project.status === 'APPROVED' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-xl p-4 mb-4"
        >
          <h3 className="text-sm font-medium text-gray-700 mb-3">Production Progress</h3>
          <div className="flex items-center justify-between mb-2">
            {PRODUCTION_STAGES.map((stage, index) => (
              <div key={stage.id} className="flex-1 flex items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    index <= currentStageIndex
                      ? `${stage.color} text-white`
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index < currentStageIndex ? '✓' : index + 1}
                </div>
                {index < PRODUCTION_STAGES.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-1 rounded ${
                      index < currentStageIndex ? stage.color : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-500">
            {PRODUCTION_STAGES.map((stage) => (
              <span key={stage.id} className="text-center flex-1">{stage.label}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['details', 'files', 'team'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <motion.div
          key="details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Reference Link */}
          {project.reference_url && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Reference Video</h3>
              <a
                href={project.reference_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-purple-600 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open Original
              </a>
            </div>
          )}

          {/* Why Viral */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Why It's Viral</h3>
              {project.why_viral_voice_note_url && (
                <button
                  onClick={() => playVoiceNote(project.why_viral_voice_note_url!, 'whyViral')}
                  className="p-1.5 rounded-full bg-purple-100 text-purple-600"
                >
                  {playingAudio === 'whyViral' ? <Pause className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600">{project.why_viral || 'Not provided'}</p>
          </div>

          {/* How To Replicate */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">How To Replicate</h3>
              {project.how_to_replicate_voice_note_url && (
                <button
                  onClick={() => playVoiceNote(project.how_to_replicate_voice_note_url!, 'howToReplicate')}
                  className="p-1.5 rounded-full bg-purple-100 text-purple-600"
                >
                  {playingAudio === 'howToReplicate' ? <Pause className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.how_to_replicate || 'Not provided'}</p>
          </div>

          {/* Hook Voice Note */}
          {project.hook_voice_note_url && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Hook Explanation</h3>
                <button
                  onClick={() => playVoiceNote(project.hook_voice_note_url!, 'hook')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-600 text-sm"
                >
                  {playingAudio === 'hook' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {playingAudio === 'hook' ? 'Playing...' : 'Play'}
                </button>
              </div>
            </div>
          )}

          {/* Scores */}
          {project.overall_score && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Review Scores</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Hook Strength', value: project.hook_strength },
                  { label: 'Content Quality', value: project.content_quality },
                  { label: 'Viral Potential', value: project.viral_potential },
                  { label: 'Replication Clarity', value: project.replication_clarity },
                ].map((score) => (
                  <div key={score.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{score.label}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (score.value || 0) >= 8 ? 'bg-green-500' :
                            (score.value || 0) >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(score.value || 0) * 10}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{score.value || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-600">Overall Score</span>
                <span className={`text-lg font-bold ${
                  project.overall_score >= 8 ? 'text-green-600' :
                  project.overall_score >= 6 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {project.overall_score.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Shoot Type</span>
                <span className="text-gray-900">{project.shoot_type === 'outdoor' ? '🌳 Outdoor' : '🏠 Indoor'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Target Emotion</span>
                <span className="text-gray-900 capitalize">{project.target_emotion || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Content Rating</span>
                <span className="text-gray-900">{project.content_rating || 'Not rated'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Submitted By</span>
                <span className="text-gray-900">{project.full_name || project.email}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'files' && (
        <motion.div
          key="files"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Production Files from DB */}
          {(() => {
            const files = (project as any).production_files || [];
            const rawFiles = files.filter((f: any) =>
              ['A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'RAW_FOOTAGE', 'raw-footage'].includes(f.file_type)
            );
            const editedFiles = files.filter((f: any) =>
              ['edited-video', 'EDITED_VIDEO'].includes(f.file_type)
            );
            const finalFiles = files.filter((f: any) =>
              ['final-video', 'FINAL_VIDEO'].includes(f.file_type)
            );

            const renderFileList = (fileList: any[]) => {
              if (fileList.length === 0) {
                // Fallback to legacy URL columns
                return null;
              }
              return (
                <div className="space-y-2">
                  {fileList.map((file: any) => (
                    <a
                      key={file.id}
                      href={file.drive_view_link || file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-purple-600 text-sm bg-purple-50 px-3 py-2 rounded-lg"
                    >
                      <FileVideo className="w-4 h-4" />
                      <span className="flex-1 truncate">{file.file_name || file.file_type}</span>
                      <span className="text-xs text-gray-400 shrink-0">{file.file_type}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              );
            };

            return (
              <>
                {/* Raw Footage */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Raw Footage
                    {rawFiles.length > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">{rawFiles.length}</span>
                    )}
                  </h3>
                  {renderFileList(rawFiles) || (
                    (project as any).raw_file_url || (project as any).raw_footage_drive_url ? (
                      <a
                        href={(project as any).raw_file_url || (project as any).raw_footage_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-purple-600 text-sm bg-purple-50 px-3 py-2 rounded-lg"
                      >
                        <FileVideo className="w-4 h-4" />
                        <span className="flex-1">View Raw Footage</span>
                        <Download className="w-4 h-4" />
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">No raw footage uploaded yet</p>
                    )
                  )}
                </div>

                {/* Edited Video */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Scissors className="w-4 h-4" />
                    Edited Video
                    {editedFiles.length > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">{editedFiles.length}</span>
                    )}
                  </h3>
                  {renderFileList(editedFiles) || (
                    (project as any).edited_file_url || (project as any).edited_video_drive_url ? (
                      <a
                        href={(project as any).edited_file_url || (project as any).edited_video_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-purple-600 text-sm bg-purple-50 px-3 py-2 rounded-lg"
                      >
                        <FileVideo className="w-4 h-4" />
                        <span className="flex-1">View Edited Video</span>
                        <Download className="w-4 h-4" />
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">No edited video uploaded yet</p>
                    )
                  )}
                </div>

                {/* Final Video */}
                {finalFiles.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Final Video
                      <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">{finalFiles.length}</span>
                    </h3>
                    {renderFileList(finalFiles)}
                  </div>
                )}
              </>
            );
          })()}

          {/* Feedback Voice Note */}
          {project.feedback_voice_note_url && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Review Feedback
              </h3>
              <button
                onClick={() => playVoiceNote(project.feedback_voice_note_url!, 'feedback')}
                className="flex items-center gap-2 text-purple-600 text-sm bg-purple-50 px-3 py-2 rounded-lg w-full"
              >
                {playingAudio === 'feedback' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="flex-1 text-left">{playingAudio === 'feedback' ? 'Playing...' : 'Play Feedback'}</span>
              </button>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'team' && (
        <motion.div
          key="team"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Script Writer */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Script Writer
            </h3>
            <div className="flex items-center gap-3">
              {project.avatar_url ? (
                <img src={project.avatar_url} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">{project.full_name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">{project.email}</p>
              </div>
            </div>
          </div>

          {/* Videographer */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Video className="w-4 h-4" />
              Videographer
            </h3>
            {project.videographer ? (
              <div className="flex items-center gap-3">
                {project.videographer.avatar_url ? (
                  <img src={project.videographer.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Video className="w-5 h-5 text-orange-600" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{project.videographer.full_name || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">{project.videographer.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not assigned</p>
            )}
          </div>

          {/* Editor */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Editor
            </h3>
            {project.editor ? (
              <div className="flex items-center gap-3">
                {project.editor.avatar_url ? (
                  <img src={project.editor.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                    <Scissors className="w-5 h-5 text-pink-600" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{project.editor.full_name || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">{project.editor.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not assigned</p>
            )}
          </div>

          {/* Posting Manager */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Posting Manager
            </h3>
            {project.posting_manager ? (
              <div className="flex items-center gap-3">
                {project.posting_manager.avatar_url ? (
                  <img src={project.posting_manager.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Send className="w-5 h-5 text-green-600" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{project.posting_manager.full_name || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">{project.posting_manager.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not assigned</p>
            )}
          </div>

          {/* Skipped By */}
          {skips.length > 0 && (
            <div className="bg-white border border-red-100 rounded-xl p-4">
              <h3 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                <SkipForward className="w-4 h-4" />
                Skipped By ({skips.length})
              </h3>
              <div className="space-y-2">
                {skips.map((skip) => (
                  <div key={skip.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {skip.full_name || skip.email || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {skip.role} &middot; {new Date(skip.skipped_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveSkip(skip.id)}
                      disabled={removingSkip === skip.id}
                      className="ml-2 px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                    >
                      {removingSkip === skip.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Review Button for Pending */}
      {project.status === 'PENDING' && (
        <Link
          to={`/admin/review/${project.id}`}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[448px] py-3 bg-purple-500 text-white text-center rounded-xl font-medium shadow-lg"
        >
          Review This Script
        </Link>
      )}

      {/* Edit Review Actions */}
      {project.production_stage === 'EDIT_REVIEW' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[448px] flex gap-3">
          <button
            onClick={() => setEditReview((prev) => ({ ...prev, showRejectModal: true }))}
            disabled={editReview.submitting}
            className="flex-1 py-3 bg-red-500 text-white text-center rounded-xl font-medium shadow-lg disabled:opacity-50"
          >
            Reject Edit
          </button>
          <button
            onClick={handleApproveEdit}
            disabled={editReview.submitting}
            className="flex-1 py-3 bg-green-500 text-white text-center rounded-xl font-medium shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {editReview.submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Approve Edit
          </button>
        </div>
      )}

      {/* Edit Reject Modal */}
      {editReview.showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[448px] bg-white rounded-2xl p-6 mb-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reject Edit</h3>
            <p className="text-sm text-gray-500 mb-4">
              The editor will see this feedback and can re-edit the video.
            </p>
            <textarea
              value={editReview.rejectReason}
              onChange={(e) => setEditReview((prev) => ({ ...prev, rejectReason: e.target.value }))}
              placeholder="What needs to change? Be specific..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setEditReview({ showRejectModal: false, rejectReason: '', submitting: false })}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectEdit}
                disabled={editReview.submitting || !editReview.rejectReason.trim()}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editReview.submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
