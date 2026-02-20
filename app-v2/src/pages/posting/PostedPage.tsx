import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, RefreshCw, Loader2, ExternalLink, Play, Eye, Heart, MessageCircle, TrendingUp } from 'lucide-react';
import { postingManagerService } from '@/services/postingManagerService';
import type { ViralAnalysis } from '@/types';

type PlatformFilter = 'all' | 'instagram' | 'youtube_shorts' | 'youtube_long';

interface PostedStats {
  totalViews: number;
  totalPosts: number;
  avgEngagement: number;
}

export default function PostedPage() {
  const navigate = useNavigate();
  const [postedProjects, setPostedProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('all');

  useEffect(() => {
    loadPostedProjects();
  }, []);

  const loadPostedProjects = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const projects = await postingManagerService.getPostedProjects(100);
      setPostedProjects(projects);
    } catch (error) {
      console.error('Failed to load posted projects:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStats = (): PostedStats => {
    const totalViews = postedProjects.reduce((sum, p) => sum + (p.post_views || 0), 0);
    const totalLikes = postedProjects.reduce((sum, p) => sum + (p.post_likes || 0), 0);
    const totalComments = postedProjects.reduce((sum, p) => sum + (p.post_comments || 0), 0);
    return {
      totalViews,
      totalPosts: postedProjects.length,
      avgEngagement: totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
    };
  };

  // Get filtered projects by platform
  const getFilteredProjects = (): ViralAnalysis[] => {
    if (selectedPlatform === 'all') return postedProjects;

    return postedProjects.filter((project) => {
      const platform = (project.posting_platform || project.platform || '').toLowerCase();
      switch (selectedPlatform) {
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
  };

  // Get platform counts
  const getPlatformCounts = () => {
    let all = postedProjects.length;
    let instagram = 0;
    let youtubeShorts = 0;
    let youtubeLong = 0;

    postedProjects.forEach((project) => {
      const platform = (project.posting_platform || project.platform || '').toLowerCase();
      if (platform.includes('instagram')) instagram++;
      else if (platform.includes('youtube_shorts') || platform === 'youtube shorts') youtubeShorts++;
      else if (platform.includes('youtube_video') || platform.includes('youtube_long')) youtubeLong++;
    });

    return { all, instagram, youtubeShorts, youtubeLong };
  };

  // Format posted date
  const formatPostedDate = (dateStr?: string): string => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return `Posted ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })} at ${date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })}`;
  };

  // Get platform display
  const getPlatformDisplay = (platform?: string): { emoji: string; label: string } => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return { emoji: '📸', label: 'Instagram Reel' };
    if (p.includes('youtube_shorts') || p === 'youtube shorts') return { emoji: '🎬', label: 'YouTube Shorts' };
    if (p.includes('youtube')) return { emoji: '▶️', label: 'YouTube Video' };
    if (p.includes('tiktok')) return { emoji: '🎵', label: 'TikTok' };
    return { emoji: '📹', label: 'Video' };
  };

  // Format number with K/M suffix
  const formatNumber = (num?: number): string => {
    if (!num || num === 0) return '--';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const stats = getStats();
  const filteredProjects = getFilteredProjects();
  const platformCounts = getPlatformCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Posted Content</h1>
            <p className="text-sm text-gray-500">{postedProjects.length} videos posted</p>
          </div>
        </div>
        <button
          onClick={() => loadPostedProjects(true)}
          disabled={refreshing}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3 mb-4"
      >
        {/* Total Views - Blue Gradient */}
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-4 text-center shadow-md">
          <Eye className="w-5 h-5 text-white/80 mx-auto mb-1.5" />
          <div className="text-xl font-bold text-white">
            {stats.totalViews > 0 ? formatNumber(stats.totalViews) : '--'}
          </div>
          <div className="text-[10px] text-white/80 uppercase font-medium">Total Views</div>
        </div>

        {/* Posted - Purple Gradient */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-center shadow-md">
          <Play className="w-5 h-5 text-white/80 mx-auto mb-1.5" />
          <div className="text-xl font-bold text-white">{stats.totalPosts}</div>
          <div className="text-[10px] text-white/80 uppercase font-medium">Posted</div>
        </div>

        {/* Engagement - Green Gradient */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-4 text-center shadow-md">
          <TrendingUp className="w-5 h-5 text-white/80 mx-auto mb-1.5" />
          <div className="text-xl font-bold text-white">
            {stats.avgEngagement > 0 ? `${stats.avgEngagement.toFixed(1)}%` : '--'}
          </div>
          <div className="text-[10px] text-white/80 uppercase font-medium">Avg Engage</div>
        </div>
      </motion.div>

      {/* Platform Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 mb-6"
      >
        <button
          onClick={() => setSelectedPlatform('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            selectedPlatform === 'all'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          All
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${selectedPlatform === 'all' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {platformCounts.all}
          </span>
        </button>
        <button
          onClick={() => setSelectedPlatform('instagram')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            selectedPlatform === 'instagram'
              ? 'bg-pink-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Instagram
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${selectedPlatform === 'instagram' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {platformCounts.instagram}
          </span>
        </button>
        <button
          onClick={() => setSelectedPlatform('youtube_shorts')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            selectedPlatform === 'youtube_shorts'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          YT Shorts
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${selectedPlatform === 'youtube_shorts' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {platformCounts.youtubeShorts}
          </span>
        </button>
        <button
          onClick={() => setSelectedPlatform('youtube_long')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            selectedPlatform === 'youtube_long'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          YT Long
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${selectedPlatform === 'youtube_long' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {platformCounts.youtubeLong}
          </span>
        </button>
      </motion.div>

      {/* Posted Content List */}
      {filteredProjects.length > 0 ? (
        <div className="space-y-4">
          {filteredProjects.map((project, index) => {
            const platformDisplay = getPlatformDisplay(project.posting_platform || project.platform);
            const profileName = project.profile?.name;

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.03 }}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-3 p-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-20 rounded-lg bg-gray-800 flex items-center justify-center text-white shrink-0">
                    <Play className="w-6 h-6" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate text-sm">
                      {project.title || 'Untitled'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {project.content_id || 'No ID'} • {platformDisplay.emoji} {platformDisplay.label}
                    </p>
                    {profileName && (
                      <div className="mt-1.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                          {profileName}
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {formatPostedDate(project.posted_at)}
                    </p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-100">
                  <div className="flex-1 py-3 text-center">
                    <Eye className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
                    <div className="text-sm font-bold text-gray-800">{formatNumber(project.post_views)}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Views</div>
                  </div>
                  <div className="flex-1 py-3 text-center border-l border-gray-200">
                    <Heart className="w-3.5 h-3.5 text-pink-500 mx-auto mb-1" />
                    <div className="text-sm font-bold text-gray-800">{formatNumber(project.post_likes)}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Likes</div>
                  </div>
                  <div className="flex-1 py-3 text-center border-l border-gray-200">
                    <MessageCircle className="w-3.5 h-3.5 text-green-500 mx-auto mb-1" />
                    <div className="text-sm font-bold text-gray-800">{formatNumber(project.post_comments)}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Comments</div>
                  </div>
                  <div className="flex-1 py-3 text-center border-l border-gray-200">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-500 mx-auto mb-1" />
                    <div className="text-sm font-bold text-gray-800">
                      {(project.post_views || 0) > 0
                        ? `${((((project.post_likes || 0) + (project.post_comments || 0)) / project.post_views!) * 100).toFixed(1)}%`
                        : '--'}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">Engage</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  {project.posted_url ? (
                    <a
                      href={project.posted_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-purple-600 font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Post
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">No link available</span>
                  )}
                  <Link
                    to={`/posting/post/${project.id}`}
                    className="text-xs text-purple-600 font-medium"
                  >
                    View Details →
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="text-5xl mb-4">📤</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Posted Content</h3>
          <p className="text-gray-500 text-sm">
            {selectedPlatform !== 'all'
              ? 'No posts match this filter'
              : 'Content will appear here after being marked as posted'}
          </p>
        </motion.div>
      )}
    </div>
  );
}
