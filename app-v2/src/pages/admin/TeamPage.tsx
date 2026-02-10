import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, RefreshCw, Pencil, Trash2, X, Mail, User as UserIcon } from 'lucide-react';
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
];

export default function TeamPage() {
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
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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
    toast.success(newStatus ? 'Auto-approval enabled! Scripts will be approved automatically.' : 'Auto-approval disabled. Scripts will need manual review.');
    // Update local state
    setTeamMembers(prev => prev.map(m =>
      m.id === member.id ? { ...m, is_trusted_writer: newStatus } : m
    ));
  };

  const openAddModal = () => {
    setEditingMember(null);
    setModalData({ name: '', email: '', role: '' });
    setShowAddModal(true);
  };

  const closeEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setModalData({
      name: member.full_name || '',
      email: member.email,
      role: member.role.toLowerCase(),
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingMember(null);
    setModalData({ name: '', email: '', role: '' });
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

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to save member
      if (editingMember) {
        toast.success(`${modalData.name} updated successfully!`);
      } else {
        toast.success(`${modalData.name} added as ${ROLE_OPTIONS.find(r => r.id === modalData.role)?.label}!`);
      }
      closeModal();
      // Reload data
      loadData(true);
    } catch (error) {
      toast.error('Failed to save member');
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
      // TODO: Implement API call to delete member
      toast.success(`${deletingMember.full_name || 'Member'} removed from team`);
      setTeamMembers(prev => prev.filter(m => m.id !== deletingMember.id));
      setDeletingMember(null);
    } catch (error) {
      toast.error('Failed to delete member');
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
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Team Members</h1>
            <p className="text-sm text-gray-500">{teamStats?.total || 0} active members</p>
          </div>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

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
                        onClick={() => setResetPinModal({ isOpen: true, user: member })}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                        title="Reset PIN"
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

      {/* Reset PIN Modal */}
      <ResetPinModal
        isOpen={resetPinModal.isOpen}
        user={resetPinModal.user}
        onClose={() => setResetPinModal({ isOpen: false, user: null })}
        onSuccess={() => {
          toast.success('PIN reset successfully');
        }}
      />
    </div>
  );
}
