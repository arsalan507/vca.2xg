/**
 * Analysis Table Page - Notion-Style Admin View
 *
 * Full-page view for viewing all analyses from a specific script writer
 * or all analyses in the system. Features:
 * - Horizontal scroll data grid
 * - Status filter tabs
 * - Side drawer for details
 * - Approve/Reject functionality
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { adminService } from '@/services/adminService';
import {
  ArrowLeftIcon,
  FunnelIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import AnalysisDataGrid from '@/components/admin/AnalysisDataGrid';
import AnalysisSideDrawer from '@/components/admin/AnalysisSideDrawer';
import AssignTeamModal from '@/components/AssignTeamModal';
import type { ViralAnalysis, ReviewAnalysisData } from '@/types';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_TABS: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'ALL', label: 'All', color: 'bg-gray-100 text-gray-800' },
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'APPROVED', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-100 text-red-800' },
];

export default function AnalysisTablePage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [analysisToAssign, setAnalysisToAssign] = useState<ViralAnalysis | null>(null);

  // Fetch analyses - either for specific user or all
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['admin', 'analyses-table', userId],
    queryFn: async () => {
      // Use adminService which fetches ALL fields including tags
      const allAnalyses = await adminService.getAllAnalyses();

      // Filter by user if userId is provided
      if (userId) {
        return allAnalyses.filter(analysis => analysis.user_id === userId);
      }

      return allAnalyses;
    },
  });

  // Fetch user info if userId provided
  const { data: userInfo } = useQuery({
    queryKey: ['user-info', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (data: { id: string; reviewData: ReviewAnalysisData }) =>
      adminService.reviewAnalysis(data.id, data.reviewData),
    onSuccess: (updatedAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses-table'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
      toast.success('Analysis approved!');
      setIsDrawerOpen(false);
      setSelectedAnalysis(null);
      // Open team assignment modal
      setAnalysisToAssign(updatedAnalysis);
      setShowAssignModal(true);
    },
    onError: () => {
      toast.error('Failed to approve analysis');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (data: { id: string; reviewData: ReviewAnalysisData }) =>
      adminService.reviewAnalysis(data.id, data.reviewData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses-table'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
      toast.success('Analysis rejected');
      setIsDrawerOpen(false);
      setSelectedAnalysis(null);
    },
    onError: () => {
      toast.error('Failed to reject analysis');
    },
  });

  // Disapprove mutation (for approved scripts)
  const disapproveMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) =>
      adminService.disapproveScript(data.id, data.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses-table'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'approved-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
      toast.success('Script disapproved and sent back to pending');
      setIsDrawerOpen(false);
      setSelectedAnalysis(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to disapprove script');
    },
  });

  // Filter analyses
  const filteredAnalyses = useMemo(() => {
    let filtered = analyses;

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((a: ViralAnalysis) => a.status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a: ViralAnalysis) =>
          a.content_id?.toLowerCase().includes(term) ||
          a.hook?.toLowerCase().includes(term) ||
          a.full_name?.toLowerCase().includes(term) ||
          a.target_emotion?.toLowerCase().includes(term) ||
          a.expected_outcome?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [analyses, statusFilter, searchTerm]);

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      ALL: analyses.length,
      PENDING: analyses.filter((a: ViralAnalysis) => a.status === 'PENDING').length,
      APPROVED: analyses.filter((a: ViralAnalysis) => a.status === 'APPROVED').length,
      REJECTED: analyses.filter((a: ViralAnalysis) => a.status === 'REJECTED').length,
    };
  }, [analyses]);

  const handleRowClick = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    setIsDrawerOpen(true);
  };

  const handleApprove = (data: ReviewAnalysisData) => {
    if (!selectedAnalysis) return;
    approveMutation.mutate({ id: selectedAnalysis.id, reviewData: data });
  };

  const handleReject = (data: ReviewAnalysisData) => {
    if (!selectedAnalysis) return;
    rejectMutation.mutate({ id: selectedAnalysis.id, reviewData: data });
  };

  const handleDisapprove = (reason: string) => {
    if (!selectedAnalysis) return;
    disapproveMutation.mutate({ id: selectedAnalysis.id, reason });
  };

  const handleQuickApprove = (analysis: ViralAnalysis) => {
    approveMutation.mutate({
      id: analysis.id,
      reviewData: {
        status: 'APPROVED',
        hookStrength: 7,
        contentQuality: 7,
        viralPotential: 7,
        replicationClarity: 7,
      },
    });
  };

  const handleQuickReject = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <TableCellsIcon className="w-6 h-6 mr-2 text-primary-600" />
                {userId && userInfo
                  ? `${userInfo.full_name || userInfo.email}'s Analyses`
                  : 'All Analyses'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {filteredAnalyses.length} of {analyses.length} analyses
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, hook, name..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-2">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  statusFilter === tab.value
                    ? `${tab.color} shadow-sm`
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">
                  ({statusCounts[tab.value]})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full overflow-auto">
          <AnalysisDataGrid
            analyses={filteredAnalyses}
            isLoading={isLoading}
            onRowClick={handleRowClick}
            onApprove={handleQuickApprove}
            onReject={handleQuickReject}
            showActions={true}
          />
        </div>
      </div>

      {/* Side Drawer */}
      <AnalysisSideDrawer
        analysis={selectedAnalysis}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedAnalysis(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        onDisapprove={handleDisapprove}
        isSubmitting={approveMutation.isPending || rejectMutation.isPending || disapproveMutation.isPending}
      />

      {/* Assign Team Modal */}
      {showAssignModal && analysisToAssign && (
        <AssignTeamModal
          analysis={analysisToAssign}
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setAnalysisToAssign(null);
          }}
        />
      )}
    </div>
  );
}
