import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, Settings, LogOut } from 'lucide-react';
import { analysesService, type AnalysisStats } from '@/services/analysesService';
import { useAuth } from '@/hooks/useAuth';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

export default function WriterHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [pendingScripts, setPendingScripts] = useState<ViralAnalysis[]>([]);
  const [recentApproved, setRecentApproved] = useState<ViralAnalysis[]>([]);
  const [needsRevision, setNeedsRevision] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user's first name for greeting
  const fullName = (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'Writer';
  const firstName = fullName.split(' ')[0];
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const userEmail = user?.email || '';

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

  const handleLogout = () => {
    signOut(); // clears session instantly — ProtectedRoute redirects to /login automatically
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, pending, approved, rejected] = await Promise.all([
        analysesService.getMyStats(),
        analysesService.getPendingAnalyses(),
        analysesService.getApprovedAnalyses(),
        analysesService.getRejectedAnalyses(),
      ]);

      setStats(statsData);
      setPendingScripts(pending.slice(0, 3)); // Show max 3
      setRecentApproved(approved.slice(0, 3)); // Show max 3
      setNeedsRevision(rejected.slice(0, 2)); // Show max 2
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
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
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram_reel':
        return '📸';
      case 'youtube_shorts':
        return '🎬';
      case 'youtube_long':
        return '▶️';
      default:
        return '📹';
    }
  };

  const getShootTypeIcon = (shootType?: string) => {
    return shootType?.toLowerCase() === 'outdoor' ? '🌳' : '🏠';
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'SHOOTING':
        return 'Shooting';
      case 'READY_FOR_EDIT':
      case 'EDITING':
        return 'Editing';
      case 'READY_TO_POST':
        return 'Ready to Post';
      case 'POSTED':
        return 'Posted';
      default:
        return 'In Production';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Greeting Header */}
      <div className="flex items-center justify-between py-4 relative">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hi, {firstName} 👋</h1>
          <p className="text-sm text-gray-500">Keep creating viral content!</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-md active:opacity-90 transition-opacity"
          >
            {initials}
          </button>

          {/* Profile Dropdown */}
          <AnimatePresence>
            {showProfileDropdown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-14 w-60 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                {/* Dropdown Header */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-semibold mb-2">
                    {initials}
                  </div>
                  <p className="font-semibold">{fullName}</p>
                  <p className="text-blue-100 text-xs">Script Writer</p>
                  <p className="text-blue-200 text-xs mt-0.5 truncate">{userEmail}</p>
                </div>

                {/* Dropdown Menu */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate('/writer/settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">Settings</span>
                  </button>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white mb-6"
      >
        <p className="text-blue-100 text-sm mb-1">Your Scripts This Month</p>
        <p className="text-4xl font-bold mb-4">{stats?.total || 0}</p>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold">{stats?.approved || 0}</p>
            <p className="text-blue-100 text-xs">Approved</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{stats?.pending || 0}</p>
            <p className="text-blue-100 text-xs">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{stats?.approvalRate || 0}%</p>
            <p className="text-blue-100 text-xs">Approval</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-6 px-4"
      >
        <Link
          to="/writer/new"
          className="bg-blue-500 text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            ✍️
          </div>
          <span className="font-medium">New Script</span>
          <span className="text-blue-100 text-xs">Submit now</span>
        </Link>

        <Link
          to="/writer/scripts"
          className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-2xl">
            📋
          </div>
          <span className="font-medium text-gray-900">My Scripts</span>
          <span className="text-gray-500 text-xs">{stats?.total || 0} total</span>
        </Link>
      </motion.div>

      {/* Pending Review */}
      {pendingScripts.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 px-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              ⏳ Pending Review
            </h2>
            <Link to="/writer/scripts?filter=pending" className="text-blue-500 text-sm font-medium">
              View all →
            </Link>
          </div>

          <div className="space-y-3">
            {pendingScripts.map((script) => (
              <Link
                key={script.id}
                to={`/writer/scripts/${script.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{script.title || 'Untitled'}</h3>
                    <p className="text-gray-500 text-sm">Submitted {formatTimeAgo(script.created_at)}</p>
                  </div>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                    Pending
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {getPlatformIcon(script.platform)} {script.platform?.replace('_', ' ')}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {getShootTypeIcon(script.shoot_type)} {script.shoot_type || 'Indoor'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* Recently Approved */}
      {recentApproved.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6 px-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              ✅ Recently Approved
            </h2>
          </div>

          <div className="space-y-3">
            {recentApproved.map((script) => (
              <Link
                key={script.id}
                to={`/writer/scripts/${script.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{script.title || 'Untitled'}</h3>
                    <p className="text-gray-500 text-sm">
                      Approved {formatTimeAgo(script.reviewed_at || script.updated_at)}
                      {script.production_stage && ` • ${getStageLabel(script.production_stage)}`}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {getStageLabel(script.production_stage)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {getPlatformIcon(script.platform)} {script.platform?.replace('_', ' ')}
                  </span>
                  {script.content_id && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                      {script.content_id}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* Needs Revision */}
      {needsRevision.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6 px-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              🔄 Needs Revision
            </h2>
          </div>

          <div className="space-y-3">
            {needsRevision.map((script) => (
              <Link
                key={script.id}
                to={`/writer/scripts/${script.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 border-l-4 border-l-red-400"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{script.title || 'Untitled'}</h3>
                    <p className="text-gray-500 text-sm">
                      Rejected {formatTimeAgo(script.reviewed_at || script.updated_at)}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    Rejected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {getPlatformIcon(script.platform)} {script.platform?.replace('_', ' ')}
                  </span>
                  {script.feedback && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                      💬 Has feedback
                    </span>
                  )}
                </div>
                <button className="mt-3 w-full py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 active:bg-gray-100">
                  View Feedback & Revise
                </button>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* Empty State */}
      {stats?.total === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 px-4"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PenLine className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No scripts yet</h3>
          <p className="text-gray-500 text-sm mb-4">Start by submitting your first viral script analysis</p>
          <Link
            to="/writer/new"
            className="inline-flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-xl font-medium"
          >
            <PenLine className="w-4 h-4" />
            Create Your First Script
          </Link>
        </motion.div>
      )}
    </div>
  );
}
