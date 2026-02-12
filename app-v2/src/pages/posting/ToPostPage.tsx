import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Loader2, Play, Eye } from 'lucide-react';
import Header from '@/components/Header';
import { postingManagerService } from '@/services/postingManagerService';
import { videographerService } from '@/services/videographerService';
import type { ViralAnalysis } from '@/types';
import { ProfilePlatformIcons } from '@/types';
import toast from 'react-hot-toast';

type PlatformFilter = 'all' | 'instagram' | 'youtube_shorts' | 'youtube_long';

interface Profile {
  id: string;
  name: string;
  platform?: string;
}

export default function ToPostPage() {
  const [projects, setProjects] = useState<ViralAnalysis[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, profilesData] = await Promise.all([
        postingManagerService.getReadyToPostProjects(),
        videographerService.getProfiles(),
      ]);
      setProjects(projectsData);
      setProfiles(profilesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Filter by profile
  const profileFilteredProjects = projects.filter((p) => {
    if (selectedProfile === 'all') return true;
    return p.profile_id === selectedProfile;
  });

  // Filter by platform
  const filteredProjects = profileFilteredProjects.filter((p) => {
    if (platformFilter === 'all') return true;
    const platform = (p.posting_platform || p.platform || '').toLowerCase();
    switch (platformFilter) {
      case 'instagram':
        return platform.includes('instagram');
      case 'youtube_shorts':
        return platform.includes('youtube_shorts') || platform === 'youtube shorts';
      case 'youtube_long':
        return platform.includes('youtube_video') || platform.includes('youtube_long');
      default:
        return true;
    }
  });

  // Get platform counts
  const platformCounts = {
    all: profileFilteredProjects.length,
    instagram: profileFilteredProjects.filter((p) => {
      const platform = (p.posting_platform || p.platform || '').toLowerCase();
      return platform.includes('instagram');
    }).length,
    youtube_shorts: profileFilteredProjects.filter((p) => {
      const platform = (p.posting_platform || p.platform || '').toLowerCase();
      return platform.includes('youtube_shorts') || platform === 'youtube shorts';
    }).length,
    youtube_long: profileFilteredProjects.filter((p) => {
      const platform = (p.posting_platform || p.platform || '').toLowerCase();
      return platform.includes('youtube_video') || platform.includes('youtube_long');
    }).length,
  };

  const getPlatformIcon = (platform?: string): { emoji: string; label: string } => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return { emoji: '📸', label: 'Instagram' };
    if (p.includes('youtube_shorts') || p === 'youtube shorts') return { emoji: '🎬', label: 'YouTube Shorts' };
    if (p.includes('youtube')) return { emoji: '▶️', label: 'YouTube Long' };
    if (p.includes('tiktok')) return { emoji: '🎵', label: 'TikTok' };
    return { emoji: '📹', label: 'Video' };
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVideoThumbnail = (project: ViralAnalysis): string | null => {
    // Try to find an edited video with thumbnail
    const editedTypes = ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'];
    const editedFile = project.production_files?.find(
      (f: any) => editedTypes.some(t => f.file_type?.toLowerCase().includes(t.toLowerCase())) && !f.is_deleted
    );
    return editedFile?.thumbnail_url || null;
  };

  if (loading) {
    return (
      <>
        <Header title="Ready to Post" showBack />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Ready to Post" subtitle={`${filteredProjects.length} videos`} showBack />

      <div className="px-4 py-4">
        {/* Profile Filter Chips */}
        {profiles.length > 0 && (
          <div className="mb-4 animate-fade-in">
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <span>📁</span> Filter by Profile
            </p>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2">
              <button
                onClick={() => setSelectedProfile('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                  selectedProfile === 'all'
                    ? 'bg-cyan-500 border-cyan-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-cyan-300'
                }`}
              >
                All Profiles
              </button>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedProfile(profile.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                    selectedProfile === profile.id
                      ? 'bg-cyan-500 border-cyan-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-cyan-300'
                  }`}
                >
                  {ProfilePlatformIcons[profile.platform as keyof typeof ProfilePlatformIcons] || '📁'} {profile.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Platform Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 mb-4 animate-fade-in">
          {[
            { id: 'all' as PlatformFilter, label: 'All', count: platformCounts.all },
            { id: 'instagram' as PlatformFilter, label: 'Instagram', count: platformCounts.instagram },
            { id: 'youtube_shorts' as PlatformFilter, label: 'YT Shorts', count: platformCounts.youtube_shorts },
            { id: 'youtube_long' as PlatformFilter, label: 'YT Long', count: platformCounts.youtube_long },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPlatformFilter(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                platformFilter === tab.id
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                platformFilter === tab.id ? 'bg-white/20' : 'bg-gray-200'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Project List */}
        <div className="space-y-3">
          {filteredProjects.map((project, index) => {
            const platform = getPlatformIcon(project.posting_platform || project.platform);
            const thumbnail = getVideoThumbnail(project);
            const isScheduled = !!project.scheduled_post_time;

            return (
              <div
                key={project.id}
                className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-3">
                  {/* Video Preview Thumbnail */}
                  <div className="w-[60px] h-[80px] rounded-lg bg-gray-800 flex items-center justify-center text-white text-xl flex-shrink-0 overflow-hidden relative">
                    {thumbnail ? (
                      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-3 h-3 text-gray-800 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
                        <p className="text-xs text-gray-500 font-mono">
                          {project.content_id || 'No ID'}
                          {project.editor && ` • Edited by ${project.editor.full_name?.split(' ')[0] || 'Editor'}`}
                        </p>
                      </div>
                    </div>

                    {/* Profile Badge */}
                    {project.profile?.name && (
                      <p className="text-xs text-cyan-600 font-medium mt-1">
                        {project.profile.name}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                        {platform.emoji} {platform.label}
                      </span>
                      {project.video_duration && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                          {formatDuration(project.video_duration)}
                        </span>
                      )}
                      {isScheduled && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 rounded text-blue-700 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.scheduled_post_time!).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Dual buttons like prototype */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                  <Link
                    to={`/posting/post/${project.id}?preview=true`}
                    className="flex-1 py-2.5 bg-white border-2 border-gray-200 text-gray-700 text-sm font-semibold rounded-lg text-center active:bg-gray-50 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </Link>
                  <Link
                    to={`/posting/post/${project.id}`}
                    className="flex-[2] py-2.5 bg-cyan-500 text-white text-sm font-semibold rounded-lg text-center active:bg-cyan-600"
                  >
                    Post Now
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Content Ready</h3>
            <p className="text-gray-500 text-sm">
              {selectedProfile !== 'all' || platformFilter !== 'all'
                ? 'No videos match your filters'
                : 'Videos ready to post will appear here'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
