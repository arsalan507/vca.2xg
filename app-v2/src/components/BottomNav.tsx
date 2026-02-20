import { Link, useLocation } from 'react-router-dom';
import { Home, FolderOpen, CheckCircle, Plus, FileText, Users, Video } from 'lucide-react';
import type { UserRole } from '@/types';

interface BottomNavProps {
  role: UserRole;
}

export default function BottomNav({ role }: BottomNavProps) {
  const location = useLocation();

  // Normalize role to lowercase for comparison
  const normalizedRole = role?.toLowerCase();

  // Different nav items based on role
  const getNavItems = () => {
    switch (normalizedRole) {
      case 'script_writer':
        return [
          { icon: Home, label: 'Home', href: '/writer' },
          { icon: FolderOpen, label: 'Scripts', href: '/writer/scripts' },
        ];
      case 'videographer':
        return [
          { icon: Home, label: 'Home', href: '/videographer' },
          { icon: FolderOpen, label: 'Available', href: '/videographer/available' },
          { icon: CheckCircle, label: 'Shoots', href: '/videographer/my-projects' },
        ];
      case 'editor':
        return [
          { icon: Home, label: 'Home', href: '/editor' },
          { icon: FolderOpen, label: 'Queue', href: '/editor/my-projects' },
          { icon: CheckCircle, label: 'Done', href: '/editor/completed' },
        ];
      case 'posting_manager':
        return [
          { icon: Home, label: 'Home', href: '/posting' },
          { icon: FolderOpen, label: 'To Post', href: '/posting/to-post' },
          { icon: CheckCircle, label: 'Posted', href: '/posting/posted' },
        ];
      case 'admin':
      case 'super_admin':
        return [
          { icon: Home, label: 'Home', href: '/admin' },
          { icon: FileText, label: 'Pending', href: '/admin/pending' },
          { icon: Video, label: 'Edited', href: '/admin/edited-review' },
          { icon: Users, label: 'Team', href: '/admin/team' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  // Get FAB action based on role
  const getFabAction = () => {
    switch (normalizedRole) {
      case 'script_writer':
        return { href: '/writer/new', icon: Plus };
      case 'videographer':
        return { href: '/videographer/new-script', icon: Plus };
      case 'editor':
        return { href: '/editor/available', icon: Plus };
      case 'admin':
      case 'super_admin':
        return { href: '/admin/new-script', icon: Plus };
      default:
        return null;
    }
  };

  const fabAction = getFabAction();

  // If no FAB, render all items evenly
  if (!fabAction) {
    return (
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 z-50">
        <div className="flex items-center justify-evenly px-4 py-2 pb-safe">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center gap-0.5 p-2 min-w-[64px] transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-400'
                }`}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  // With FAB - split items around center FAB
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 z-50">
      <div className="flex items-center justify-around px-4 py-2 pb-safe relative">
        {/* Left nav items */}
        <div className="flex flex-1 justify-evenly">
          {navItems.slice(0, Math.ceil(navItems.length / 2)).map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center gap-0.5 p-2 min-w-[64px] transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-400'
                }`}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* FAB button */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-7">
          <Link
            to={fabAction.href}
            className="w-14 h-14 rounded-full bg-gradient-primary text-white shadow-lg flex items-center justify-center btn-press"
          >
            <fabAction.icon className="w-7 h-7" />
          </Link>
        </div>

        {/* Spacer for FAB */}
        <div className="w-14 shrink-0" />

        {/* Right nav items */}
        <div className="flex flex-1 justify-evenly">
          {navItems.slice(Math.ceil(navItems.length / 2)).map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center gap-0.5 p-2 min-w-[64px] transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-400'
                }`}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
