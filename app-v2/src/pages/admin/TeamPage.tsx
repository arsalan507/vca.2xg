import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, RefreshCw, Pencil, Trash2, X, Mail, User as UserIcon, Tag } from 'lucide-react';
import { adminService } from '@/services/adminService';
import ResetPinModal from '@/components/admin/ResetPinModal';
import toast from 'react-hot-toast';

interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  avatar_url?: string;
  created_at: string;
  is_trusted_writer?: boolean;
  scripts_count?: number;
  approval_rate?: number;
  active_projects?: number;
}

interface TeamStats {
  admins: number;
  writers: number;
  videographers: number;
  editors: number;
  postingManagers: number;
  total: number;
}

const ROLE_SECTIONS = [
  { id: 'script_writer', emoji: '✍️', label: 'Script Writers', trustedLabel: 'Trusted Writer', gradient: 'from-blue-500 to-blue-600' },
  { id: 'videographer', emoji: '🎥', label: 'Videographers', trustedLabel: 'Trusted Videographer', gradient: 'from-orange-500 to-orange-600' },
  { id: 'editor', emoji: '✂️', label: 'Editors', trustedLabel: 'Editor', gradient: 'from-green-500 to-green-600' },
  { id: 'posting_manager', emoji: '📱', label: 'Posting Managers', trustedLabel: 'Posting Manager', gradient: 'from-cyan-500 to-cyan-600' },
  { id: 'admin', emoji: '🛡️', label: 'Admins', trustedLabel: 'Administrator', gradient: 'from-purple-500 to-purple-600' },
];

const ROLE_OPTIONS = [
  { id: 'script_writer', icon: '✍️', label: 'Script Writer' },
  { id: 'videographer', icon: '🎥', label: 'Videographer' },
  { id: 'editor', icon: '✂️', label: 'Editor' },
  { id: 'posting_manager', icon: '📱', label: 'Posting Manager' },
  { id: 'super_admin', icon: '🛡️', label: 'Admin' },
];

interface Profile {
  id: string;
  name: string;
  code: string | null;
  platform: string | null;
  is_active: boolean;
  project_count: number;
}

type PageTab = 'team' | 'profiles';

function suggestCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    // Multi-word: first letter of each word
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
  }
  // Single word: first 3 letters
  return name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
}

export default function TeamPage() {
  const [pageTab, setPageTab] = useState<PageTab>('team');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [resetPinModal, setResetPinModal] = useState<{
    isOpen: boolean;
    user: TeamMember | null;
  }>({ isOpen: false, user: null });

  // Add/Edit Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [modalData, setModalData] = useState({
    name: '',
    email: '',
    role: '',
    pin: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit role modal state
  const [editRoleMember, setEditRoleMember] = useState<TeamMember | null>(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Delete confirmation state
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);

  // Profile management state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalData, setProfileModalData] = useState({ name: '', code: '', platform: '' });
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (pageTab === 'profiles' && profiles.length === 0) {
      loadProfiles();
    }
  }, [pageTab]);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [members, stats] = await Promise.all([
        adminService.getTeamMembers(),
        adminService.getTeamStats(),
      ]);

      setTeamMembers(members);
      setTeamStats(stats);
    } catch (error) {
      console.error('Failed to load team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getMembersByRole = (roleId: string) => {
    return teamMembers.filter((m) => {
      if (!m.role) return false;
      const role = m.role.toLowerCase();
      if (roleId === 'admin') {
        return role === 'admin' || role === 'super_admin';
      }
      return role === roleId || role === roleId.toUpperCase();
    });
  };

  const filteredSections = filterRole === 'all'
    ? ROLE_SECTIONS
    : ROLE_SECTIONS.filter(s => s.id === filterRole);

  const getInitials = (member: TeamMember) => {
    if (member.full_name) {
      return member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return member.email.slice(0, 2).toUpperCase();
  };

  const getRoleLabel = (section: typeof ROLE_SECTIONS[0], isTrusted: boolean) => {
    if (isTrusted && (section.id === 'script_writer' || section.id === 'videographer')) {
      return section.trustedLabel;
    }
    return section.label.replace(/s$/, ''); // Remove trailing 's' for singular
  };

  const toggleAutoApprove = async (member: TeamMember) => {
    const newStatus = !member.is_trusted_writer;
    try {
      const { supabase } = await import('@/lib/api');
      const { error } = await supabase
        .from('profiles')
        .update({ is_trusted_writer: newStatus })
        .eq('id', member.id);
      if (error) throw error;
      toast.success(newStatus ? 'Auto-approval enabled! Scripts will be approved automatically.' : 'Auto-approval disabled. Scripts will need manual review.');
      setTeamMembers(prev => prev.map(m =>
        m.id === member.id ? { ...m, is_trusted_writer: newStatus } : m
      ));
    } catch {
      toast.error('Failed to update auto-approval status');
    }
  };

  const openAddModal = () => {
    setEditingMember(null);
    setModalData({ name: '', email: '', role: '', pin: '' });
    setShowAddModal(true);
  };


  const closeModal = () => {
    setShowAddModal(false);
    setEditingMember(null);
    setModalData({ name: '', email: '', role: '', pin: '' });
  };

  const handleSaveMember = async () => {
    if (!modalData.name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!modalData.email.trim()) {
      toast.error('Please enter an email');
      return;
    }
    if (!modalData.role) {
      toast.error('Please select a role');
      return;
    }

    if (modalData.pin && !/^\d{4}$/.test(modalData.pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminService.createUser(modalData.email.trim(), modalData.name.trim(), modalData.role, modalData.pin || undefined);
      toast.success(`${modalData.name} added as ${ROLE_OPTIONS.find(r => r.id === modalData.role)?.label}!`);
      closeModal();
      loadData(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    setDeletingMember(member);
  };

  const confirmDelete = async () => {
    if (!deletingMember) return;

    try {
      await adminService.deleteUser(deletingMember.id);
      toast.success(`${deletingMember.full_name || 'Member'} removed from team`);
      setTeamMembers(prev => prev.filter(m => m.id !== deletingMember.id));
      setDeletingMember(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete member');
    }
  };

  const openEditRole = (member: TeamMember) => {
    setEditRoleMember(member);
    setEditRoleValue(member.role.toLowerCase());
  };

  const confirmUpdateRole = async () => {
    if (!editRoleMember || !editRoleValue) return;
    setIsUpdatingRole(true);
    try {
      await adminService.updateUserRole(editRoleMember.id, editRoleValue);
      toast.success(`${editRoleMember.full_name || 'User'} role updated to ${ROLE_OPTIONS.find(r => r.id === editRoleValue)?.label || editRoleValue}`);
      setEditRoleMember(null);
      loadData(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Profile management functions
  const loadProfiles = async () => {
    try {
      setProfilesLoading(true);
      const data = await adminService.getProfiles();
      setProfiles(data.filter(p => p.is_active !== false));
    } catch (error) {
      console.error('Failed to load profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setProfilesLoading(false);
    }
  };

  const openProfileModal = () => {
    setProfileModalData({ name: '', code: '', platform: '' });
    setShowProfileModal(true);
  };

  const handleProfileNameChange = (name: string) => {
    const autoCode = suggestCode(name);
    setProfileModalData(prev => ({
      ...prev,
      name,
      code: prev.code === suggestCode(prev.name) || prev.code === '' ? autoCode : prev.code,
    }));
  };

  const handleSaveProfile = async () => {
    const { name, code, platform } = profileModalData;
    if (!name.trim()) { toast.error('Enter a profile name'); return; }
    if (!code.trim() || code.length < 2 || code.length > 4) { toast.error('Code must be 2-4 uppercase letters'); return; }
    if (!/^[A-Z]{2,4}$/.test(code)) { toast.error('Code must be uppercase letters only'); return; }

    setIsSubmittingProfile(true);
    try {
      await adminService.createProfile(name.trim(), code.trim(), platform || undefined);
      toast.success(`Profile "${name}" created!`);
      setShowProfileModal(false);
      loadProfiles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!deletingProfile) return;
    try {
      await adminService.deleteProfile(deletingProfile.id);
      toast.success(`Profile "${deletingProfile.name}" deleted`);
      setProfiles(prev => prev.filter(p => p.id !== deletingProfile.id));
      setDeletingProfile(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete profile');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {pageTab === 'team' ? 'Team Members' : 'Profiles'}
            </h1>
            <p className="text-sm text-gray-500">
              {pageTab === 'team' ? `${teamStats?.total || 0} active members` : `${profiles.length} profiles`}
            </p>
          </div>
        </div>
        <button
          onClick={() => pageTab === 'team' ? loadData(true) : loadProfiles()}
          disabled={refreshing || profilesLoading}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${(refreshing || profilesLoading) ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Page Tab Switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPageTab('team')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            pageTab === 'team' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          Team
        </button>
        <button
          onClick={() => setPageTab('profiles')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            pageTab === 'profiles' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Tag className="w-4 h-4" />
          Profiles
        </button>
      </div>

      {pageTab === 'profiles' ? (
        <>
          {/* Profiles List */}
          {profilesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Profiles</h3>
              <p className="text-gray-500 text-sm">Add profiles to organize content</p>
            </div>
          ) : (
            <div className="space-y-3 mb-20">
              {profiles.map((profile) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {profile.code || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {profile.code && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-mono font-medium rounded">
                            {profile.code}
                          </span>
                        )}
                        {profile.platform && (
                          <span className="text-xs text-gray-500">{profile.platform}</span>
                        )}
                        <span className="text-xs text-gray-400">{profile.project_count} projects</span>
                      </div>
                      {profile.code && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          IDs: {profile.code}-001, {profile.code}-002...
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setDeletingProfile(profile)}
                      className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors group"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Add Profile FAB */}
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            onClick={openProfileModal}
            className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-40"
            style={{ boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}
          >
            <Plus className="w-7 h-7" />
          </motion.button>

          {/* Add Profile Modal */}
          <AnimatePresence>
            {showProfileModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowProfileModal(false)}
                  className="fixed inset-0 bg-black/50 z-50"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-x-4 top-4 bottom-4 bg-white rounded-2xl z-50 max-w-md mx-auto overflow-y-auto my-auto max-h-fit"
                >
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Add Profile</h3>
                    <button
                      onClick={() => setShowProfileModal(false)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Profile Name</label>
                      <input
                        type="text"
                        value={profileModalData.name}
                        onChange={(e) => handleProfileNameChange(e.target.value)}
                        placeholder="e.g. Whatts On Wheel"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                    {/* Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Code <span className="text-gray-400 font-normal">(2-4 uppercase letters)</span>
                      </label>
                      <input
                        type="text"
                        value={profileModalData.code}
                        onChange={(e) => setProfileModalData(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) }))}
                        placeholder="e.g. WOW"
                        maxLength={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                      {profileModalData.code.length >= 2 && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          Content IDs will look like: <span className="font-mono font-medium text-purple-600">{profileModalData.code}-001</span>, <span className="font-mono font-medium text-purple-600">{profileModalData.code}-002</span>...
                        </p>
                      )}
                    </div>
                    {/* Platform */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'instagram', label: 'Instagram', emoji: '📸' },
                          { id: 'youtube', label: 'YouTube', emoji: '▶️' },
                          { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
                        ].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setProfileModalData(prev => ({ ...prev, platform: prev.platform === p.id ? '' : p.id }))}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              profileModalData.platform === p.id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200'
                            }`}
                          >
                            <div className="text-xl mb-1">{p.emoji}</div>
                            <div className="text-xs font-medium text-gray-700">{p.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 p-4 border-t border-gray-100">
                    <button
                      onClick={() => setShowProfileModal(false)}
                      className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSubmittingProfile}
                      className="flex-1 py-3 px-4 bg-purple-500 text-white font-medium rounded-xl disabled:opacity-50"
                    >
                      {isSubmittingProfile ? 'Creating...' : 'Create Profile'}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Delete Profile Confirmation */}
          <AnimatePresence>
            {deletingProfile && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDeletingProfile(null)}
                  className="fixed inset-0 bg-black/50 z-50"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 max-w-sm mx-auto p-6 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Profile?</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Are you sure you want to permanently delete <strong>{deletingProfile.name}</strong>? This action cannot be undone. Existing projects with this profile won't be affected.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeletingProfile(null)}
                      className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteProfile}
                      className="flex-1 py-3 px-4 bg-red-500 text-white font-medium rounded-xl"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      ) : (
      <>
      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-4 -mx-4 px-4"
      >
        {[
          { id: 'all', label: 'All', count: teamStats?.total || 0 },
          { id: 'script_writer', label: 'Writers', count: teamStats?.writers || 0 },
          { id: 'videographer', label: 'Videographers', count: teamStats?.videographers || 0 },
          { id: 'editor', label: 'Editors', count: teamStats?.editors || 0 },
          { id: 'posting_manager', label: 'Posting', count: teamStats?.postingManagers || 0 },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setFilterRole(filter.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filterRole === filter.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {filter.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              filterRole === filter.id
                ? 'bg-white/20'
                : 'bg-gray-200'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Role Sections */}
      {filteredSections.map((section, sectionIndex) => {
        const members = getMembersByRole(section.id);
        if (members.length === 0) return null;

        return (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + sectionIndex * 0.05 }}
            className="mb-6"
          >
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>{section.emoji}</span>
              {section.label}
            </h2>

            <div className="space-y-3">
              {members.map((member, memberIndex) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + memberIndex * 0.03 }}
                  className="bg-white rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${section.gradient} flex items-center justify-center text-white font-semibold flex-shrink-0`}>
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name || member.email}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        getInitials(member)
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {member.full_name || 'Unnamed User'}
                        </h3>
                        {member.is_trusted_writer && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded flex items-center gap-0.5">
                            ✓ Auto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {getRoleLabel(section, !!member.is_trusted_writer)}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                      {/* Stats */}
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                        {(section.id === 'script_writer') && (
                          <>
                            <span>📝 {member.scripts_count || 0} scripts</span>
                            <span>✅ {member.approval_rate || 0}%</span>
                          </>
                        )}
                        {(section.id === 'videographer') && (
                          <>
                            <span>🎬 {member.scripts_count || 0} shoots</span>
                            <span>📹 {member.active_projects || 0} active</span>
                          </>
                        )}
                        {(section.id === 'editor') && (
                          <>
                            <span>✂️ {member.scripts_count || 0} edits</span>
                            <span>🎬 {member.active_projects || 0} active</span>
                          </>
                        )}
                        {(section.id === 'posting_manager') && (
                          <>
                            <span>📤 {member.scripts_count || 0} posts</span>
                            <span>📅 {member.active_projects || 0} scheduled</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Auto Approve Toggle (for writers/videographers) */}
                    {(section.id === 'script_writer' || section.id === 'videographer') && (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-gray-400 uppercase">Auto</span>
                        <button
                          onClick={() => toggleAutoApprove(member)}
                          className={`w-11 h-6 rounded-full relative transition-colors ${
                            member.is_trusted_writer ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              member.is_trusted_writer ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEditRole(member)}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                        title="Edit Member"
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member)}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors group"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-gray-500 group-hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        );
      })}

      {/* Empty State */}
      {teamMembers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Team Members</h3>
          <p className="text-gray-500 text-sm">Add team members to get started</p>
        </div>
      )}

      {/* Add User FAB */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
        onClick={openAddModal}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-40"
        style={{ boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}
      >
        <Plus className="w-7 h-7" />
      </motion.button>

      {/* Add/Edit Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-4 bottom-4 bg-white rounded-2xl z-50 max-w-md mx-auto overflow-y-auto my-auto max-h-fit"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingMember ? 'Edit Team Member' : 'Add Team Member'}
                </h3>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4">
                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={modalData.name}
                      onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={modalData.email}
                      onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                      placeholder="Enter email address"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      disabled={!!editingMember}
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setModalData({ ...modalData, role: role.id })}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          modalData.role === role.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">{role.icon}</div>
                        <div className="text-xs font-medium text-gray-700">{role.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PIN Input (optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Set PIN <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={modalData.pin}
                    onChange={(e) => setModalData({ ...modalData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="4-digit PIN"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    If not set, user will create their own PIN on first login
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-4 border-t border-gray-100">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMember}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingMember && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingMember(null)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 max-w-sm mx-auto p-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Team Member?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to remove <strong>{deletingMember.full_name || 'this member'}</strong> from the team? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingMember(null)}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      </>
      )}

      {/* Reset PIN Modal */}
      <ResetPinModal
        isOpen={resetPinModal.isOpen}
        user={resetPinModal.user}
        onClose={() => setResetPinModal({ isOpen: false, user: null })}
        onSuccess={() => {
          toast.success('PIN reset successfully');
        }}
      />

      {/* Edit Role Modal */}
      <AnimatePresence>
        {editRoleMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setEditRoleMember(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl p-6 max-w-sm mx-auto"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit Member</h3>
              <p className="text-sm text-gray-500 mb-4">{editRoleMember.full_name || editRoleMember.email}</p>

              {/* Role selector */}
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setEditRoleValue(role.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                      editRoleValue === role.id
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{role.icon}</span>
                    <span>{role.label}</span>
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => setEditRoleMember(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpdateRole}
                  disabled={isUpdatingRole || editRoleValue === editRoleMember.role.toLowerCase()}
                  className="flex-1 py-2.5 bg-purple-500 text-white font-medium rounded-xl text-sm disabled:opacity-40"
                >
                  {isUpdatingRole ? 'Saving...' : 'Update Role'}
                </button>
              </div>

              {/* Manage PIN option */}
              <button
                onClick={() => {
                  setEditRoleMember(null);
                  setResetPinModal({ isOpen: true, user: editRoleMember });
                }}
                className="w-full py-2.5 text-sm text-orange-600 font-medium border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors"
              >
                Manage PIN
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
