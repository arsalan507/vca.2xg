import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, Upload } from 'lucide-react';
import { postingManagerService } from '@/services/postingManagerService';
import { videographerService } from '@/services/videographerService';
import type { ViralAnalysis } from '@/types';

type ViewMode = 'scheduled' | 'ready';

type PlatformFilter = 'all' | 'instagram' | 'youtube_shorts' | 'youtube_long' | 'tiktok';

interface Profile {
  id: string;
  name: string;
}

interface ScheduledCounts {
  today: number;
  tomorrow: number;
  thisWeek: number;
}

interface GroupedPosts {
  [date: string]: ViralAnalysis[];
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [scheduledPosts, setScheduledPosts] = useState<ViralAnalysis[]>([]);
  const [readyToPostProjects, setReadyToPostProjects] = useState<ViralAnalysis[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('scheduled');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      const [posts, readyProjects, profileList] = await Promise.all([
        postingManagerService.getScheduledPosts(startDate.toISOString(), endDate.toISOString()),
        postingManagerService.getReadyToPostProjects(),
        videographerService.getProfiles(),
      ]);

      setScheduledPosts(posts);
      setReadyToPostProjects(readyProjects);
      setProfiles(profileList);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [currentMonth]);

  // Calculate counts
  const getCounts = (): ScheduledCounts => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let todayCount = 0;
    let tomorrowCount = 0;
    let thisWeekCount = 0;

    scheduledPosts.forEach((post) => {
      if (!post.scheduled_post_time) return;
      const postDate = new Date(post.scheduled_post_time);

      if (postDate >= today && postDate < tomorrow) {
        todayCount++;
      } else if (postDate >= tomorrow && postDate < dayAfterTomorrow) {
        tomorrowCount++;
      }
      if (postDate >= today && postDate < weekEnd) {
        thisWeekCount++;
      }
    });

    return { today: todayCount, tomorrow: tomorrowCount, thisWeek: thisWeekCount };
  };

  // Check if date has posts
  const getPostsForDate = (date: Date): ViralAnalysis[] => {
    const dateString = date.toISOString().split('T')[0];
    return scheduledPosts.filter((post) => {
      if (!post.scheduled_post_time) return false;
      const postDateString = new Date(post.scheduled_post_time).toISOString().split('T')[0];
      return postDateString === dateString;
    });
  };

  // Filter posts
  const getFilteredPosts = (): ViralAnalysis[] => {
    return scheduledPosts.filter((post) => {
      if (selectedProfile !== 'all' && post.profile_id !== selectedProfile) return false;
      if (selectedPlatform !== 'all') {
        const platform = (post.posting_platform || post.platform || '').toLowerCase();
        switch (selectedPlatform) {
          case 'instagram':
            return platform.includes('instagram');
          case 'youtube_shorts':
            return platform.includes('youtube_shorts') || platform === 'youtube shorts';
          case 'youtube_long':
            return platform.includes('youtube_video') || platform.includes('youtube_long');
          case 'tiktok':
            return platform.includes('tiktok');
          default:
            return true;
        }
      }
      return true;
    });
  };

  // Get platform counts
  const getPlatformCounts = () => {
    let all = 0;
    let instagram = 0;
    let youtubeShorts = 0;
    let youtubeLong = 0;

    scheduledPosts.forEach((post) => {
      all++;
      const platform = (post.posting_platform || post.platform || '').toLowerCase();
      if (platform.includes('instagram')) instagram++;
      else if (platform.includes('youtube_shorts') || platform === 'youtube shorts') youtubeShorts++;
      else if (platform.includes('youtube_video') || platform.includes('youtube_long')) youtubeLong++;
    });

    return { all, instagram, youtubeShorts, youtubeLong };
  };

  // Group posts by date
  const groupPostsByDate = (posts: ViralAnalysis[]): GroupedPosts => {
    const grouped: GroupedPosts = {};

    posts.forEach((post) => {
      if (!post.scheduled_post_time) return;
      const date = new Date(post.scheduled_post_time);
      const dateKey = date.toISOString().split('T')[0];

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(post);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        const timeA = new Date(a.scheduled_post_time || '').getTime();
        const timeB = new Date(b.scheduled_post_time || '').getTime();
        return timeA - timeB;
      });
    });

    return grouped;
  };

  // Format date header
  const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) {
      return `Today, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (date.getTime() === tomorrow.getTime()) {
      return `Tomorrow, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format time
  const formatTime = (dateString: string): { time: string; period: string } => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return { time: `${displayHours}:${displayMinutes}`, period };
  };

  // Get platform icon
  const getPlatformIcon = (platform?: string): { emoji: string; bgColor: string } => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return { emoji: '📸', bgColor: 'bg-pink-100' };
    if (p.includes('youtube_shorts') || p === 'youtube shorts') return { emoji: '🎬', bgColor: 'bg-red-100' };
    if (p.includes('youtube')) return { emoji: '▶️', bgColor: 'bg-red-100' };
    if (p.includes('tiktok')) return { emoji: '🎵', bgColor: 'bg-gray-100' };
    return { emoji: '📹', bgColor: 'bg-gray-100' };
  };

  // Check if post is already posted
  const isPosted = (post: ViralAnalysis): boolean => {
    return post.production_stage === 'POSTED' || !!post.posted_at;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Filter ready to post projects by profile
  const getFilteredReadyProjects = (): ViralAnalysis[] => {
    if (selectedProfile === 'all') return readyToPostProjects;
    return readyToPostProjects.filter((project) => project.profile_id === selectedProfile);
  };

  // Get profile counts for ready to post
  const getReadyProfileCounts = () => {
    const counts: { [key: string]: number } = { all: readyToPostProjects.length };
    readyToPostProjects.forEach((project) => {
      if (project.profile_id) {
        counts[project.profile_id] = (counts[project.profile_id] || 0) + 1;
      }
    });
    return counts;
  };

  const counts = getCounts();
  const filteredPosts = getFilteredPosts();
  const groupedPosts = groupPostsByDate(filteredPosts);
  const platformCounts = getPlatformCounts();
  const filteredReadyProjects = getFilteredReadyProjects();
  const readyProfileCounts = getReadyProfileCounts();

  // Get sorted dates, optionally filtering to selected date
  const sortedDates = useMemo(() => {
    let dates = Object.keys(groupedPosts).sort();
    if (selectedDate) {
      dates = dates.filter(d => d === selectedDate);
    }
    return dates;
  }, [groupedPosts, selectedDate]);

  const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-4"
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {viewMode === 'scheduled' ? 'Calendar' : 'Ready to Post'}
          </h1>
          <p className="text-sm text-gray-500">
            {viewMode === 'scheduled'
              ? `${scheduledPosts.length} posts scheduled`
              : selectedProfile !== 'all'
              ? `${filteredReadyProjects.length} of ${readyToPostProjects.length} videos`
              : `${readyToPostProjects.length} videos ready`}
          </p>
        </div>
      </motion.div>

      {/* View Mode Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 mb-6"
      >
        <button
          onClick={() => setViewMode('scheduled')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
            viewMode === 'scheduled'
              ? 'bg-cyan-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          📅 Scheduled
        </button>
        <button
          onClick={() => setViewMode('ready')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
            viewMode === 'ready'
              ? 'bg-green-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          ✅ Ready to Post
          {readyToPostProjects.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-white/20">
              {readyToPostProjects.length}
            </span>
          )}
        </button>
      </motion.div>

      {/* SCHEDULED VIEW */}
      {viewMode === 'scheduled' && (
        <>
          {/* Profile Filter */}
          {profiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            <span>📁</span> Filter by Profile
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1">
            <button
              onClick={() => setSelectedProfile('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                selectedProfile === 'all'
                  ? 'bg-cyan-500 border-cyan-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600'
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
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Calendar Navigation & Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-100 p-4 mb-4"
      >
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-gray-800">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={nextMonth}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const postsOnDay = getPostsForDate(day.date);
            const hasPosts = postsOnDay.length > 0;
            const dateString = day.date.toISOString().split('T')[0];
            const isSelected = selectedDate === dateString;

            return (
              <button
                key={index}
                onClick={() => {
                  if (hasPosts) {
                    setSelectedDate(isSelected ? null : dateString);
                  }
                }}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative transition-all ${
                  day.isToday
                    ? 'bg-cyan-500 text-white font-semibold'
                    : day.isCurrentMonth
                    ? isSelected
                      ? 'bg-cyan-100 text-cyan-700 font-medium'
                      : 'text-gray-800 hover:bg-gray-50'
                    : 'text-gray-300'
                } ${hasPosts && !day.isToday ? 'cursor-pointer' : ''}`}
              >
                {day.date.getDate()}
                {/* Post indicator dot */}
                {hasPosts && (
                  <div
                    className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                      day.isToday ? 'bg-white' : 'bg-cyan-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Summary Boxes */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3 mb-4"
      >
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-gray-800">{counts.today}</div>
          <div className="text-[11px] text-gray-500 uppercase">Today</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-gray-800">{counts.tomorrow}</div>
          <div className="text-[11px] text-gray-500 uppercase">Tomorrow</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-gray-800">{counts.thisWeek}</div>
          <div className="text-[11px] text-gray-500 uppercase">This Week</div>
        </div>
      </motion.div>

      {/* Platform Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 mb-6"
      >
        <button
          onClick={() => setSelectedPlatform('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
            selectedPlatform === 'all'
              ? 'bg-cyan-500 text-white'
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
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
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
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
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
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
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

      {/* Selected Date Indicator */}
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between mb-4 px-2"
        >
          <p className="text-sm text-cyan-600 font-medium">
            Showing posts for {formatDateHeader(selectedDate)}
          </p>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-sm text-gray-500 underline"
          >
            Show all
          </button>
        </motion.div>
      )}

      {/* Scheduled Posts List */}
      {sortedDates.length > 0 ? (
        sortedDates.map((dateKey, dateIndex) => {
          const posts = groupedPosts[dateKey];
          return (
            <motion.section
              key={dateKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + dateIndex * 0.05 }}
              className="mb-6"
            >
              {/* Date Header */}
              <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm">
                <span>📅</span>
                {formatDateHeader(dateKey)}
                <span className="text-gray-400 font-normal">• {posts.length} post{posts.length !== 1 ? 's' : ''}</span>
              </h2>

              {/* Post Cards */}
              <div className="space-y-2">
                {posts.map((post) => {
                  const { time, period } = formatTime(post.scheduled_post_time || '');
                  const platform = getPlatformIcon(post.posting_platform || post.platform);
                  const posted = isPosted(post);
                  const profileName = post.profile?.name;

                  return (
                    <Link
                      key={post.id}
                      to={`/posting/post/${post.id}`}
                      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 active:bg-gray-50"
                    >
                      {/* Time */}
                      <div className="text-center w-14 shrink-0">
                        <div className="text-sm font-semibold text-cyan-600">{time}</div>
                        <div className="text-[10px] text-gray-400">{period}</div>
                      </div>

                      {/* Platform Icon */}
                      <div className={`w-9 h-9 rounded-lg ${platform.bgColor} flex items-center justify-center text-lg shrink-0`}>
                        {platform.emoji}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate text-sm">
                          {post.title || 'Untitled'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {post.content_id || 'No ID'}
                        </div>
                        {profileName && (
                          <div className="mt-1">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-100 text-cyan-700">
                              {profileName}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      {posted ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600 shrink-0">
                          Posted
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-600 shrink-0">
                          {time} {period}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </motion.section>
          );
        })
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="text-5xl mb-4">📅</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Scheduled Posts</h3>
          <p className="text-gray-500 text-sm">
            {selectedProfile !== 'all' || selectedPlatform !== 'all' || selectedDate
              ? 'No posts match your filters'
              : 'Schedule posts from the To Post page'}
          </p>
        </motion.div>
      )}
        </>
      )}

      {/* READY TO POST VIEW */}
      {viewMode === 'ready' && (
        <>
          {/* Profile Filter */}
          {profiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6"
            >
              <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <span>📁</span> Filter by Profile
              </div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1">
                <button
                  onClick={() => setSelectedProfile('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                    selectedProfile === 'all'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  All Profiles
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    selectedProfile === 'all' ? 'bg-white/20' : 'bg-gray-200'
                  }`}>
                    {readyProfileCounts.all}
                  </span>
                </button>
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                      selectedProfile === profile.id
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {profile.name}
                    {readyProfileCounts[profile.id] && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                        selectedProfile === profile.id ? 'bg-white/20' : 'bg-gray-200'
                      }`}>
                        {readyProfileCounts[profile.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Ready to Post List */}
          {filteredReadyProjects.length > 0 ? (
            <div className="space-y-3">
              {filteredReadyProjects.map((project, index) => {
                const platform = getPlatformIcon(project.posting_platform || project.platform);
                const profileName = project.profile?.name;

                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/posting/post/${project.id}`}
                      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 active:bg-gray-50 shadow-sm"
                    >
                      {/* Platform Icon */}
                      <div className={`w-12 h-12 rounded-xl ${platform.bgColor} flex items-center justify-center text-2xl shrink-0`}>
                        {platform.emoji}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {project.title || 'Untitled'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {project.content_id || 'No ID'}
                        </p>
                        {profileName && (
                          <div className="mt-1.5">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                              🎯 {profileName}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Post Now Button */}
                      <div className="shrink-0">
                        <div className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-lg font-medium text-sm">
                          <Upload className="w-4 h-4" />
                          Post Now
                        </div>
                      </div>
                    </Link>
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
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Videos Ready</h3>
              <p className="text-gray-500 text-sm">
                {selectedProfile !== 'all'
                  ? 'No videos match this profile filter'
                  : 'Videos will appear here after being edited and approved'}
              </p>
              {selectedProfile !== 'all' && (
                <button
                  onClick={() => setSelectedProfile('all')}
                  className="mt-4 text-sm text-green-600 font-medium underline"
                >
                  Show all profiles
                </button>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
