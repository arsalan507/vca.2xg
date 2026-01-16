/**
 * Admin Dashboard - Notion-Inspired Mobile-Responsive Layout
 *
 * Mobile-first design with:
 * - Hamburger menu on mobile
 * - Fixed sidebar on desktop (224px / Notion width)
 * - Touch-friendly button sizes (44px minimum)
 * - Backdrop overlay on mobile
 * - Smooth transitions
 */

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import NeedApprovalPage from './admin/NeedApprovalPage';
import TeamMembersPage from './admin/TeamMembersPage';
import ProductionStatusPage from './admin/ProductionStatusPage';

export default function AdminDashboard() {
  const [selectedPage, setSelectedPage] = useState<'team' | 'approval' | 'production'>('approval');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    const handleResize = () => {
      // Auto-close sidebar on desktop
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePageChange = (page: 'team' | 'approval' | 'production') => {
    setSelectedPage(page);
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <AdminSidebar
        selectedPage={selectedPage}
        onPageChange={handlePageChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden pt-[56px] md:pt-0">
        {selectedPage === 'team' && <TeamMembersPage />}
        {selectedPage === 'approval' && <NeedApprovalPage />}
        {selectedPage === 'production' && <ProductionStatusPage />}
      </div>
    </div>
  );
}
