import { UserGroupIcon, ExclamationTriangleIcon, ChartBarIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, FolderIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface AdminSidebarProps {
  selectedPage: 'team' | 'approval' | 'production';
  onPageChange: (page: 'team' | 'approval' | 'production') => void;
}

export default function AdminSidebar({ selectedPage, onPageChange }: AdminSidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to logout');
    } else {
      toast.success('Logged out successfully');
      navigate('/login');
    }
  };
  // Get pending approvals count
  const { data: pendingCount } = useQuery({
    queryKey: ['admin', 'pending-count'],
    queryFn: async () => {
      // Count pending scripts
      const { count: scriptsCount } = await supabase
        .from('viral_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      // Count shoot reviews
      const { count: shootsCount } = await supabase
        .from('viral_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('production_stage', 'SHOOT_REVIEW');

      // Count edit reviews
      const { count: editsCount } = await supabase
        .from('viral_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('production_stage', 'EDIT_REVIEW');

      return (scriptsCount || 0) + (shootsCount || 0) + (editsCount || 0);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get team members count
  const { data: teamCount } = useQuery({
    queryKey: ['admin', 'team-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['SCRIPT_WRITER', 'VIDEOGRAPHER', 'EDITOR', 'POSTING_MANAGER']);

      return count || 0;
    },
  });

  // Get active projects count
  const { data: activeProjectsCount } = useQuery({
    queryKey: ['admin', 'active-projects-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('viral_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED')
        .neq('production_stage', 'POSTED');

      return count || 0;
    },
  });

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">📊 Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {/* Team Members */}
        <button
          onClick={() => onPageChange('team')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
            selectedPage === 'team'
              ? 'bg-primary-50 text-primary-700 border border-primary-200'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <UserGroupIcon className="w-5 h-5" />
            <span className="font-medium">Team Members</span>
          </div>
          {teamCount !== undefined && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              selectedPage === 'team'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {teamCount}
            </span>
          )}
        </button>

        {/* Review */}
        <button
          onClick={() => onPageChange('approval')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors relative ${
            selectedPage === 'approval'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span className="font-medium">Review</span>
          </div>
          {pendingCount !== undefined && pendingCount > 0 && (
            <span className="relative flex items-center">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                selectedPage === 'approval'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-red-500 text-white'
              }`}>
                {pendingCount}
              </span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </span>
          )}
        </button>

        {/* Production Status */}
        <button
          onClick={() => onPageChange('production')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
            selectedPage === 'production'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="w-5 h-5" />
            <span className="font-medium">Production Status</span>
          </div>
          {activeProjectsCount !== undefined && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              selectedPage === 'production'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {activeProjectsCount}
            </span>
          )}
        </button>
      </nav>

      {/* Footer - Settings & Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        {pendingCount !== undefined && pendingCount > 0 && (
          <div className="mb-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800 font-medium">
              ⚠️ {pendingCount} item{pendingCount !== 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''} your attention
            </p>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Cog6ToothIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Settings</span>
        </button>

        {/* Google Drive Button */}
        <button
          onClick={() => {
            const driveUrl = localStorage.getItem('default_drive_folder');
            if (driveUrl && driveUrl.trim() !== '') {
              // If it's a full URL, open it directly
              if (driveUrl.startsWith('http://') || driveUrl.startsWith('https://')) {
                window.open(driveUrl, '_blank');
              } else {
                // Otherwise, construct Google Drive URL from folder ID
                window.open(`https://drive.google.com/drive/folders/${driveUrl}`, '_blank');
              }
            } else {
              toast.error('No Google Drive folder configured. Please set it in Settings.');
              navigate('/settings');
            }
          }}
          className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <FolderIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Google Drive</span>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-red-700 hover:bg-red-50 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>

        <div className="text-xs text-gray-500 text-center pt-2">
          <p>Admin Dashboard v1.0</p>
        </div>
      </div>
    </div>
  );
}
