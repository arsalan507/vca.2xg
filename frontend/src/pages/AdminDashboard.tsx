import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from '@/services/adminService';
import { profileService } from '@/services/profileService';
import { productionFilesService } from '@/services/productionFilesService';
import { assignmentService } from '@/services/assignmentService';
import { UserGroupIcon, DocumentTextIcon, CheckCircleIcon, XCircleIcon, ClockIcon, StarIcon, VideoCameraIcon, FilmIcon, MegaphoneIcon, FolderIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { ViralAnalysis, ReviewAnalysisData, ProductionFile, UpdateProductionStageData } from '@/types';
import { ProductionStage, FileType } from '@/types';
import ReviewScoreInput from '@/components/ReviewScoreInput';
import AssignTeamModal from '@/components/AssignTeamModal';

// Production In Progress View Component
function ProductionInProgressView({
  analyses,
  onViewDetails,
}: {
  analyses: ViralAnalysis[];
  onViewDetails: (analysis: ViralAnalysis) => void;
}) {
  const getStageColor = (stage?: string) => {
    switch (stage) {
      case ProductionStage.NOT_STARTED: return 'bg-gray-100 text-gray-800';
      case ProductionStage.PRE_PRODUCTION: return 'bg-blue-100 text-blue-800';
      case ProductionStage.SHOOTING: return 'bg-indigo-100 text-indigo-800';
      case ProductionStage.SHOOT_REVIEW: return 'bg-yellow-100 text-yellow-800';
      case ProductionStage.EDITING: return 'bg-purple-100 text-purple-800';
      case ProductionStage.EDIT_REVIEW: return 'bg-pink-100 text-pink-800';
      case ProductionStage.FINAL_REVIEW: return 'bg-orange-100 text-orange-800';
      case ProductionStage.READY_TO_POST: return 'bg-green-100 text-green-800';
      case ProductionStage.POSTED: return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12">
        <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-500">No projects in production</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Production Stage
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Videographer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Editor
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Posting Manager
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Updated
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {analyses.map((analysis) => (
            <tr key={analysis.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs">
                  {analysis.hook || 'No hook provided'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  by {analysis.full_name || 'Unknown'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStageColor(analysis.production_stage)}`}>
                  {analysis.production_stage?.replace(/_/g, ' ') || 'NOT STARTED'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {analysis.videographer ? (
                  <div className="flex items-center">
                    <VideoCameraIcon className="w-4 h-4 text-primary-600 mr-2" />
                    <div className="text-sm text-gray-900">
                      {analysis.videographer.full_name || analysis.videographer.email}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {analysis.editor ? (
                  <div className="flex items-center">
                    <FilmIcon className="w-4 h-4 text-purple-600 mr-2" />
                    <div className="text-sm text-gray-900">
                      {analysis.editor.full_name || analysis.editor.email}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {analysis.posting_manager ? (
                  <div className="flex items-center">
                    <MegaphoneIcon className="w-4 h-4 text-pink-600 mr-2" />
                    <div className="text-sm text-gray-900">
                      {analysis.posting_manager.full_name || analysis.posting_manager.email}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(analysis.updated_at || analysis.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onViewDetails(analysis)}
                  className="text-primary-600 hover:text-primary-900"
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Team Activity View Component
function TeamActivityView({ analyses }: { analyses: ViralAnalysis[] }) {
  // Get recent activities - projects with team assignments
  const recentActivities = analyses
    .filter(a => a.videographer || a.editor || a.posting_manager)
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 20);

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case ProductionStage.NOT_STARTED: return 'bg-gray-100 text-gray-800';
      case ProductionStage.PRE_PRODUCTION: return 'bg-blue-100 text-blue-800';
      case ProductionStage.SHOOTING: return 'bg-indigo-100 text-indigo-800';
      case ProductionStage.SHOOT_REVIEW: return 'bg-yellow-100 text-yellow-800';
      case ProductionStage.EDITING: return 'bg-purple-100 text-purple-800';
      case ProductionStage.EDIT_REVIEW: return 'bg-pink-100 text-pink-800';
      case ProductionStage.FINAL_REVIEW: return 'bg-orange-100 text-orange-800';
      case ProductionStage.READY_TO_POST: return 'bg-green-100 text-green-800';
      case ProductionStage.POSTED: return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (recentActivities.length === 0) {
    return (
      <div className="text-center py-12">
        <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-500">No team activities yet</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Team Activities</h3>
        <span className="text-sm text-gray-500">{recentActivities.length} active projects</span>
      </div>
      <div className="space-y-3">
        {recentActivities.map((analysis) => (
          <div
            key={analysis.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStageColor(analysis.production_stage)}`}>
                    {analysis.production_stage?.replace(/_/g, ' ') || 'NOT STARTED'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Updated {new Date(analysis.updated_at || analysis.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 mb-2">
                  {analysis.hook || 'No hook provided'}
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  Script by {analysis.full_name || 'Unknown'} • {analysis.target_emotion}
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  {analysis.videographer && (
                    <div className="flex items-center text-gray-700">
                      <VideoCameraIcon className="w-4 h-4 text-primary-600 mr-1" />
                      {analysis.videographer.full_name || analysis.videographer.email}
                    </div>
                  )}
                  {analysis.editor && (
                    <div className="flex items-center text-gray-700">
                      <FilmIcon className="w-4 h-4 text-purple-600 mr-1" />
                      {analysis.editor.full_name || analysis.editor.email}
                    </div>
                  )}
                  {analysis.posting_manager && (
                    <div className="flex items-center text-gray-700">
                      <MegaphoneIcon className="w-4 h-4 text-pink-600 mr-1" />
                      {analysis.posting_manager.full_name || analysis.posting_manager.email}
                    </div>
                  )}
                </div>
                {analysis.production_notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-600 italic">{analysis.production_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scripts' | 'production' | 'activity'>('scripts');
  const [reviewData, setReviewData] = useState<ReviewAnalysisData>({
    status: 'APPROVED',
    feedback: '',
    hookStrength: 5,
    contentQuality: 5,
    viralPotential: 5,
    replicationClarity: 5,
  });

  // Production approval state
  const [showProductionSection, setShowProductionSection] = useState(false);
  const [productionFeedback, setProductionFeedback] = useState('');
  const [selectedProductionStage, setSelectedProductionStage] = useState<string>('');

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminService.getDashboardStats,
  });

  // Fetch all analyses
  const { data: analyses, isLoading } = useQuery({
    queryKey: ['admin', 'analyses'],
    queryFn: adminService.getAllAnalyses,
  });

  // Fetch all users
  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: profileService.getAllProfiles,
  });

  // Fetch production files for selected analysis
  const { data: productionFiles = [] } = useQuery({
    queryKey: ['production-files', selectedAnalysis?.id],
    queryFn: () => productionFilesService.getFiles(selectedAnalysis!.id),
    enabled: !!selectedAnalysis?.id,
  });

  // Update analysis status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }) =>
      adminService.updateAnalysisStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('Analysis status updated');
      setIsViewModalOpen(false);
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Review analysis mutation (with scoring)
  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewAnalysisData }) =>
      adminService.reviewAnalysis(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('Analysis reviewed successfully');
      setIsReviewModalOpen(false);
      setIsViewModalOpen(false);
      // Reset review data
      setReviewData({
        status: 'APPROVED',
        feedback: '',
        hookStrength: 5,
        contentQuality: 5,
        viralPotential: 5,
        replicationClarity: 5,
      });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to review analysis');
    },
  });

  // Delete analysis mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteAnalysis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('Analysis deleted');
      setIsViewModalOpen(false);
    },
    onError: () => {
      toast.error('Failed to delete analysis');
    },
  });

  // Update production stage mutation (for admin approvals)
  const updateProductionStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductionStageData }) =>
      assignmentService.updateProductionStage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] });
      toast.success('Production stage updated successfully');
      setProductionFeedback('');
    },
    onError: () => {
      toast.error('Failed to update production stage');
    },
  });

  // Approve file mutation
  const approveFileMutation = useMutation({
    mutationFn: ({ fileId, notes }: { fileId: string; notes?: string }) =>
      productionFilesService.approveFile(fileId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File approved successfully!');
    },
    onError: () => {
      toast.error('Failed to approve file');
    },
  });

  // Reject file mutation
  const rejectFileMutation = useMutation({
    mutationFn: ({ fileId, notes }: { fileId: string; notes: string }) =>
      productionFilesService.rejectFile(fileId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File rejected');
    },
    onError: () => {
      toast.error('Failed to reject file');
    },
  });

  const openViewModal = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    setSelectedProductionStage(analysis.production_stage || ProductionStage.NOT_STARTED);
    setProductionFeedback(analysis.production_notes || '');
    setShowProductionSection(false);
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedAnalysis(null);
  };

  const openReviewModal = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    setIsReviewModalOpen(true);
    // Pre-fill with existing scores if already reviewed
    if (analysis.hook_strength) {
      setReviewData({
        status: analysis.status as 'APPROVED' | 'REJECTED',
        feedback: analysis.feedback || '',
        hookStrength: analysis.hook_strength,
        contentQuality: analysis.content_quality || 5,
        viralPotential: analysis.viral_potential || 5,
        replicationClarity: analysis.replication_clarity || 5,
      });
    }
  };

  const closeReviewModal = () => {
    setIsReviewModalOpen(false);
    setSelectedAnalysis(null);
    setReviewData({
      status: 'APPROVED',
      feedback: '',
      hookStrength: 5,
      contentQuality: 5,
      viralPotential: 5,
      replicationClarity: 5,
    });
  };

  const openAssignModal = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    setIsAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setIsAssignModalOpen(false);
    setSelectedAnalysis(null);
  };

  const handleApproveFile = (fileId: string) => {
    const notes = prompt('Add approval notes (optional):');
    approveFileMutation.mutate({ fileId, notes: notes || undefined });
  };

  const handleRejectFile = (fileId: string) => {
    const notes = prompt('Why are you rejecting this file? (required)');
    if (!notes || notes.trim() === '') {
      toast.error('Rejection reason is required');
      return;
    }
    rejectFileMutation.mutate({ fileId, notes });
  };

  const handleSubmitReview = () => {
    if (!selectedAnalysis) return;

    // Validate feedback for rejections
    if (reviewData.status === 'REJECTED' && !reviewData.feedback?.trim()) {
      toast.error('Feedback is required when rejecting an analysis');
      return;
    }

    reviewMutation.mutate({ id: selectedAnalysis.id, data: reviewData });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'REJECTED': return <XCircleIcon className="w-5 h-5 text-red-600" />;
      case 'PENDING': return <ClockIcon className="w-5 h-5 text-yellow-600" />;
      default: return null;
    }
  };

  const handleUpdateProductionStage = () => {
    if (!selectedAnalysis) return;

    updateProductionStageMutation.mutate({
      id: selectedAnalysis.id,
      data: {
        production_stage: selectedProductionStage as any,
        production_notes: productionFeedback,
      },
    });
  };

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case ProductionStage.NOT_STARTED: return 'bg-gray-100 text-gray-800';
      case ProductionStage.PRE_PRODUCTION: return 'bg-blue-100 text-blue-800';
      case ProductionStage.SHOOTING: return 'bg-indigo-100 text-indigo-800';
      case ProductionStage.SHOOT_REVIEW: return 'bg-yellow-100 text-yellow-800';
      case ProductionStage.EDITING: return 'bg-purple-100 text-purple-800';
      case ProductionStage.EDIT_REVIEW: return 'bg-pink-100 text-pink-800';
      case ProductionStage.FINAL_REVIEW: return 'bg-orange-100 text-orange-800';
      case ProductionStage.READY_TO_POST: return 'bg-green-100 text-green-800';
      case ProductionStage.POSTED: return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFileTypeBadge = (type: string) => {
    switch (type) {
      case FileType.RAW_FOOTAGE: return 'bg-blue-100 text-blue-800';
      case FileType.EDITED_VIDEO: return 'bg-green-100 text-green-800';
      case FileType.FINAL_VIDEO: return 'bg-purple-100 text-purple-800';
      case FileType.ASSET: return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage all viral content analyses and users
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats?.totalUsers || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Analyses</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats?.totalAnalyses || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DocumentTextIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats?.pendingAnalyses || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats?.approvedAnalyses || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 px-6">
            <button
              onClick={() => setActiveTab('scripts')}
              className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'scripts'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              All Scripts ({analyses?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('production')}
              className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'production'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <VideoCameraIcon className="w-5 h-5 mr-2" />
              Production In Progress
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'activity'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ClockIcon className="w-5 h-5 mr-2" />
              Team Activity
            </button>
          </div>
        </div>

        {/* Scripts Tab */}
        {activeTab === 'scripts' && (
          <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : analyses && analyses.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hook
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Emotion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyses.map((analysis) => (
                  <tr key={analysis.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-700">
                            {analysis.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{analysis.full_name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{analysis.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 line-clamp-2 max-w-xs">
                        {analysis.hook || 'No hook provided'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{analysis.target_emotion}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{analysis.expected_outcome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                        {analysis.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(analysis.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openViewModal(analysis)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No analyses found</p>
            </div>
          )}
          </div>
        )}

        {/* Production Tab */}
        {activeTab === 'production' && (
          <ProductionInProgressView
            analyses={analyses?.filter(a =>
              a.status === 'APPROVED' &&
              a.production_stage &&
              a.production_stage !== ProductionStage.POSTED
            ) || []}
            onViewDetails={openViewModal}
          />
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <TeamActivityView
            analyses={analyses || []}
          />
        )}
      </div>

      {/* View/Edit Modal */}
      {isViewModalOpen && selectedAnalysis && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeViewModal}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Analysis Details</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Submitted by {selectedAnalysis.full_name} on {new Date(selectedAnalysis.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(selectedAnalysis.status)}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedAnalysis.status)}`}>
                      {selectedAnalysis.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Reference URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reference Link</label>
                    <a
                      href={selectedAnalysis.reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 underline break-all"
                    >
                      {selectedAnalysis.reference_url}
                    </a>
                  </div>

                  {/* Hook */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hook (First 6 Seconds)</label>
                    {selectedAnalysis.hook && (
                      <p className="text-gray-900 mb-3">{selectedAnalysis.hook}</p>
                    )}
                    {selectedAnalysis.hook_voice_note_url && (
                      <audio controls className="w-full">
                        <source src={selectedAnalysis.hook_voice_note_url} type="audio/webm" />
                      </audio>
                    )}
                  </div>

                  {/* Why Viral */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Why Did It Go Viral?</label>
                    {selectedAnalysis.why_viral && (
                      <p className="text-gray-900 mb-3">{selectedAnalysis.why_viral}</p>
                    )}
                    {selectedAnalysis.why_viral_voice_note_url && (
                      <audio controls className="w-full">
                        <source src={selectedAnalysis.why_viral_voice_note_url} type="audio/webm" />
                      </audio>
                    )}
                  </div>

                  {/* How to Replicate */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">How to Replicate</label>
                    {selectedAnalysis.how_to_replicate && (
                      <p className="text-gray-900 mb-3">{selectedAnalysis.how_to_replicate}</p>
                    )}
                    {selectedAnalysis.how_to_replicate_voice_note_url && (
                      <audio controls className="w-full">
                        <source src={selectedAnalysis.how_to_replicate_voice_note_url} type="audio/webm" />
                      </audio>
                    )}
                  </div>

                  {/* Target Emotion & Expected Outcome */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Target Emotion</label>
                      <p className="text-gray-900 font-medium">{selectedAnalysis.target_emotion}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Expected Outcome</label>
                      <p className="text-gray-900 font-medium">{selectedAnalysis.expected_outcome}</p>
                    </div>
                  </div>

                  {/* Production Details Section - NEW EXCEL FIELDS */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <VideoCameraIcon className="w-5 h-5 text-primary-600 mr-2" />
                      Production Details
                    </h3>
                    <div className="space-y-4">
                      {/* On-Screen Text Hook */}
                      {selectedAnalysis.on_screen_text_hook && (
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                          <label className="block text-sm font-medium text-gray-700 mb-2">On-Screen Text Hook</label>
                          <p className="text-gray-900">{selectedAnalysis.on_screen_text_hook}</p>
                        </div>
                      )}

                      {/* Our Idea Audio */}
                      {selectedAnalysis.our_idea_audio_url && (
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Our Idea (Voice Note)</label>
                          <audio controls className="w-full">
                            <source src={selectedAnalysis.our_idea_audio_url} type="audio/webm" />
                          </audio>
                        </div>
                      )}

                      {/* Shoot Location & Possibility */}
                      <div className="grid grid-cols-2 gap-4">
                        {selectedAnalysis.shoot_location && (
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Shoot Location</label>
                            <p className="text-gray-900 font-medium">{selectedAnalysis.shoot_location}</p>
                          </div>
                        )}
                        {selectedAnalysis.shoot_possibility && (
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Shoot Possibility</label>
                            <p className="text-gray-900 font-medium">{selectedAnalysis.shoot_possibility}% Confidence</p>
                          </div>
                        )}
                      </div>

                      {/* Total People Involved */}
                      {selectedAnalysis.total_people_involved && (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Total People Involved</label>
                          <p className="text-gray-900 font-medium">{selectedAnalysis.total_people_involved} people</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Review Scores (if reviewed) */}
                  {selectedAnalysis.overall_score && (
                    <div className="bg-gradient-to-r from-primary-50 to-purple-50 p-6 rounded-lg border border-primary-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <StarIconSolid className="w-5 h-5 text-yellow-500 mr-2" />
                        Review Scores
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary-600">{selectedAnalysis.hook_strength}</div>
                          <div className="text-xs text-gray-600 mt-1">Hook Strength</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-purple-600">{selectedAnalysis.content_quality}</div>
                          <div className="text-xs text-gray-600 mt-1">Content Quality</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-pink-600">{selectedAnalysis.viral_potential}</div>
                          <div className="text-xs text-gray-600 mt-1">Viral Potential</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">{selectedAnalysis.replication_clarity}</div>
                          <div className="text-xs text-gray-600 mt-1">Replication Clarity</div>
                        </div>
                        <div className="text-center bg-white rounded-lg p-2">
                          <div className="text-4xl font-bold text-green-600">{selectedAnalysis.overall_score}</div>
                          <div className="text-xs text-gray-600 mt-1 font-semibold">Overall Score</div>
                        </div>
                      </div>
                      {selectedAnalysis.feedback && (
                        <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                          <div className="text-xs font-medium text-gray-500 mb-1">Admin Feedback:</div>
                          <p className="text-sm text-gray-700">{selectedAnalysis.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assigned Team (if approved) */}
                  {selectedAnalysis.status === 'APPROVED' && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                        <UserGroupIcon className="w-5 h-5 mr-2 text-primary-600" />
                        Production Team
                      </h3>
                      {(selectedAnalysis.videographer || selectedAnalysis.editor || selectedAnalysis.posting_manager) ? (
                        <div className="space-y-2">
                          {selectedAnalysis.videographer && (
                            <div className="flex items-center text-sm">
                              <VideoCameraIcon className="w-4 h-4 text-primary-600 mr-2" />
                              <span className="font-medium text-gray-700">Videographer:</span>
                              <span className="ml-2 text-gray-900">{selectedAnalysis.videographer.full_name || selectedAnalysis.videographer.email}</span>
                            </div>
                          )}
                          {selectedAnalysis.editor && (
                            <div className="flex items-center text-sm">
                              <FilmIcon className="w-4 h-4 text-purple-600 mr-2" />
                              <span className="font-medium text-gray-700">Editor:</span>
                              <span className="ml-2 text-gray-900">{selectedAnalysis.editor.full_name || selectedAnalysis.editor.email}</span>
                            </div>
                          )}
                          {selectedAnalysis.posting_manager && (
                            <div className="flex items-center text-sm">
                              <MegaphoneIcon className="w-4 h-4 text-pink-600 mr-2" />
                              <span className="font-medium text-gray-700">Posting Manager:</span>
                              <span className="ml-2 text-gray-900">{selectedAnalysis.posting_manager.full_name || selectedAnalysis.posting_manager.email}</span>
                            </div>
                          )}
                          {selectedAnalysis.production_stage && (
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <span className="text-xs font-medium text-gray-600">Production Stage: </span>
                              <span className="text-xs font-semibold text-primary-700">{selectedAnalysis.production_stage}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">No team assigned yet</p>
                      )}
                    </div>
                  )}

                  {/* Production Files & Stage Management (if team assigned) */}
                  {selectedAnalysis.status === 'APPROVED' && (selectedAnalysis.videographer || selectedAnalysis.editor) && (
                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                            <FolderIcon className="w-6 h-6 mr-2 text-primary-600" />
                            Production Files & Progress
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">Review files and manage production stages</p>
                        </div>
                        <button
                          onClick={() => setShowProductionSection(!showProductionSection)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          {showProductionSection ? 'Hide' : 'Show'} Files
                        </button>
                      </div>

                      {/* Current Production Stage */}
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-200 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Current Stage:</span>
                            <span className={`ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStageColor(selectedAnalysis.production_stage)}`}>
                              {selectedAnalysis.production_stage?.replace(/_/g, ' ') || 'NOT STARTED'}
                            </span>
                          </div>
                          {selectedAnalysis.production_notes && (
                            <button
                              onClick={() => setShowProductionSection(!showProductionSection)}
                              className="text-xs text-indigo-600 hover:text-indigo-700"
                            >
                              View Notes
                            </button>
                          )}
                        </div>
                        {selectedAnalysis.production_notes && showProductionSection && (
                          <div className="mt-3 pt-3 border-t border-indigo-200">
                            <p className="text-sm text-gray-700">{selectedAnalysis.production_notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Production Files List */}
                      {showProductionSection && (
                        <div className="space-y-4">
                          {/* Files grouped by type */}
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Uploaded Files ({productionFiles.length})</h4>
                            {productionFiles.length > 0 ? (
                              <div className="space-y-2">
                                {productionFiles.map((file: ProductionFile) => (
                                  <div key={file.id} className={`p-3 rounded-lg border-2 ${
                                    file.approval_status === 'approved' ? 'bg-green-50 border-green-200' :
                                    file.approval_status === 'rejected' ? 'bg-red-50 border-red-200' :
                                    'bg-gray-50 border-gray-200'
                                  }`}>
                                    <div className="flex items-start justify-between space-x-3">
                                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                          <FilmIcon className="w-4 h-4 text-primary-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getFileTypeBadge(file.file_type)}`}>
                                              {file.file_type.replace(/_/g, ' ')}
                                            </span>
                                            {file.approval_status === 'approved' && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircleIcon className="w-3 h-3 mr-1" />
                                                Approved
                                              </span>
                                            )}
                                            {file.approval_status === 'rejected' && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                <XCircleIcon className="w-3 h-3 mr-1" />
                                                Rejected
                                              </span>
                                            )}
                                            {(!file.approval_status || file.approval_status === 'pending') && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                <ClockIcon className="w-3 h-3 mr-1" />
                                                Pending Review
                                              </span>
                                            )}
                                          </div>
                                          {file.description && (
                                            <p className="text-xs text-gray-600 mt-0.5">{file.description}</p>
                                          )}
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            By {file.uploader?.full_name || file.uploader?.email || 'Unknown'} • {new Date(file.created_at).toLocaleDateString()}
                                          </p>
                                          {file.review_notes && (
                                            <div className="mt-2 bg-white bg-opacity-60 p-2 rounded text-xs">
                                              <p className="font-medium text-gray-700">Review Notes:</p>
                                              <p className="text-gray-600 mt-0.5">{file.review_notes}</p>
                                              {file.reviewer && (
                                                <p className="text-gray-500 mt-1">
                                                  — {file.reviewer.full_name || file.reviewer.email}
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-col space-y-2 flex-shrink-0">
                                        <a
                                          href={file.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap"
                                        >
                                          <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                                          View
                                        </a>
                                        {file.approval_status !== 'approved' && (
                                          <button
                                            onClick={() => handleApproveFile(file.id)}
                                            disabled={approveFileMutation.isPending}
                                            className="inline-flex items-center justify-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                                          >
                                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                                            Approve
                                          </button>
                                        )}
                                        {file.approval_status !== 'rejected' && (
                                          <button
                                            onClick={() => handleRejectFile(file.id)}
                                            disabled={rejectFileMutation.isPending}
                                            className="inline-flex items-center justify-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                                          >
                                            <XCircleIcon className="w-4 h-4 mr-1" />
                                            Reject
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 text-center py-4">No files uploaded yet</p>
                            )}
                          </div>

                          {/* Update Production Stage */}
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Update Production Stage</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">New Stage</label>
                                <select
                                  value={selectedProductionStage}
                                  onChange={(e) => setSelectedProductionStage(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value={ProductionStage.NOT_STARTED}>Not Started</option>
                                  <option value={ProductionStage.PRE_PRODUCTION}>Pre-Production</option>
                                  <option value={ProductionStage.SHOOTING}>Shooting</option>
                                  <option value={ProductionStage.SHOOT_REVIEW}>Shoot Review (Admin Approval)</option>
                                  <option value={ProductionStage.EDITING}>Editing</option>
                                  <option value={ProductionStage.EDIT_REVIEW}>Edit Review (Admin Approval)</option>
                                  <option value={ProductionStage.FINAL_REVIEW}>Final Review (Admin Approval)</option>
                                  <option value={ProductionStage.READY_TO_POST}>Ready to Post</option>
                                  <option value={ProductionStage.POSTED}>Posted</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Stage Notes / Feedback</label>
                                <textarea
                                  value={productionFeedback}
                                  onChange={(e) => setProductionFeedback(e.target.value)}
                                  rows={3}
                                  placeholder="Add notes about this stage, feedback for the team, or approval comments..."
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                                />
                              </div>

                              <button
                                onClick={handleUpdateProductionStage}
                                disabled={updateProductionStageMutation.isPending}
                                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                              >
                                {updateProductionStageMutation.isPending ? (
                                  <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                                    Update Production Stage
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div className="border-t pt-6 space-y-3">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Admin Actions</h3>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          closeViewModal();
                          openReviewModal(selectedAnalysis);
                        }}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center"
                      >
                        <StarIcon className="w-5 h-5 mr-2" />
                        {selectedAnalysis.overall_score ? 'Update Review' : 'Review & Score'}
                      </button>
                      {selectedAnalysis.status === 'APPROVED' && (
                        <button
                          onClick={() => {
                            closeViewModal();
                            openAssignModal(selectedAnalysis);
                          }}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center"
                        >
                          <UserGroupIcon className="w-5 h-5 mr-2" />
                          {selectedAnalysis.videographer ? 'Update Team' : 'Assign Team'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this analysis? This action cannot be undone.')) {
                            deleteMutation.mutate(selectedAnalysis.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeViewModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal with Scoring */}
      {isReviewModalOpen && selectedAnalysis && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeReviewModal}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <StarIcon className="w-7 h-7 text-yellow-500 mr-2" />
                      Review & Score Analysis
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Submitted by {selectedAnalysis.full_name} • {new Date(selectedAnalysis.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={closeReviewModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Decision */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-3">Decision</label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setReviewData({ ...reviewData, status: 'APPROVED' })}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                          reviewData.status === 'APPROVED'
                            ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-2'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => setReviewData({ ...reviewData, status: 'REJECTED' })}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                          reviewData.status === 'REJECTED'
                            ? 'bg-red-600 text-white ring-2 ring-red-600 ring-offset-2'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>

                  {/* Scoring Criteria */}
                  <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">Scoring Criteria (1-10)</h3>

                    <ReviewScoreInput
                      label="Hook Strength"
                      description="How compelling and attention-grabbing is the hook?"
                      value={reviewData.hookStrength}
                      onChange={(value) => setReviewData({ ...reviewData, hookStrength: value })}
                    />

                    <ReviewScoreInput
                      label="Content Quality"
                      description="Overall quality of the analysis and explanation"
                      value={reviewData.contentQuality}
                      onChange={(value) => setReviewData({ ...reviewData, contentQuality: value })}
                    />

                    <ReviewScoreInput
                      label="Viral Potential"
                      description="How likely is this strategy to actually work?"
                      value={reviewData.viralPotential}
                      onChange={(value) => setReviewData({ ...reviewData, viralPotential: value })}
                    />

                    <ReviewScoreInput
                      label="Replication Clarity"
                      description="How clear and actionable are the replication steps?"
                      value={reviewData.replicationClarity}
                      onChange={(value) => setReviewData({ ...reviewData, replicationClarity: value })}
                    />

                    {/* Overall Score Preview */}
                    <div className="pt-4 border-t border-gray-300">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Overall Score (Average):</span>
                        <span className="text-3xl font-bold text-primary-600">
                          {((reviewData.hookStrength + reviewData.contentQuality + reviewData.viralPotential + reviewData.replicationClarity) / 4).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Feedback {reviewData.status === 'REJECTED' && <span className="text-red-600">*</span>}
                    </label>
                    <textarea
                      value={reviewData.feedback}
                      onChange={(e) => setReviewData({ ...reviewData, feedback: e.target.value })}
                      rows={4}
                      placeholder={reviewData.status === 'REJECTED' ? 'Feedback is required when rejecting...' : 'Optional feedback for the script writer...'}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        reviewData.status === 'REJECTED' && !reviewData.feedback?.trim()
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    {reviewData.status === 'REJECTED' && !reviewData.feedback?.trim() && (
                      <p className="mt-1 text-sm text-red-600">Feedback is required when rejecting an analysis</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      onClick={closeReviewModal}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewMutation.isPending}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
                    >
                      {reviewMutation.isPending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <StarIcon className="w-5 h-5 mr-2" />
                          Submit Review
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Team Modal */}
      {isAssignModalOpen && selectedAnalysis && (
        <AssignTeamModal
          analysis={selectedAnalysis}
          isOpen={isAssignModalOpen}
          onClose={closeAssignModal}
        />
      )}
    </div>
  );
}
