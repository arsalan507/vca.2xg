import { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import NeedApprovalPage from './admin/NeedApprovalPage';
import TeamMembersPage from './admin/TeamMembersPage';
import ProductionStatusPage from './admin/ProductionStatusPage';

export default function AdminDashboard() {
  const [selectedPage, setSelectedPage] = useState<'team' | 'approval' | 'production'>('approval');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <AdminSidebar
        selectedPage={selectedPage}
        onPageChange={setSelectedPage}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPage === 'team' && <TeamMembersPage />}
        {selectedPage === 'approval' && <NeedApprovalPage />}
        {selectedPage === 'production' && <ProductionStatusPage />}
      </div>
    </div>
  );
}
