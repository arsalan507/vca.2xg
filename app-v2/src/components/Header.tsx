import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showLogout?: boolean;
  rightAction?: React.ReactNode;
}

export default function Header({ title, subtitle, showBack, showLogout, rightAction }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();

  const handleBack = () => {
    navigate(-1);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSettings = () => {
    // Get the base path for the current role's section
    const pathParts = location.pathname.split('/');
    const roleBase = pathParts[1]; // e.g., 'writer', 'admin', 'videographer'
    if (roleBase) {
      navigate(`/${roleBase}/settings`);
    }
  };

  // Get user initials
  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  // Check if we're already on settings page
  const isSettingsPage = location.pathname.endsWith('/settings');

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-4">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {rightAction}
          {showLogout && (
            <button
              onClick={handleLogout}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          )}
          {!showBack && !showLogout && !isSettingsPage && (
            <button
              onClick={handleSettings}
              className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm active:opacity-90 transition-opacity"
              title="Settings"
            >
              {initials}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
