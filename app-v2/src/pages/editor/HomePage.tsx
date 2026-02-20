import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Clock, CheckCircle, Scissors, Loader2, Sparkles, Settings, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { editorService, type EditorStats } from '@/services/editorService';
import { useAuth } from '@/hooks/useAuth';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

// Helper to check if project is "new" (assigned within last 24 hours)
const isNewAssignment = (project: ViralAnalysis) => {
  const assignedAt = (project as any).editor_assigned_at || project.created_at;
  const hoursSinceAssigned = (Date.now() - new Date(assignedAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceAssigned < 24;
};

// Helper to get editing progress estimate
const getEditingProgress = (project: ViralAnalysis): number => {
  if ((project as any).editing_progress !== undefined) return (project as any).editing_progress;
  const hasEditedFiles = project.production_files?.some(
    (f: any) => ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'].includes(f.file_type) && !f.is_deleted
  );
  return hasEditedFiles ? 80 : 30;
};

export default function EditorHomePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<EditorStats>({ inProgress: 0, available: 0, completed: 0 });
  const [myProjects, setMyProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // User info
  const fullName = (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'Editor';
  const firstName = fullName.split(' ')[0];
  const userEmail = user?.email || '';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'E';

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
    setShowProfileDropdown(false);
    signOut(); // clears session instantly — ProtectedRoute redirects to /login automatically
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { stats: statsData, projects: projectsData } = await editorService.getHomepageData();
      setStats(statsData);
      setMyProjects(projectsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const editingProjects = myProjects.filter((p) => p.production_stage === 'EDITING');
  const completedProjects = myProjects.filter((p) =>
    ['READY_TO_POST', 'POSTED'].includes(p.production_stage || '')
  );

  // Separate new assignments from in-progress
  const newAssignments = editingProjects.filter(isNewAssignment);
  const inProgressProjects = editingProjects.filter((p) => !isNewAssignment(p));

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const getFileCount = (project: ViralAnalysis) => {
    return project.production_files?.filter((f: any) => !f.is_deleted).length || 0;
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-[11px] font-semibold rounded-full uppercase">Urgent</span>;
      case 'high':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[11px] font-semibold rounded-full uppercase">High</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-6">
      {/* Header with greeting */}
      <div className="flex items-center justify-between relative">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Hi, {firstName} 👋</h1>
          <p className="text-sm text-gray-500">{stats.inProgress} videos in your queue</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-sm"
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
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 text-white">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-semibold mb-2">
                    {initials}
                  </div>
                  <p className="font-semibold">{fullName}</p>
                  <p className="text-green-100 text-xs">Video Editor</p>
                  <p className="text-green-200 text-xs mt-0.5 truncate">{userEmail}</p>
                </div>

                {/* Dropdown Menu */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate('/editor/settings');
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
        <div className="bg-gradient-editor rounded-2xl p-5 text-white animate-fade-in">
          <p className="text-sm opacity-90 mb-1">My Queue</p>
          <p className="text-4xl font-bold mb-4">{stats.inProgress}</p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <p className="text-xl font-semibold">{stats.inProgress}</p>
              <p className="text-[11px] uppercase opacity-80">Editing</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">{stats.available}</p>
              <p className="text-[11px] uppercase opacity-80">Available</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">{stats.completed}</p>
              <p className="text-[11px] uppercase opacity-80">Completed</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 animate-slide-up delay-1">
          <Link
            to="/editor/available"
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl border-2 border-gray-100 card-press"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <span className="text-xl">📥</span>
            </div>
            <span className="text-sm font-semibold">Pick Project</span>
            <span className="text-xs text-gray-500">{stats.available} available</span>
          </Link>

          <Link
            to="/editor/my-projects"
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl border-2 border-gray-100 card-press"
          >
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <span className="text-xl">✂️</span>
            </div>
            <span className="text-sm font-semibold">My Queue</span>
            <span className="text-xs text-gray-500">{stats.inProgress} projects</span>
          </Link>

          <Link
            to="/editor/completed"
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl border-2 border-gray-100 card-press"
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <span className="text-sm font-semibold">Completed</span>
            <span className="text-xs text-gray-500">{stats.completed} edits</span>
          </Link>
        </div>

        {/* New Assignments */}
        {newAssignments.length > 0 && (
          <section className="animate-slide-up delay-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h2 className="text-base font-semibold text-gray-800">New Assignments</h2>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase">
                {newAssignments.length} New
              </span>
            </div>

            <div className="space-y-3">
              {newAssignments.slice(0, 2).map((project) => (
                <Link
                  key={project.id}
                  to={`/editor/project/${project.id}`}
                  className="block bg-purple-50 rounded-xl p-4 border-2 border-purple-200 shadow-sm card-press"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                      <p className="text-sm text-gray-400 font-mono">{project.content_id || 'No ID'}</p>
                    </div>
                    <span className="px-2 py-1 bg-purple-500 text-white text-[11px] font-semibold rounded-full uppercase animate-pulse">
                      New
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 bg-white rounded text-gray-600">
                      {getFileCount(project)} files
                    </span>
                    {project.deadline && (
                      <span className="text-xs px-2 py-1 bg-white rounded text-gray-600">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Due {new Date(project.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {getPriorityBadge(project.priority)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* In Progress */}
        <section className="animate-slide-up delay-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">In Progress</h2>
            {editingProjects.length > 0 && (
              <Link to="/editor/my-projects" className="text-sm text-primary font-medium">
                View all
              </Link>
            )}
          </div>

          {inProgressProjects.length === 0 && newAssignments.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <Scissors className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No projects being edited</p>
              <Link to="/editor/available" className="text-primary text-sm font-medium mt-2 inline-block">
                Pick a project
              </Link>
            </div>
          ) : inProgressProjects.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-sm">Start working on your new assignments above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inProgressProjects.slice(0, 2).map((project) => {
                const progress = getEditingProgress(project);
                return (
                  <Link
                    key={project.id}
                    to={`/editor/project/${project.id}`}
                    className="block bg-white rounded-xl p-4 border border-gray-100 shadow-sm card-press"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                        <p className="text-sm text-gray-400 font-mono">{project.content_id || 'No ID'}</p>
                      </div>
                      <span className="text-sm font-bold text-editor">{progress}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-editor rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                        {getFileCount(project)} files
                      </span>
                      {project.deadline && (
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Due {new Date(project.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {getPriorityBadge(project.priority)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recently Completed */}
        <section className="animate-slide-up delay-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Recently Completed</h2>
          </div>

          {completedProjects.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No completed projects yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completedProjects.slice(0, 3).map((project) => (
                <Link
                  key={project.id}
                  to={`/editor/project/${project.id}`}
                  className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{project.title || 'Untitled'}</h3>
                    <p className="text-sm text-gray-500">
                      Completed {formatTimeAgo(project.updated_at || project.created_at)}
                    </p>
                  </div>
                  <FolderOpen className="w-5 h-5 text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
  );
}
