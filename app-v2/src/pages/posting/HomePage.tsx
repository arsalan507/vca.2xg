import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Send, CheckCircle, Loader2, Clock, ChevronRight, Settings, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { postingManagerService, type PostingStats } from '@/services/postingManagerService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

export default function PostingHomePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<PostingStats>({
    readyToPost: 0,
    scheduledToday: 0,
    postedThisWeek: 0,
    postedThisMonth: 0,
  });
  const [readyProjects, setReadyProjects] = useState<ViralAnalysis[]>([]);
  const [todaysSchedule, setTodaysSchedule] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user's name for personalized greeting
  const fullName = (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'Posting Manager';
  const firstName = fullName.split(' ')[0];
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to logout');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get today's date range
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const [statsData, projectsData, scheduledData] = await Promise.all([
        postingManagerService.getPostingStats(),
        postingManagerService.getReadyToPostProjects(),
        postingManagerService.getScheduledPosts(startOfDay, endOfDay),
      ]);

      setStats(statsData);
      setReadyProjects(projectsData);
      setTodaysSchedule(scheduledData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform?: string): { emoji: string; color: string } => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return { emoji: '📸', color: '#E1306C' };
    if (p.includes('youtube_shorts') || p === 'youtube shorts') return { emoji: '🎬', color: '#FF0000' };
    if (p.includes('youtube')) return { emoji: '▶️', color: '#FF0000' };
    if (p.includes('tiktok')) return { emoji: '🎵', color: '#000000' };
    return { emoji: '📹', color: '#6366f1' };
  };

  const getPlatformLabel = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return 'Instagram Reel';
    if (p.includes('youtube_shorts') || p === 'youtube shorts') return 'YouTube Shorts';
    if (p.includes('youtube')) return 'YouTube Video';
    if (p.includes('tiktok')) return 'TikTok';
    return 'Video';
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const isPosted = (post: ViralAnalysis): boolean => {
    return post.production_stage === 'POSTED' || !!post.posted_at;
  };

  if (loading) {
    return (
      <>
        <Header title="Posting Manager" subtitle="Schedule & post content" showLogout />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Personalized Header with Profile Dropdown */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Hi, {firstName} 👋</h1>
            <p className="text-sm text-gray-500">
              {stats.scheduledToday > 0
                ? `${stats.scheduledToday} post${stats.scheduledToday !== 1 ? 's' : ''} scheduled for today`
                : 'No posts scheduled for today'}
            </p>
          </div>

          {/* Profile Avatar with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm"
            >
              {initials}
            </button>

            <AnimatePresence>
              {showProfileDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                >
                  {/* Profile Header */}
                  <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 px-4 py-4 text-white">
                    <p className="font-semibold">{fullName}</p>
                    <p className="text-xs opacity-80">Posting Manager</p>
                    <p className="text-xs opacity-70 mt-0.5">{user?.email}</p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <Link
                      to="/posting/settings"
                      onClick={() => setShowProfileDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Settings</span>
                    </Link>
                    <hr className="my-2" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-red-600 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Summary Card - Posted This Month as hero stat */}
        <div className="bg-gradient-posting rounded-2xl p-5 text-white animate-fade-in">
          <p className="text-sm opacity-90 mb-1">Posted This Month</p>
          <p className="text-4xl font-bold mb-4">{stats.postedThisMonth}</p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <p className="text-xl font-semibold">{stats.readyToPost}</p>
              <p className="text-[11px] uppercase opacity-80">Ready</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">{stats.scheduledToday}</p>
              <p className="text-[11px] uppercase opacity-80">Scheduled</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">{stats.postedThisWeek}</p>
              <p className="text-[11px] uppercase opacity-80">This Week</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up delay-1">
          <Link
            to="/posting/to-post"
            className="flex flex-col items-center justify-center gap-2 p-5 bg-cyan-500 text-white rounded-2xl border-2 border-cyan-500 card-press"
          >
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <Send className="w-7 h-7 text-white" />
            </div>
            <span className="text-sm font-semibold">To Post</span>
            <span className="text-xs opacity-80">{stats.readyToPost} ready</span>
          </Link>
          <Link
            to="/posting/calendar"
            className="flex flex-col items-center justify-center gap-2 p-5 bg-white rounded-2xl border-2 border-gray-100 card-press"
          >
            <div className="w-14 h-14 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Calendar className="w-7 h-7 text-cyan-600" />
            </div>
            <span className="text-sm font-semibold text-gray-800">Calendar</span>
            <span className="text-xs text-gray-500">{stats.scheduledToday} today</span>
          </Link>
        </div>

        {/* Today's Schedule */}
        <section className="animate-slide-up delay-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <span>📅</span> Today's Schedule
            </h2>
            <Link to="/posting/calendar" className="text-sm text-primary font-medium flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {todaysSchedule.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No posts scheduled for today</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              {todaysSchedule.slice(0, 4).map((post, index) => {
                const platform = getPlatformIcon(post.posting_platform || post.platform);
                const posted = isPosted(post);

                return (
                  <div key={post.id}>
                    {/* Time label */}
                    {(index === 0 || formatTime(post.scheduled_post_time!) !== formatTime(todaysSchedule[index - 1].scheduled_post_time!)) && (
                      <p className="text-xs font-semibold text-gray-500 mt-3 mb-2 first:mt-0">
                        {formatTime(post.scheduled_post_time!)}
                      </p>
                    )}

                    <Link
                      to={`/posting/post/${post.id}`}
                      className="flex items-center gap-3 py-3 border-b border-gray-200 last:border-0"
                    >
                      {/* Platform dot */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: platform.color }}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {post.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {platform.emoji} {getPlatformLabel(post.posting_platform || post.platform)}
                        </p>
                      </div>

                      {/* Status badge */}
                      {posted ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full">
                          Posted
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded-full">
                          Scheduled
                        </span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Ready to Post */}
        <section className="animate-slide-up delay-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <span>📤</span> Ready to Post
            </h2>
            {readyProjects.length > 0 && (
              <Link to="/posting/to-post" className="text-sm text-primary font-medium flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {readyProjects.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <Send className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No content ready to post</p>
            </div>
          ) : (
            <div className="space-y-3">
              {readyProjects.slice(0, 3).map((project) => {
                const platform = getPlatformIcon(project.platform);

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      {/* Video thumbnail placeholder */}
                      <div className="w-14 h-[72px] rounded-lg bg-gray-800 flex items-center justify-center text-white text-lg flex-shrink-0">
                        ▶
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
                        <p className="text-xs text-gray-400 font-mono">{project.content_id || 'No ID'}</p>

                        {/* Profile badge */}
                        {project.profile?.name && (
                          <p className="text-xs text-cyan-600 font-medium mt-1">
                            {project.profile.name}
                          </p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                            {platform.emoji} {getPlatformLabel(project.platform)}
                          </span>
                          {project.scheduled_post_time && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 rounded text-blue-700 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(project.scheduled_post_time)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <Link
                        to={`/posting/post/${project.id}`}
                        className="block w-full py-2.5 bg-cyan-500 text-white text-sm font-semibold rounded-lg text-center active:bg-cyan-600"
                      >
                        Set Post Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Posted */}
        <section className="animate-slide-up delay-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Recently Posted</h2>
            <Link to="/posting/posted" className="text-sm text-primary font-medium">
              View all
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.postedThisWeek}</p>
                <p className="text-sm text-gray-500">Posted this week</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
