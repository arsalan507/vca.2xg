import { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Loader2,
  CheckCircle,
  Play,
  ExternalLink,
  Download,
  X,
  Clock,
  Check,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { postingManagerService } from '@/services/postingManagerService';
import { videographerService } from '@/services/videographerService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  name: string;
}

const PLATFORMS = [
  { id: 'instagram_reel', label: 'Instagram', emoji: '📸', bgColor: 'bg-gradient-to-r from-pink-500 to-orange-400' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', emoji: '🎬', bgColor: 'bg-red-500' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', bgColor: 'bg-gray-800' },
];

// Production stages for timeline
const STAGES = [
  { id: 'script', label: 'Script', completedStages: ['PLANNING', 'SHOOTING', 'READY_FOR_EDIT', 'EDITING', 'READY_TO_POST', 'POSTED'] },
  { id: 'approved', label: 'Approved', completedStages: ['SHOOTING', 'READY_FOR_EDIT', 'EDITING', 'READY_TO_POST', 'POSTED'] },
  { id: 'shot', label: 'Shot', completedStages: ['READY_FOR_EDIT', 'EDITING', 'READY_TO_POST', 'POSTED'] },
  { id: 'editing', label: 'Editing', completedStages: ['READY_TO_POST', 'POSTED'], activeStages: ['EDITING'] },
  { id: 'post', label: 'Post', completedStages: ['POSTED'], activeStages: ['READY_TO_POST'] },
];

// Best posting times by platform
const BEST_POSTING_TIMES: Record<string, string> = {
  instagram_reel: '2PM - 4PM or 7PM - 9PM',
  youtube_shorts: '12PM - 3PM or 7PM - 10PM',
  tiktok: '7PM - 9PM or 9AM - 11AM',
};

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === 'true';

  const [project, setProject] = useState<ViralAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  // Form state
  const [platform, setPlatform] = useState('instagram_reel');
  const [heading, setHeading] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [postedUrl, setPostedUrl] = useState('');
  const [keepInQueue, setKeepInQueue] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPostingSection, setShowPostingSection] = useState(!isPreviewMode);
  const [metricViews, setMetricViews] = useState('');
  const [metricLikes, setMetricLikes] = useState('');
  const [metricComments, setMetricComments] = useState('');
  const [savingMetrics, setSavingMetrics] = useState(false);

  const hashtagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const [data, profileList] = await Promise.all([
        postingManagerService.getProjectById(id!),
        videographerService.getProfiles(),
      ]);
      setProject(data);
      setProfiles(profileList);

      // Pre-fill form if already set
      if (data.posting_platform) setPlatform(data.posting_platform);
      if (data.posting_heading) setHeading(data.posting_heading);
      if (data.posting_caption) setCaption(data.posting_caption);
      if (data.posting_hashtags) setHashtags(data.posting_hashtags);
      if (data.scheduled_post_time) setScheduledTime(data.scheduled_post_time.slice(0, 16));
      if (data.post_views) setMetricViews(String(data.post_views));
      if (data.post_likes) setMetricLikes(String(data.post_likes));
      if (data.post_comments) setMetricComments(String(data.post_comments));

      // Set current profile (or first available if none set)
      if (data.profile_id) {
        setSelectedProfileId(data.profile_id);
      } else if (profileList.length > 0) {
        setSelectedProfileId(profileList[0].id);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    }
  };

  const handleHashtagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAddHashtag();
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handleSaveDetails = async () => {
    if (!caption.trim()) {
      toast.error('Caption is required');
      return;
    }

    const requiresHeading = ['youtube_shorts', 'youtube_long', 'tiktok'].includes(platform);
    if (requiresHeading && !heading.trim()) {
      toast.error('Heading is required for this platform');
      return;
    }

    try {
      setSaving(true);
      await postingManagerService.setPostingDetails({
        analysisId: id!,
        postingPlatform: platform,
        postingCaption: caption,
        postingHeading: heading || undefined,
        postingHashtags: hashtags.length > 0 ? hashtags : undefined,
        scheduledPostTime: scheduledTime || undefined,
        profileId: selectedProfileId || undefined,
      });
      toast.success('Posting details saved!');
      // Reload to show updated profile
      await loadProject();
    } catch (error: any) {
      console.error('Failed to save details:', error);
      toast.error(error.message || 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPosted = async () => {
    if (!postedUrl.trim()) {
      toast.error('Please enter the posted URL');
      return;
    }

    try {
      setPosting(true);
      await postingManagerService.markAsPosted({
        analysisId: id!,
        postedUrl,
        keepInQueue,
      });

      if (keepInQueue) {
        toast.success('Post recorded! Project stays in queue for more platforms.');
        setShowPostModal(false);
        setPostedUrl('');
        setKeepInQueue(false);
        setPlatform('instagram_reel');
        setHeading('');
        setCaption('');
        setHashtags([]);
        setScheduledTime('');
      } else {
        toast.success('Marked as posted!');
        navigate('/posting/posted');
      }
    } catch (error: any) {
      console.error('Failed to mark as posted:', error);
      toast.error(error.message || 'Failed to mark as posted');
    } finally {
      setPosting(false);
    }
  };

  const handleSaveMetrics = async () => {
    try {
      setSavingMetrics(true);
      await postingManagerService.updateMetrics(id!, {
        views: parseInt(metricViews) || 0,
        likes: parseInt(metricLikes) || 0,
        comments: parseInt(metricComments) || 0,
      });
      toast.success('Metrics updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save metrics');
    } finally {
      setSavingMetrics(false);
    }
  };

  // Get stage status
  const getStageStatus = (stage: typeof STAGES[number]) => {
    const currentStage = project?.production_stage || '';
    if (stage.completedStages.includes(currentStage)) return 'completed';
    if (stage.activeStages?.includes(currentStage)) return 'active';
    return 'pending';
  };

  // Get platform display
  const getPlatformDisplay = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return { emoji: '📸', label: 'Instagram Reel' };
    if (p.includes('youtube_shorts') || p === 'youtube shorts') return { emoji: '🎬', label: 'YouTube Shorts' };
    if (p.includes('youtube')) return { emoji: '▶️', label: 'YouTube Video' };
    return { emoji: '📹', label: 'Video' };
  };

  // Get initials from name
  const getInitials = (name?: string, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email?.slice(0, 2).toUpperCase() || '??';
  };

  // Filter for edited files
  const getEditedFiles = () => {
    const editedTypes = ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'];
    return project?.production_files?.filter(
      (f) => editedTypes.some(t => f.file_type.toLowerCase().includes(t.toLowerCase())) && !f.is_deleted
    ) || [];
  };

  // Get video thumbnail
  const getVideoThumbnail = (): string | null => {
    const editedFiles = getEditedFiles();
    return editedFiles[0]?.thumbnail_url || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Project Not Found</h1>
        </div>
      </div>
    );
  }

  const editedFiles = getEditedFiles();
  const videoThumbnail = getVideoThumbnail();
  const isReadyToPost = project.production_stage === 'READY_TO_POST';
  const isPosted = project.production_stage === 'POSTED';

  return (
    <div className="pb-32">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Post Details</h1>
          <p className="text-sm text-gray-500">{project.content_id} • {project.title || 'Untitled'}</p>
        </div>
        {/* Current Profile Badge */}
        {project.profile?.name && (
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">
                {project.profile.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-green-700">{project.profile.name}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Reference Link - Styled like prototype */}
      {project.reference_url && (
        <motion.a
          href={project.reference_url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl mb-4"
        >
          <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center text-2xl flex-shrink-0">
            📸
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 uppercase">Reference Video</p>
            <p className="text-sm font-medium text-gray-800 truncate">
              {project.creator_name || 'Original Viral Video'}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </motion.a>
      )}

      {/* Stage Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-100 p-4 mb-4"
      >
        <div className="flex justify-between">
          {STAGES.map((stage, index) => {
            const status = getStageStatus(stage);
            return (
              <div key={stage.id} className="flex flex-col items-center flex-1 relative">
                {index < STAGES.length - 1 && (
                  <div
                    className={`absolute top-3 left-[60%] w-[80%] h-0.5 ${
                      status === 'completed' ? 'bg-green-500' :
                      status === 'active' ? 'bg-gradient-to-r from-green-500 to-gray-200' :
                      'bg-gray-200'
                    }`}
                  />
                )}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium z-10 ${
                    status === 'completed' ? 'bg-green-500 text-white' :
                    status === 'active' ? 'bg-cyan-500 text-white ring-4 ring-cyan-100' :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {status === 'completed' ? '✓' : index + 1}
                </div>
                <span className={`text-[10px] mt-1 ${
                  status === 'completed' || status === 'active' ? 'text-gray-700 font-medium' : 'text-gray-400'
                }`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Edited Videos Download */}
      {editedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-gray-100 p-4 mb-4"
        >
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <span>✅</span> Edited Videos
          </h3>
          <div className="space-y-2">
            {editedFiles.map((file) => (
              <a
                key={file.id}
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-green-50 rounded-lg hover:bg-green-100"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Play className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.file_size || 0) / 1024 / 1024 > 1
                      ? `${((file.file_size || 0) / 1024 / 1024).toFixed(1)} MB`
                      : `${((file.file_size || 0) / 1024).toFixed(0)} KB`}
                  </p>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </a>
            ))}
          </div>
        </motion.div>
      )}

      {/* Posting Section (for READY_TO_POST stage) */}
      {isReadyToPost && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-100 p-4 mb-4"
        >
          <button
            onClick={() => setShowPostingSection(!showPostingSection)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
              <span>📤</span> Posting Details
            </h3>
            <span className="text-sm text-cyan-600 font-medium">
              {showPostingSection ? 'Hide' : 'Configure'}
            </span>
          </button>

          {showPostingSection && (
            <div className="mt-4 space-y-4">
              {/* Platform Selection - Cards style like prototype */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                <div className="space-y-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        platform === p.id
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${p.bgColor} flex items-center justify-center text-lg`}>
                        {p.emoji}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                        <p className="text-xs text-gray-500">
                          {p.id === 'instagram_reel' ? 'Reel' : p.id === 'youtube_shorts' ? 'Short form video' : 'Short video'}
                        </p>
                      </div>
                      {platform === p.id && (
                        <Check className="w-5 h-5 text-cyan-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Selection */}
              {profiles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Posting Profile
                    {project?.profile?.name && selectedProfileId !== project.profile_id && (
                      <span className="ml-2 text-xs text-orange-600">
                        (Originally: {project.profile.name})
                      </span>
                    )}
                  </label>
                  <div className="space-y-2">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                          selectedProfileId === profile.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
                          {profile.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
                          <p className="text-xs text-gray-500">
                            {profile.id === project?.profile_id ? 'Originally assigned' : 'Switch to this profile'}
                          </p>
                        </div>
                        {selectedProfileId === profile.id && (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedProfileId !== project?.profile_id && (
                    <div className="mt-2 p-2 bg-orange-50 rounded-lg flex items-start gap-2">
                      <span className="text-orange-600 text-xs">⚠️</span>
                      <p className="text-xs text-orange-700">
                        Profile changed from <strong>{project?.profile?.name}</strong>. Save to confirm.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Heading */}
              {['youtube_shorts', 'youtube_long', 'tiktok'].includes(platform) && (
                <Input
                  label="Heading / Title"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="Video title..."
                />
              )}

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caption</label>
                <textarea
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:outline-none text-sm min-h-[100px]"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write an engaging caption..."
                />
              </div>

              {/* Hashtags - Pill style like prototype */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hashtags</label>
                <div
                  className="flex flex-wrap gap-2 p-3 border-2 border-gray-200 rounded-xl min-h-[52px] cursor-text"
                  onClick={() => hashtagInputRef.current?.focus()}
                >
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-500 text-white rounded-full text-sm"
                    >
                      #{tag}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveHashtag(tag);
                        }}
                        className="hover:bg-cyan-600 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={hashtagInputRef}
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={handleHashtagKeyDown}
                    onBlur={handleAddHashtag}
                    placeholder={hashtags.length === 0 ? 'Add hashtags...' : ''}
                    className="flex-1 min-w-[100px] border-none outline-none text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Press Enter or Space to add</p>
              </div>

              {/* Schedule with best time hint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule (Optional)
                </label>
                <input
                  type="datetime-local"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:outline-none text-sm"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
                {/* Best time hint */}
                <div className="flex items-center gap-2 mt-2 p-2 bg-cyan-50 rounded-lg">
                  <Clock className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                  <p className="text-xs text-cyan-700">
                    Best time for engagement: <span className="font-medium">{BEST_POSTING_TIMES[platform] || '2PM - 4PM'}</span>
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <Button
                fullWidth
                variant="outline"
                onClick={handleSaveDetails}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Assigned Team */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white rounded-xl border border-gray-100 p-4 mb-4"
      >
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
          <span>👥</span> Assigned Team
        </h3>
        <div className="space-y-3">
          {project.full_name && (
            <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {getInitials(project.full_name, project.email)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{project.full_name}</p>
                <p className="text-xs text-gray-500">Script Writer</p>
              </div>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">Completed</span>
            </div>
          )}
          {project.videographer && (
            <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                {getInitials(project.videographer.full_name, project.videographer.email)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{project.videographer.full_name || project.videographer.email}</p>
                <p className="text-xs text-gray-500">Videographer</p>
              </div>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">Completed</span>
            </div>
          )}
          {project.editor && (
            <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-xs font-semibold">
                {getInitials(project.editor.full_name, project.editor.email)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{project.editor.full_name || project.editor.email}</p>
                <p className="text-xs text-gray-500">Editor</p>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                isReadyToPost || isPosted ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {isReadyToPost || isPosted ? 'Completed' : 'In Progress'}
              </span>
            </div>
          )}
          {project.posting_manager && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white text-xs font-semibold">
                {getInitials(project.posting_manager.full_name, project.posting_manager.email)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{project.posting_manager.full_name || project.posting_manager.email}</p>
                <p className="text-xs text-gray-500">Posting Manager</p>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                isPosted ? 'bg-green-100 text-green-700' : 'bg-cyan-100 text-cyan-700'
              }`}>
                {isPosted ? 'Completed' : 'Ready'}
              </span>
            </div>
          )}
          {!project.full_name && !project.videographer && !project.editor && !project.posting_manager && (
            <p className="text-sm text-gray-400">No team members assigned yet</p>
          )}
        </div>
      </motion.div>

      {/* Posted Info (for POSTED stage) */}
      {isPosted && project.posted_url && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-green-50 rounded-xl border border-green-200 p-4 mb-4"
        >
          <h3 className="text-xs font-semibold text-green-700 uppercase mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Posted
          </h3>
          <a
            href={project.posted_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-green-700 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            View Live Post
          </a>
          {project.posted_at && (
            <p className="text-xs text-green-600 mt-2">
              Posted on {new Date(project.posted_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
              })}
            </p>
          )}
        </motion.div>
      )}

      {/* Performance Metrics (for POSTED stage) */}
      {isPosted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-xl border border-gray-100 p-4 mb-4"
        >
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <span>📊</span> Performance Metrics
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Views</label>
              <input
                type="number"
                inputMode="numeric"
                value={metricViews}
                onChange={(e) => setMetricViews(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-center text-sm font-semibold focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Likes</label>
              <input
                type="number"
                inputMode="numeric"
                value={metricLikes}
                onChange={(e) => setMetricLikes(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-center text-sm font-semibold focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Comments</label>
              <input
                type="number"
                inputMode="numeric"
                value={metricComments}
                onChange={(e) => setMetricComments(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-center text-sm font-semibold focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
          <Button
            fullWidth
            variant="outline"
            onClick={handleSaveMetrics}
            disabled={savingMetrics}
          >
            {savingMetrics ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {savingMetrics ? 'Saving...' : 'Update Metrics'}
          </Button>
        </motion.div>
      )}

      {/* Fixed Bottom Buttons (for READY_TO_POST) */}
      {isReadyToPost && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-white via-white to-transparent pt-4 max-w-mobile mx-auto">
          <div className="flex gap-3">
            <Button
              fullWidth
              variant="outline"
              className="flex-1"
              onClick={handleSaveDetails}
              disabled={saving}
            >
              {scheduledTime ? 'Schedule Post 📅' : 'Save Draft'}
            </Button>
            <Button
              fullWidth
              size="lg"
              className="flex-[2] bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg"
              onClick={() => setShowPostModal(true)}
            >
              <CheckCircle className="w-5 h-5" />
              Mark as Posted
            </Button>
          </div>
        </div>
      )}

      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            className="bg-white rounded-t-3xl w-full max-w-mobile p-6 pb-24"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark as Posted</h3>

            <div className="space-y-4">
              <Input
                label="Posted URL"
                value={postedUrl}
                onChange={(e) => setPostedUrl(e.target.value)}
                placeholder="https://instagram.com/reel/..."
              />

              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepInQueue}
                  onChange={(e) => setKeepInQueue(e.target.checked)}
                  className="w-5 h-5 rounded text-cyan-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Post to more platforms</p>
                  <p className="text-sm text-gray-500">Keep in queue to post on other platforms</p>
                </div>
              </label>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPostModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-cyan-500"
                  onClick={handleMarkAsPosted}
                  disabled={posting}
                >
                  {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
