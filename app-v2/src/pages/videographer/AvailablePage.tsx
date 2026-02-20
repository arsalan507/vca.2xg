import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, ChevronUp, ChevronDown, Play, ExternalLink, Eye, Search, Check, PlusCircle } from 'lucide-react';
import Header from '@/components/Header';
import { videographerService } from '@/services/videographerService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'high_priority' | 'indoor' | 'outdoor';
type Profile = { id: string; name: string; code: string | null; platform?: string; is_active?: boolean };

// Helper to extract video ID and platform from URL
const getVideoEmbed = (url?: string) => {
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) {
    return {
      platform: 'youtube',
      id: ytMatch[1],
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}`,
    };
  }

  // Instagram Reel
  const igReelMatch = url.match(/instagram\.com\/reel\/([a-zA-Z0-9_-]+)/);
  if (igReelMatch) {
    return {
      platform: 'instagram',
      id: igReelMatch[1],
      embedUrl: `https://www.instagram.com/reel/${igReelMatch[1]}/embed/captioned/`,
    };
  }

  // Instagram Post
  const igPostMatch = url.match(/instagram\.com\/p\/([a-zA-Z0-9_-]+)/);
  if (igPostMatch) {
    return {
      platform: 'instagram',
      id: igPostMatch[1],
      embedUrl: `https://www.instagram.com/p/${igPostMatch[1]}/embed/captioned/`,
    };
  }

  // TikTok
  const ttMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
  if (ttMatch) {
    return {
      platform: 'tiktok',
      id: ttMatch[1],
      embedUrl: `https://www.tiktok.com/embed/v2/${ttMatch[1]}`,
    };
  }

  return null;
};

export default function AvailablePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [picking, setPicking] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Profile selection modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalProjectId, setProfileModalProjectId] = useState<string | null>(null);
  const [profileModalCloseViewer, setProfileModalCloseViewer] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Inline profile creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileCode, setNewProfileCode] = useState('');
  const [newProfilePlatform, setNewProfilePlatform] = useState('INSTAGRAM');
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Reels viewer state
  const [showReelsViewer, setShowReelsViewer] = useState(false);
  const [currentReelIndex, setCurrentReelIndex] = useState(0);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await videographerService.getAvailableProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    // Filter by type/priority
    let matchesFilter = true;
    if (filter !== 'all') {
      if (filter === 'high_priority') {
        matchesFilter = p.priority === 'URGENT' || p.priority === 'HIGH';
      } else {
        matchesFilter = p.shoot_type?.toLowerCase() === filter;
      }
    }
    if (!matchesFilter) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = p.title?.toLowerCase().includes(query);
      const matchesId = p.content_id?.toLowerCase().includes(query);
      const matchesProfile = p.profile?.name?.toLowerCase().includes(query);
      const matchesAuthor = p.full_name?.toLowerCase().includes(query) || p.email?.toLowerCase().includes(query);
      return matchesTitle || matchesId || matchesProfile || matchesAuthor;
    }

    return true;
  });

  const counts = {
    all: projects.length,
    high_priority: projects.filter((p) => p.priority === 'URGENT' || p.priority === 'HIGH').length,
    indoor: projects.filter((p) => p.shoot_type?.toLowerCase() === 'indoor').length,
    outdoor: projects.filter((p) => p.shoot_type?.toLowerCase() === 'outdoor').length,
  };

  // Get category emoji based on title/industry
  const getCategoryEmoji = (project: ViralAnalysis) => {
    const title = (project.title || '').toLowerCase();
    if (title.includes('fitness') || title.includes('gym') || title.includes('workout')) return '🏋️';
    if (title.includes('food') || title.includes('recipe') || title.includes('cook')) return '🍳';
    if (title.includes('coffee') || title.includes('cafe')) return '☕';
    if (title.includes('office') || title.includes('work')) return '👨‍💼';
    if (title.includes('home') || title.includes('decor') || title.includes('diy')) return '🏠';
    if (title.includes('travel') || title.includes('outdoor') || title.includes('street')) return '🌳';
    if (title.includes('tech') || title.includes('gadget')) return '📱';
    if (title.includes('fashion') || title.includes('style')) return '👗';
    if (title.includes('music') || title.includes('dance')) return '🎵';
    return '🎬';
  };

  // Get shoot type info
  const getShootTypeInfo = (shootType?: string) => {
    const type = (shootType || 'indoor').toLowerCase();
    if (type.includes('outdoor')) return { emoji: '🌳', label: 'Outdoor', bg: 'rgba(34, 197, 94, 0.1)' };
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

  // Get priority badge
  const getPriorityBadge = (priority?: string) => {
    if (priority === 'URGENT') return { label: '🔥 Urgent', bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' };
    if (priority === 'HIGH') return { label: '🔥 High', bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' };
    return { label: '📌 Normal', bg: 'rgba(156, 163, 175, 0.1)', color: '#6b7280' };
  };

  const openProfileModal = async (projectId: string, closeViewer = false) => {
    setProfileModalProjectId(projectId);
    setProfileModalCloseViewer(closeViewer);
    setSelectedProfileId(null);
    setShowProfileModal(true);

    // Load profiles if not already loaded
    if (profiles.length === 0) {
      setProfilesLoading(true);
      try {
        const data = await videographerService.getProfiles();
        setProfiles(data);
      } catch (error) {
        console.error('Failed to load profiles:', error);
        toast.error('Failed to load profiles');
      } finally {
        setProfilesLoading(false);
      }
    }
  };

  const handlePickWithProfile = async (profileId?: string) => {
    if (!profileModalProjectId) return;
    const projectId = profileModalProjectId;
    const closeViewer = profileModalCloseViewer;
    setShowProfileModal(false);

    try {
      setPicking(projectId);
      await videographerService.pickProject({
        analysisId: projectId,
        profileId: profileId || undefined,
      });
      toast.success('Project picked successfully!');
      if (closeViewer) setShowReelsViewer(false);
      navigate(`/videographer/project/${projectId}`);
    } catch (error: any) {
      console.error('Failed to pick project:', error);
      const errorMsg = error.message || 'Failed to pick project';
      toast.error(errorMsg);

      if (errorMsg.includes('already been picked') || errorMsg.includes('no longer available')) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        if (showReelsViewer && currentReelIndex >= filteredProjects.length - 1) {
          setCurrentReelIndex(Math.max(0, currentReelIndex - 1));
        }
      }
      setPicking(null);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim() || !newProfileCode.trim()) {
      toast.error('Name and Code are required');
      return;
    }

    if (newProfileCode.length < 2 || newProfileCode.length > 4) {
      toast.error('Code must be 2-4 characters');
      return;
    }

    try {
      setCreatingProfile(true);
      const created = await videographerService.createProfile(
        newProfileName.trim(),
        newProfileCode.trim(),
        newProfilePlatform
      );
      toast.success(`Profile "${created.name}" created!`);

      // Refresh profiles list
      const updatedProfiles = await videographerService.getProfiles();
      setProfiles(updatedProfiles);

      // Select the newly created profile
      setSelectedProfileId(created.id);

      // Reset form and hide it
      setNewProfileName('');
      setNewProfileCode('');
      setNewProfilePlatform('INSTAGRAM');
      setShowCreateForm(false);
    } catch (error: any) {
      console.error('Failed to create profile:', error);
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleReject = async (projectId: string, inViewer = false) => {
    await videographerService.rejectProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    toast.success('Project skipped');

    // Handle navigation in reels viewer
    if (inViewer) {
      const newFilteredLength = filteredProjects.length - 1;
      if (currentReelIndex >= newFilteredLength) {
        setCurrentReelIndex(Math.max(0, newFilteredLength - 1));
      }
      if (newFilteredLength === 0) {
        setShowReelsViewer(false);
      }
    }
  };

  // Open reels viewer at specific index
  const openReelsViewer = (index: number) => {
    setCurrentReelIndex(index);
    setShowReelsViewer(true);
  };

  // Navigate reels
  const goToNextReel = useCallback(() => {
    if (currentReelIndex < filteredProjects.length - 1) {
      setCurrentReelIndex((prev) => prev + 1);
    }
  }, [currentReelIndex, filteredProjects.length]);

  const goToPrevReel = useCallback(() => {
    if (currentReelIndex > 0) {
      setCurrentReelIndex((prev) => prev - 1);
    }
  }, [currentReelIndex]);

  // Keyboard navigation for reels
  useEffect(() => {
    if (!showReelsViewer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        goToNextReel();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        goToPrevReel();
      } else if (e.key === 'Escape') {
        setShowReelsViewer(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReelsViewer, goToNextReel, goToPrevReel]);

  // Lock body scroll when reels viewer is open
  useEffect(() => {
    if (showReelsViewer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showReelsViewer]);

  // Current project in reels viewer
  const currentProject = filteredProjects[currentReelIndex];

  if (loading) {
    return (
      <>
        <Header title="Available Projects" showBack />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Available Projects" subtitle={`${filteredProjects.length} projects ready for shooting`} showBack />

      <div className="px-4 py-4">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, profile, ID, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            aria-label="Search projects"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 mb-2">
          {[
            { id: 'all' as FilterType, label: 'All' },
            { id: 'high_priority' as FilterType, label: 'High Priority' },
            { id: 'indoor' as FilterType, label: 'Indoor' },
            { id: 'outdoor' as FilterType, label: 'Outdoor' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                filter === tab.id ? 'bg-white/20' : 'bg-gray-200'
              }`}>
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Swipe Hint */}
        <p className="text-center text-xs text-gray-400 mb-4">
          ← Swipe left to skip • Swipe right to pick →
        </p>

        {/* Project Cards */}
        <div className="space-y-3">
          {filteredProjects.map((project, index) => {
            const categoryEmoji = getCategoryEmoji(project);
            const shootType = getShootTypeInfo(project.shoot_type);
            const platform = getPlatformInfo(project.platform);
            const priority = getPriorityBadge(project.priority);
            const authorName = project.full_name || project.email?.split('@')[0] || 'Unknown';

            return (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="p-4">
                  {/* Project Header with Thumbnail */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: shootType.bg }}
                    >
                      {categoryEmoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
                      <p className="text-sm text-gray-500 mb-1">
                        {project.profile?.name ? (
                          <>
                            <span className="font-medium text-orange-600">🎯 {project.profile.name}</span>
                            {' • '}
                          </>
                        ) : null}
                        <span className="text-gray-400">Script by {authorName}</span>
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {project.content_id || 'No ID yet'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {platform.emoji} {platform.label}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {shootType.emoji} {shootType.label}
                        </span>
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: priority.bg, color: priority.color }}
                        >
                          {priority.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openReelsViewer(index)}
                      className="h-10 px-4 flex items-center justify-center gap-1.5 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 active:bg-gray-200"
                      aria-label={`View reference video for ${project.title || 'project'}`}
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                      View
                    </button>
                    <button
                      onClick={() => handleReject(project.id)}
                      className="h-10 px-4 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 active:bg-gray-50"
                      aria-label={`Skip ${project.title || 'project'}`}
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => openProfileModal(project.id)}
                      disabled={picking === project.id}
                      className="flex-1 h-10 flex items-center justify-center gap-2 bg-green-500 rounded-lg text-sm font-medium text-white active:bg-green-600 disabled:opacity-50"
                      aria-label={`Pick ${project.title || 'project'} for shooting`}
                      aria-busy={picking === project.id}
                    >
                      {picking === project.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pick Project'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Projects Available</h3>
            <p className="text-gray-500 text-sm">Check back later for new projects</p>
          </div>
        )}
      </div>

      {/* Reels Viewer Modal - rendered via portal to be above everything */}
      {showReelsViewer && currentProject && createPortal(
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col" role="dialog" aria-modal="true" aria-label="Reference video viewer">
          {/* Close Button */}
          <button
            onClick={() => setShowReelsViewer(false)}
            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
            aria-label="Close video viewer"
          >
            <X className="w-6 h-6 text-white" aria-hidden="true" />
          </button>

          {/* Navigation Arrows */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            <button
              onClick={goToPrevReel}
              disabled={currentReelIndex === 0}
              className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center disabled:opacity-30"
              aria-label="Previous project"
            >
              <ChevronUp className="w-6 h-6 text-white" aria-hidden="true" />
            </button>
            <button
              onClick={goToNextReel}
              disabled={currentReelIndex === filteredProjects.length - 1}
              className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center disabled:opacity-30"
              aria-label="Next project"
            >
              <ChevronDown className="w-6 h-6 text-white" aria-hidden="true" />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full bg-black/50 text-white text-sm">
            {currentReelIndex + 1} / {filteredProjects.length}
          </div>

          {/* Video Content Area */}
          <div className="flex-1 flex items-center justify-center overflow-hidden pb-48">
            {(() => {
              const videoEmbed = getVideoEmbed(currentProject.reference_url);

              // For YouTube - embed works great
              if (videoEmbed?.platform === 'youtube') {
                return (
                  <div className="w-full h-full max-w-md mx-auto flex items-center justify-center px-4">
                    <iframe
                      key={currentProject.id}
                      src={videoEmbed.embedUrl}
                      className="w-full aspect-[9/16] max-h-[60vh] rounded-xl"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                );
              }

              // For Instagram - embed the reel/post
              if (videoEmbed?.platform === 'instagram') {
                return (
                  <div className="w-full h-full max-w-md mx-auto flex items-center justify-center px-4">
                    <iframe
                      key={currentProject.id}
                      src={videoEmbed.embedUrl}
                      className="w-full aspect-[9/16] max-h-[60vh] rounded-xl bg-white"
                      allowFullScreen
                      scrolling="no"
                    />
                  </div>
                );
              }

              // For TikTok - embed the video
              if (videoEmbed?.platform === 'tiktok') {
                return (
                  <div className="w-full h-full max-w-md mx-auto flex items-center justify-center px-4">
                    <iframe
                      key={currentProject.id}
                      src={videoEmbed.embedUrl}
                      className="w-full aspect-[9/16] max-h-[60vh] rounded-xl"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                );
              }

              // For other URLs - show open button
              if (currentProject.reference_url) {
                return (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <a
                      href={currentProject.reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center mb-6 shadow-2xl"
                    >
                      <Play className="w-14 h-14 text-white ml-2" fill="white" />
                    </a>
                    <a
                      href={currentProject.reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 rounded-full text-white font-medium"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Open Video
                    </a>
                  </div>
                );
              }

              // No video URL
              return (
                <div className="text-center p-8">
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6 mx-auto">
                    <Play className="w-12 h-12 text-white/30" />
                  </div>
                  <p className="text-white/50 text-lg">No reference video</p>
                </div>
              );
            })()}
          </div>

          {/* Project Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent pt-16">
            <div className="px-4 pb-8">
              {/* Title and Profile */}
              <h2 className="text-xl font-bold text-white mb-1">
                {currentProject.title || 'Untitled'}
              </h2>
              {currentProject.profile?.name && (
                <p className="text-orange-400 text-base font-semibold mb-1">
                  🎯 {currentProject.profile.name}
                </p>
              )}
              <p className="text-white/60 text-sm mb-3">
                <span className="font-mono">{currentProject.content_id || 'No ID yet'}</span>
                {' • '}
                <span>Script by {currentProject.full_name || currentProject.email?.split('@')[0] || 'Unknown'}</span>
              </p>

              {/* Tags */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="px-3 py-1.5 bg-white/20 rounded-full text-white text-sm">
                  {getPlatformInfo(currentProject.platform).emoji} {getPlatformInfo(currentProject.platform).label}
                </span>
                <span className="px-3 py-1.5 bg-white/20 rounded-full text-white text-sm">
                  {getShootTypeInfo(currentProject.shoot_type).emoji} {getShootTypeInfo(currentProject.shoot_type).label}
                </span>
                {(currentProject.priority === 'URGENT' || currentProject.priority === 'HIGH') && (
                  <span className="px-3 py-1.5 bg-red-500/30 rounded-full text-red-300 text-sm">
                    🔥 {currentProject.priority === 'URGENT' ? 'Urgent' : 'High Priority'}
                  </span>
                )}
              </div>

              {/* Why Viral */}
              {currentProject.why_viral && (
                <div className="mb-3">
                  <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Why It's Viral</p>
                  <p className="text-white text-sm line-clamp-2">{currentProject.why_viral}</p>
                </div>
              )}

              {/* How to Replicate */}
              {currentProject.how_to_replicate && (
                <div className="mb-4">
                  <p className="text-white/50 text-xs uppercase tracking-wide mb-1">How to Replicate</p>
                  <p className="text-white text-sm line-clamp-3">{currentProject.how_to_replicate}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleReject(currentProject.id, true)}
                  className="flex-1 h-12 flex items-center justify-center bg-white/10 border border-white/20 rounded-xl text-white font-medium active:bg-white/20"
                >
                  Skip
                </button>
                <button
                  onClick={() => openProfileModal(currentProject.id, true)}
                  disabled={picking === currentProject.id}
                  className="flex-[2] h-12 flex items-center justify-center gap-2 bg-green-500 rounded-xl text-white font-medium active:bg-green-600 disabled:opacity-50"
                >
                  {picking === currentProject.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Pick This Project'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Profile Selection Modal */}
      {showProfileModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-end sm:items-center justify-center" onClick={() => setShowProfileModal(false)}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Profile</h3>
                <p className="text-sm text-gray-500">Choose which profile this content is for</p>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Profile List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {profilesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              ) : profiles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No profiles available</p>
                </div>
              ) : (
                profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileId(selectedProfileId === profile.id ? null : profile.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                      selectedProfileId === profile.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-100 bg-white active:bg-gray-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                      selectedProfileId === profile.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100'
                    }`}>
                      {selectedProfileId === profile.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        profile.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${
                          selectedProfileId === profile.id ? 'text-orange-700' : 'text-gray-800'
                        }`}>
                          {profile.name}
                        </span>
                        {profile.code && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded font-mono">
                            {profile.code}
                          </span>
                        )}
                      </div>
                      {profile.platform && (
                        <span className="text-xs text-gray-400">{profile.platform}</span>
                      )}
                    </div>
                  </button>
                ))
              )}

              {/* Create New Profile Button */}
              {!showCreateForm && !profilesLoading && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span className="font-medium text-sm">Create New Profile</span>
                </button>
              )}

              {/* Inline Create Profile Form */}
              {showCreateForm && (
                <div className="p-4 border-2 border-orange-200 rounded-xl bg-orange-50 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-900">New Profile</h4>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewProfileName('');
                        setNewProfileCode('');
                        setNewProfilePlatform('INSTAGRAM');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Profile Name</label>
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="e.g., BCH Main, Next.blr"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Code (2-4 letters)</label>
                    <input
                      type="text"
                      value={newProfileCode}
                      onChange={(e) => setNewProfileCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="e.g., BCH, NEXT, 2nd"
                      maxLength={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                    <select
                      value={newProfilePlatform}
                      onChange={(e) => setNewProfilePlatform(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="INSTAGRAM">Instagram</option>
                      <option value="YOUTUBE">YouTube</option>
                      <option value="TIKTOK">TikTok</option>
                      <option value="FACEBOOK">Facebook</option>
                    </select>
                  </div>

                  <button
                    onClick={handleCreateProfile}
                    disabled={creatingProfile || !newProfileName.trim() || !newProfileCode.trim()}
                    className="w-full h-10 flex items-center justify-center gap-2 bg-orange-500 rounded-lg text-white text-sm font-semibold active:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {creatingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        Create Profile
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              <button
                onClick={() => handlePickWithProfile(selectedProfileId || undefined)}
                disabled={!selectedProfileId}
                className="w-full h-12 flex items-center justify-center gap-2 bg-green-500 rounded-xl text-white font-semibold active:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Pick with Selected Profile
              </button>
              <button
                onClick={() => handlePickWithProfile()}
                className="w-full h-10 flex items-center justify-center text-sm text-gray-500 font-medium active:text-gray-700"
              >
                Pick without profile
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
