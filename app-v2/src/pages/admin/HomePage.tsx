import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users, Settings, LogOut, UsersRound, ChevronRight } from 'lucide-react';
import { adminService, type DashboardStats, type QueueStats } from '@/services/adminService';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface PendingScript {
  id: string;
  title: string;
  creator: string;
  createdAt: string;
  platform: string;
  location?: string;
  score?: number;
}

export default function AdminHomePage() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [pendingScripts, setPendingScripts] = useState<PendingScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Get user's first name or email prefix
  const fullName = user?.user_metadata?.name as string | undefined
    || user?.user_metadata?.full_name as string | undefined;
  const userName = fullName?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'Admin';

  const userEmail = user?.email || 'admin@example.com';
  const userRole = role || 'Administrator';

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Close menu when clicking outside - must be before any early returns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [dashboardStats, queue, pending] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getQueueStats(),
        adminService.getPendingAnalyses().catch(() => []),
      ]);
      setStats(dashboardStats);
      setQueueStats(queue);

      // Transform pending analyses to scripts format
      const scripts: PendingScript[] = (pending || []).slice(0, 3).map((item: any) => ({
        id: item.id,
        title: item.title || 'Untitled Script',
        creator: item.profiles?.full_name || item.user_id?.substring(0, 8) || 'Unknown',
        createdAt: item.created_at,
        platform: item.platform || 'Instagram',
        location: item.location_type || 'Indoor',
        score: item.viral_score || null,
      }));
      setPendingScripts(scripts);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await signOut();
    navigate('/login');
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getPlatformEmoji = (platform: string) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('instagram')) return '📸';
    if (p.includes('youtube') && p.includes('short')) return '🎬';
    if (p.includes('youtube')) return '▶️';
    if (p.includes('tiktok')) return '🎵';
    return '📱';
  };

  const getLocationEmoji = (location?: string) => {
    const l = location?.toLowerCase() || '';
    if (l.includes('outdoor')) return '🌳';
    return '🏠';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Calculate in production (planning + shooting + editing + ready for edit + ready to post)
  const inProduction = (queueStats?.planning || 0) + (queueStats?.shooting || 0) +
    (queueStats?.editing || 0) + (queueStats?.readyForEdit || 0) + (queueStats?.readyToPost || 0);

  // Quick action items with tinted backgrounds
  const quickActions = [
    {
      to: '/admin/pending',
      icon: '📝',
      label: 'Review Scripts',
      count: `${queueStats?.pending || 0} pending`,
      bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
      to: '/admin/production',
      icon: '🎬',
      label: 'Production',
      count: `${inProduction} active`,
      bgColor: 'rgba(249, 115, 22, 0.1)',
    },
    {
      to: '/posting/calendar',
      icon: '📅',
      label: 'Scheduled',
      count: `${queueStats?.readyToPost || 0} posts`,
      bgColor: 'rgba(99, 102, 241, 0.1)',
    },
    {
      to: '/posting/posted',
      icon: '✅',
      label: 'Posted',
      count: `${queueStats?.posted || 0} videos`,
      bgColor: 'rgba(34, 197, 94, 0.1)',
    },
    {
      to: '/admin/team',
      icon: '👥',
      label: 'Team',
      count: `${stats?.totalUsers || 0} members`,
      bgColor: 'rgba(139, 92, 246, 0.1)',
    },
    {
      to: '/admin/analytics',
      icon: '📊',
      label: 'Analytics',
      count: 'View stats',
      bgColor: 'rgba(6, 182, 212, 0.1)',
    },
  ];

  return (
    <div className="pb-4">
      {/* Header with greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6 relative"
      >
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Hi, {userName} 👋
          </h1>
          <p className="text-sm text-gray-500">Let's review today's scripts</p>
        </div>

        {/* Avatar with dropdown */}
        <div ref={profileMenuRef} className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold cursor-pointer active:scale-95 transition-transform"
          >
            {userName.charAt(0).toUpperCase()}
          </button>

          {/* Profile Dropdown Menu */}
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-60 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                {/* Profile Header */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-semibold mb-2">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold">{userName}</p>
                  <p className="text-purple-100 text-sm capitalize">{String(userRole).replace('_', ' ')}</p>
                  <p className="text-purple-200 text-xs mt-0.5">{userEmail}</p>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <Link
                    to="/admin/team"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <UsersRound className="w-5 h-5 text-gray-500" />
                    <span className="text-sm">Manage Team</span>
                  </Link>
                  <Link
                    to="/admin/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-gray-500" />
                    <span className="text-sm">Settings</span>
                  </Link>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Summary Card - Pending Reviews */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white mb-6"
      >
        <p className="text-purple-100 text-sm mb-1">Pending Reviews</p>
        <p className="text-4xl font-bold mb-4">{queueStats?.pending || 0}</p>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-xl font-semibold">{stats?.approvedAnalyses || 0}</p>
            <p className="text-purple-100 text-xs uppercase">Approved</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{stats?.rejectedAnalyses || 0}</p>
            <p className="text-purple-100 text-xs uppercase">Rejected</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{inProduction}</p>
            <p className="text-purple-100 text-xs uppercase">In Production</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions - 6 items with tinted backgrounds */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.to}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.03 }}
            >
              <Link
                to={action.to}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition-transform"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: action.bgColor }}
                >
                  <span className="text-2xl">{action.icon}</span>
                </div>
                <span className="font-medium text-sm text-gray-900">{action.label}</span>
                <span className="text-xs text-gray-500">{action.count}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Needs Review Section */}
      {pendingScripts.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Needs Review</h2>
            <Link
              to="/admin/pending"
              className="flex items-center gap-1 text-sm text-purple-600 font-medium"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {pendingScripts.map((script, index) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="bg-white border border-gray-200 rounded-xl p-4 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{script.title}</h3>
                    <p className="text-sm text-gray-500">By {script.creator} • {formatTimeAgo(script.createdAt)}</p>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                    Pending
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full flex items-center gap-1">
                    {getPlatformEmoji(script.platform)} {script.platform}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full flex items-center gap-1">
                    {getLocationEmoji(script.location)} {script.location || 'Indoor'}
                  </span>
                  {script.score && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full flex items-center gap-1">
                      ⭐ {script.score.toFixed(1)}
                    </span>
                  )}
                </div>

                <Link
                  to={`/admin/review/${script.id}`}
                  className="block w-full py-2.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg text-center transition-colors"
                >
                  Review Now
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Pipeline Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            Pipeline Overview
          </h2>
          <Link
            to="/admin/production"
            className="flex items-center gap-1 text-sm text-purple-600 font-medium"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="space-y-3">
            <PipelineRow
              label="Ready for Edit"
              count={queueStats?.readyForEdit || 0}
              color="bg-purple-500"
              total={queueStats?.totalActive || 1}
            />
            <PipelineRow
              label="Editing"
              count={queueStats?.editing || 0}
              color="bg-orange-500"
              total={queueStats?.totalActive || 1}
            />
            <PipelineRow
              label="Ready to Post"
              count={queueStats?.readyToPost || 0}
              color="bg-green-500"
              total={queueStats?.totalActive || 1}
            />
            <PipelineRow
              label="Posted"
              count={queueStats?.posted || 0}
              color="bg-cyan-500"
              total={queueStats?.totalActive || 1}
            />
          </div>
        </div>
      </motion.section>

      {/* Stats Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            Overview
          </h2>
          <Link
            to="/admin/analytics"
            className="flex items-center gap-1 text-sm text-purple-600 font-medium"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-gray-500 text-sm">Total Scripts</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalAnalyses || 0}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-gray-500 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-gray-500 text-sm">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats?.approvedAnalyses || 0}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-gray-500 text-sm">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats?.rejectedAnalyses || 0}</p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function PipelineRow({
  label,
  count,
  color,
  total,
}: {
  label: string;
  count: number;
  color: string;
  total: number;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{count}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      </div>
    </div>
  );
}
