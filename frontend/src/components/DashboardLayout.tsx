import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import toast from 'react-hot-toast';
import { useState } from 'react';
import {
  ArrowRightOnRectangleIcon,
  HomeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  VideoCameraIcon,
  FilmIcon,
  MegaphoneIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { UserRole } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const queryClient = useQueryClient();

  // Fetch user profile to get role
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileService.getMyProfile,
  });

  const handleLogout = async () => {
    try {
      await authService.signOut();
      // Clear all React Query cache to prevent stale data
      queryClient.clear();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const isAdmin = profile?.role === UserRole.SUPER_ADMIN;
  const isVideographer = profile?.role === UserRole.VIDEOGRAPHER;
  const isEditor = profile?.role === UserRole.EDITOR;
  const isPostingManager = profile?.role === UserRole.POSTING_MANAGER;
  const isCreator = profile?.role === UserRole.CREATOR;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">Viral Content Analyzer</h1>

              {/* Navigation Links */}
              <div className="hidden md:flex space-x-1">
                {(isAdmin || isCreator) ? (
                  <>
                    <Link
                      to="/admin"
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition ${
                        isActive('/admin')
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <ChartBarIcon className="w-5 h-5 mr-2" />
                      Admin Dashboard
                    </Link>
                    <Link
                      to="/analyses"
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition ${
                        isActive('/analyses')
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <DocumentTextIcon className="w-5 h-5 mr-2" />
                      All Analyses
                    </Link>
                  </>
                ) : isVideographer ? (
                  <Link
                    to="/videographer"
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition ${
                      isActive('/videographer')
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <VideoCameraIcon className="w-5 h-5 mr-2" />
                    My Projects
                  </Link>
                ) : isEditor ? (
                  <Link
                    to="/editor"
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition ${
                      isActive('/editor')
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FilmIcon className="w-5 h-5 mr-2" />
                    My Projects
                  </Link>
                ) : isPostingManager ? (
                  <Link
                    to="/posting-manager"
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition ${
                      isActive('/posting-manager')
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <MegaphoneIcon className="w-5 h-5 mr-2" />
                    My Projects
                  </Link>
                ) : (
                  <Link
                    to="/analyses"
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition ${
                      isActive('/analyses')
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <HomeIcon className="w-5 h-5 mr-2" />
                    My Analyses
                  </Link>
                )}
              </div>
            </div>

            {/* User Profile & Menu */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                    <p className="text-xs text-gray-500">{profile?.role?.replace('_', ' ')}</p>
                  </div>
                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {(isAdmin || isCreator) && (
                      <button
                        onClick={() => {
                          navigate('/settings');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Cog6ToothIcon className="w-5 h-5 mr-3 text-gray-400" />
                        Settings
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3 text-gray-400" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
