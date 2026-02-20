import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Video, Settings, LogOut, X, Check, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { videographerService, type VideographerStats } from '@/services/videographerService';
import type { ViralAnalysis } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export default function VideographerHomePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<VideographerStats>({
    activeShoots: 0,
    totalShoots: 0,
    scripts: 0,
    completed: 0,
    available: 0,
  });
  const [myProjects, setMyProjects] = useState<ViralAnalysis[]>([]);
  const [myScripts, setMyScripts] = useState<ViralAnalysis[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Profile selection modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalProjectId, setProfileModalProjectId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; name: string; code: string | null; platform?: string; is_active?: boolean }[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Inline profile creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileCode, setNewProfileCode] = useState('');
  const [newProfilePlatform, setNewProfilePlatform] = useState('INSTAGRAM');
  const [creatingProfile, setCreatingProfile] = useState(false);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { stats: statsData, projects, scripts, available } = await videographerService.getHomepageData();
      setStats(statsData);
      setMyProjects(projects);
      setMyScripts(scripts);
      setAvailableProjects(available);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openProfileModal = async (projectId: string) => {
    setProfileModalProjectId(projectId);
    setSelectedProfileId(null);
    setShowProfileModal(true);

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
    setShowProfileModal(false);

    try {
      setPicking(projectId);
      await videographerService.pickProject({
        analysisId: projectId,
        profileId: profileId || undefined,
      });
      toast.success('Project picked successfully!');
      navigate(`/videographer/project/${projectId}`);
    } catch (error: any) {
      console.error('Failed to pick project:', error);
      toast.error(error.message || 'Failed to pick project');
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

  // Get category emoji based on title/content
  const getCategoryEmoji = (project: ViralAnalysis) => {
    const title = (project.title || '').toLowerCase();
    if (title.includes('fitness') || title.includes('gym') || title.includes('workout')) return '🏋️';
    if (title.includes('food') || title.includes('recipe') || title.includes('cook')) return '🍳';
    if (title.includes('coffee') || title.includes('cafe')) return '☕';
    if (title.includes('office') || title.includes('work')) return '👨‍💼';
    if (title.includes('home') || title.includes('decor') || title.includes('diy')) return '🏠';
    if (title.includes('travel') || title.includes('outdoor')) return '🌳';
    if (title.includes('tech') || title.includes('gadget')) return '📱';
    if (title.includes('fashion') || title.includes('style')) return '👗';
    if (title.includes('music') || title.includes('dance')) return '🎵';
    return '🎬';
  };

  // Get priority badge
  const getPriorityBadge = (priority?: string) => {
    if (priority === 'URGENT') return { label: '🔥 Urgent', bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' };
    if (priority === 'HIGH') return { label: '🔥 High', bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' };
    return null;
  };

  // Get user's first name for greeting
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // Active shoots = SHOOTING stage
  const activeShoots = myProjects.filter((p) => p.production_stage === 'SHOOTING');

  // Pending scripts (submitted but not yet approved/rejected)
  const pendingScripts = myScripts.filter((s) => s.status === 'PENDING');

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  // Get shoot type badge
  const getShootTypeBadge = (shootType?: string) => {
    const type = (shootType || 'indoor').toLowerCase();
    if (type.includes('outdoor')) {
      return { emoji: '🌳', label: 'Outdoor', bg: 'rgba(34, 197, 94, 0.1)' };
    }
    if (type.includes('both')) {
      return { emoji: '🏠🌳', label: 'Both', bg: 'rgba(99, 102, 241, 0.1)' };
    }
    return { emoji: '🏠', label: 'Indoor', bg: 'rgba(249, 115, 22, 0.1)' };
  };

  // Get platform badge
  const getPlatformBadge = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('youtube') && p.includes('short')) return { emoji: '🎬', label: 'YouTube Shorts' };
    if (p.includes('youtube')) return { emoji: '▶️', label: 'YouTube' };
    if (p.includes('tiktok')) return { emoji: '🎵', label: 'TikTok' };
    return { emoji: '📸', label: 'Instagram' };
  };

  const handleLogout = () => {
    setShowProfileDropdown(false);
    signOut(); // clears session instantly — ProtectedRoute redirects to /login automatically
  };

  // Get user info
  const fullName = (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'Videographer';
  const userEmail = user?.email || '';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'V';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
    <div className="pb-4">
      {/* Header with greeting */}
      <div className="flex items-center justify-between mb-6 relative">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Hi, {firstName} 👋</h1>
          <p className="text-sm text-gray-500">Let's shoot some content!</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm"
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
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-semibold mb-2">
                    {initials}
                  </div>
                  <p className="font-semibold">{fullName}</p>
                  <p className="text-orange-100 text-xs">Videographer</p>
                  <p className="text-orange-200 text-xs mt-0.5 truncate">{userEmail}</p>
                </div>

                {/* Dropdown Menu */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate('/videographer/settings');
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
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white mb-6 animate-fade-in">
        <p className="text-sm opacity-90 mb-1">Active Shoots</p>
        <p className="text-4xl font-bold mb-4">{stats.activeShoots}</p>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-xl font-semibold">{stats.totalShoots}</p>
            <p className="text-[11px] uppercase opacity-80">Total Shoots</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{stats.scripts}</p>
            <p className="text-[11px] uppercase opacity-80">Scripts</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{stats.completed}</p>
            <p className="text-[11px] uppercase opacity-80">Completed</p>
          </div>
        </div>
      </div>

      {/* Quick Actions - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-slide-up delay-1">
        <Link
          to="/videographer/new-script"
          className="flex flex-col items-center justify-center gap-2 p-5 bg-orange-500 rounded-2xl card-press"
        >
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-2xl">✍️</span>
          </div>
          <span className="text-sm font-semibold text-white">Add Script</span>
          <span className="text-xs text-white/80">Submit idea</span>
        </Link>

        <Link
          to="/videographer/available"
          className="flex flex-col items-center justify-center gap-2 p-5 bg-white rounded-2xl border-2 border-gray-100 card-press"
        >
          <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
            <span className="text-2xl">🎬</span>
          </div>
          <span className="text-sm font-semibold text-gray-800">Pick Project</span>
          <span className="text-xs text-gray-500">{stats.available} available</span>
        </Link>

        <Link
          to="/videographer/my-projects"
          className="flex flex-col items-center justify-center gap-2 p-5 bg-white rounded-2xl border-2 border-gray-100 card-press"
        >
          <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
            <span className="text-2xl">📹</span>
          </div>
          <span className="text-sm font-semibold text-gray-800">My Shoots</span>
          <span className="text-xs text-gray-500">{stats.activeShoots} active</span>
        </Link>

        <Link
          to="/videographer/my-scripts"
          className="flex flex-col items-center justify-center gap-2 p-5 bg-white rounded-2xl border-2 border-gray-100 card-press"
        >
          <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
          <span className="text-sm font-semibold text-gray-800">My Scripts</span>
          <span className="text-xs text-gray-500">{stats.scripts} submitted</span>
        </Link>
      </div>

      {/* Active Shoots Section */}
      <section className="mb-6 animate-slide-up delay-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">🎥 Active Shoots</h2>
          {activeShoots.length > 0 && (
            <Link to="/videographer/my-projects" className="text-sm text-orange-500 font-medium">
              View all →
            </Link>
          )}
        </div>

        {activeShoots.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No active shoots</p>
            <Link to="/videographer/available" className="text-orange-500 text-sm font-medium mt-2 inline-block">
              Pick a project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeShoots.slice(0, 2).map((project) => {
              const shootType = getShootTypeBadge(project.shoot_type);
              const platform = getPlatformBadge(project.platform);

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl shrink-0"
                        style={{ background: shootType.bg }}
                      >
                        {shootType.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
                        <p className="text-sm text-gray-400 font-mono">{project.content_id || 'No ID'}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {platform.emoji} {platform.label}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {shootType.emoji} {shootType.label}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[11px] font-semibold rounded-full uppercase shrink-0">
                        Shooting
                      </span>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <Link
                      to={`/videographer/upload/${project.id}`}
                      className="block w-full py-2.5 text-center bg-orange-500 text-white text-sm font-semibold rounded-lg active:bg-orange-600"
                    >
                      Upload Footage
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* My Scripts Section */}
      {pendingScripts.length > 0 && (
        <section className="mb-6 animate-slide-up delay-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">✍️ My Scripts</h2>
            <Link to="/videographer/my-scripts" className="text-sm text-orange-500 font-medium">
              View all →
            </Link>
          </div>

          <div className="space-y-3">
            {pendingScripts.slice(0, 2).map((script) => {
              const platform = getPlatformBadge(script.platform);
              const shootType = getShootTypeBadge(script.shoot_type);

              return (
                <div
                  key={script.id}
                  className="bg-white rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{script.title || 'Untitled'}</h3>
                      <p className="text-sm text-gray-400">Submitted {formatTimeAgo(script.created_at)}</p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[11px] font-semibold rounded-full uppercase">
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {platform.emoji} {platform.label}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {shootType.emoji} {shootType.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Available Projects Preview */}
      {availableProjects.length > 0 && (
        <section className="animate-slide-up delay-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">📋 Available Projects</h2>
            <Link to="/videographer/available" className="text-sm text-orange-500 font-medium">
              View all →
            </Link>
          </div>

          <div className="space-y-3">
            {availableProjects.slice(0, 2).map((project) => {
              const shootType = getShootTypeBadge(project.shoot_type);
              const platform = getPlatformBadge(project.platform);
              const priority = getPriorityBadge(project.priority);
              const categoryEmoji = getCategoryEmoji(project);

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl shrink-0"
                        style={{ background: 'rgba(99, 102, 241, 0.1)' }}
                      >
                        {categoryEmoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
                        <p className="text-sm text-gray-400 font-mono">{project.content_id || 'No ID yet'}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {platform.emoji} {platform.label}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {shootType.emoji} {shootType.label}
                          </span>
                          {priority && (
                            <span
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: priority.bg, color: priority.color }}
                            >
                              {priority.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => openProfileModal(project.id)}
                      disabled={picking === project.id}
                      className="block w-full py-2.5 text-center bg-white border-2 border-orange-500 text-orange-500 text-sm font-semibold rounded-lg active:bg-orange-50 disabled:opacity-50"
                    >
                      {picking === project.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        'Pick This Project'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>

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
