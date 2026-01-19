import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { adminService } from '@/services/adminService';
import { productionFilesService } from '@/services/productionFilesService';
import { assignmentService } from '@/services/assignmentService';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { ViralAnalysis, ProductionFile, ReviewAnalysisData, UpdateProductionStageData } from '@/types';
import { DocumentTextIcon, VideoCameraIcon, FilmIcon, CheckCircleIcon, XCircleIcon, EyeIcon, ExclamationTriangleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AssignTeamModal from '@/components/AssignTeamModal';
import RejectScriptModal from '@/components/admin/RejectScriptModal';
import AnalysisSideDrawer from '@/components/admin/AnalysisSideDrawer';

export default function NeedApprovalPage() {
  const queryClient = useQueryClient();
  const [selectedScript, setSelectedScript] = useState<ViralAnalysis | null>(null);
  const [selectedShoot, setSelectedShoot] = useState<ViralAnalysis | null>(null);
  const [selectedEdit, setSelectedEdit] = useState<ViralAnalysis | null>(null);
  const [selectedApprovedScript, setSelectedApprovedScript] = useState<ViralAnalysis | null>(null);
  const [showAssignTeamModal, setShowAssignTeamModal] = useState(false);
  const [showPendingDrawer, setShowPendingDrawer] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApprovedDrawer, setShowApprovedDrawer] = useState(false);
  const [pendingScriptSearch, setPendingScriptSearch] = useState('');
  const [approvedScriptSearch, setApprovedScriptSearch] = useState('');

  // Fetch pending scripts
  const { data: pendingScripts = [], isLoading: scriptsLoading } = useQuery({
    queryKey: ['admin', 'pending-scripts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (email, full_name, avatar_url)
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data.map((item: any) => ({
        ...item,
        email: item.profiles?.email,
        full_name: item.profiles?.full_name,
        avatar_url: item.profiles?.avatar_url,
      }));
    },
  });

  // Fetch shoots awaiting review
  const { data: shootReviews = [], isLoading: shootsLoading } = useQuery({
    queryKey: ['admin', 'shoot-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (email, full_name, avatar_url),
          assignments:project_assignments (
            *,
            user:profiles!project_assignments_user_id_fkey (id, email, full_name, avatar_url, role)
          )
        `)
        .eq('production_stage', 'SHOOT_REVIEW')
        .order('updated_at', { ascending: true });

      if (error) throw error;

      return data.map((item: any) => ({
        ...item,
        email: item.profiles?.email,
        full_name: item.profiles?.full_name,
        avatar_url: item.profiles?.avatar_url,
        videographer: item.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      }));
    },
  });

  // Fetch edits awaiting review
  const { data: editReviews = [], isLoading: editsLoading } = useQuery({
    queryKey: ['admin', 'edit-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (email, full_name, avatar_url),
          assignments:project_assignments (
            *,
            user:profiles!project_assignments_user_id_fkey (id, email, full_name, avatar_url, role)
          )
        `)
        .eq('production_stage', 'EDIT_REVIEW')
        .order('updated_at', { ascending: true });

      if (error) throw error;

      return data.map((item: any) => ({
        ...item,
        email: item.profiles?.email,
        full_name: item.profiles?.full_name,
        avatar_url: item.profiles?.avatar_url,
        editor: item.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      }));
    },
  });

  // Fetch files for selected shoot
  const { data: shootFiles = [] } = useQuery({
    queryKey: ['production-files', selectedShoot?.id],
    queryFn: () => productionFilesService.getFiles(selectedShoot!.id),
    enabled: !!selectedShoot?.id,
  });

  // Fetch all approved scripts (for viewing/disapproving)
  const { data: approvedScripts = [], isLoading: approvedLoading } = useQuery({
    queryKey: ['admin', 'approved-scripts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (email, full_name, avatar_url),
          assignments:project_assignments (
            *,
            videographer:profiles!project_assignments_videographer_id_fkey (id, email, full_name, avatar_url),
            editor:profiles!project_assignments_editor_id_fkey (id, email, full_name, avatar_url),
            posting_manager:profiles!project_assignments_posting_manager_id_fkey (id, email, full_name, avatar_url)
          )
        `)
        .eq('status', 'APPROVED')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return data.map((item: any) => ({
        ...item,
        email: item.profiles?.email,
        full_name: item.profiles?.full_name,
        avatar_url: item.profiles?.avatar_url,
      }));
    },
  });

  // Approve script mutation
  const approveScriptMutation = useMutation({
    mutationFn: (data: ReviewAnalysisData) => adminService.reviewAnalysis(selectedScript!.id, data),
    onSuccess: (updatedAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
      toast.success('Script approved! Assign team members now.');
      setSelectedScript(null);
      // Open team assignment modal
      setSelectedScript(updatedAnalysis);
      setShowAssignTeamModal(true);
    },
    onError: () => {
      toast.error('Failed to approve script');
    },
  });

  // Reject script mutation
  const rejectScriptMutation = useMutation({
    mutationFn: (data: ReviewAnalysisData) => adminService.reviewAnalysis(selectedScript!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
      toast.success('Script rejected');
      setSelectedScript(null);
    },
    onError: () => {
      toast.error('Failed to reject script');
    },
  });

  // Approve shoot mutation
  const approveShootMutation = useMutation({
    mutationFn: (data: UpdateProductionStageData) =>
      assignmentService.updateProductionStage(selectedShoot!.id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shoot-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });

      // Show appropriate message based on the stage transition
      if (variables.production_stage === 'EDITING') {
        toast.success('Shoot approved! Moving to editing stage.');
      } else if (variables.production_stage === 'SHOOTING') {
        toast.success('Reshoot requested. Videographer has been notified.');
      }

      setSelectedShoot(null);
    },
    onError: () => {
      toast.error('Failed to update shoot status');
    },
  });

  // Approve edit mutation
  const approveEditMutation = useMutation({
    mutationFn: (data: UpdateProductionStageData) =>
      assignmentService.updateProductionStage(selectedEdit!.id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'edit-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });

      // Show appropriate message based on the stage transition
      if (variables.production_stage === 'FINAL_REVIEW') {
        toast.success('Edit approved! Moving to final review.');
      } else if (variables.production_stage === 'EDITING') {
        toast.success('Revision requested. Editor has been notified.');
      }

      setSelectedEdit(null);
    },
    onError: () => {
      toast.error('Failed to update edit status');
    },
  });

  // Filter pending scripts by search
  const filteredPendingScripts = useMemo(() => {
    if (!pendingScriptSearch.trim()) return pendingScripts;
    const search = pendingScriptSearch.toLowerCase();
    return pendingScripts.filter((script: ViralAnalysis) =>
      script.content_id?.toLowerCase().includes(search) ||
      script.hook?.toLowerCase().includes(search) ||
      script.full_name?.toLowerCase().includes(search) ||
      script.email?.toLowerCase().includes(search)
    );
  }, [pendingScripts, pendingScriptSearch]);

  // Filter approved scripts by search
  const filteredApprovedScripts = useMemo(() => {
    if (!approvedScriptSearch.trim()) return approvedScripts;
    const search = approvedScriptSearch.toLowerCase();
    return approvedScripts.filter((script: ViralAnalysis) =>
      script.content_id?.toLowerCase().includes(search) ||
      script.hook?.toLowerCase().includes(search) ||
      script.full_name?.toLowerCase().includes(search) ||
      script.email?.toLowerCase().includes(search)
    );
  }, [approvedScripts, approvedScriptSearch]);

  const totalPending = filteredPendingScripts.length + shootReviews.length + editReviews.length;

  return (
    <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <ExclamationTriangleIcon className="w-7 h-7 mr-3 text-red-600" />
              Review
            </h1>
            <p className="text-gray-600 mt-1">
              {totalPending} item{totalPending !== 1 ? 's' : ''} waiting for your review
            </p>
          </div>
          {totalPending > 0 && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm font-medium text-red-800">Action Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Script Submissions */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <DocumentTextIcon className="w-5 h-5 mr-2 text-yellow-600" />
              Script Submissions
              <span className="ml-3 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                {filteredPendingScripts.length} {pendingScriptSearch ? 'found' : 'pending'}
              </span>
            </h2>
            <div className="relative w-full md:w-80">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={pendingScriptSearch}
                onChange={(e) => setPendingScriptSearch(e.target.value)}
                placeholder="Search by content ID, hook, name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
              />
            </div>
          </div>

          {scriptsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredPendingScripts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <CheckCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">
                {pendingScriptSearch ? `No scripts found matching "${pendingScriptSearch}"` : 'No scripts pending approval'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {filteredPendingScripts.map((script: ViralAnalysis) => (
                <div
                  key={script.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {script.content_id && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                            {script.content_id}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          🟡 PENDING
                        </span>
                        {script.rejection_count !== undefined && script.rejection_count > 0 && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            script.rejection_count >= 4
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            🚨 Rejected {script.rejection_count}x {script.rejection_count >= 4 ? '(Warning: 1 more = dissolved)' : ''}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 mb-2">
                        Submitted {new Date(script.created_at).toLocaleString()}
                      </div>

                      <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1 break-words">
                        {script.hook || 'No hook provided'}
                      </h3>

                      <p className="text-xs md:text-sm text-gray-600 mb-3">
                        By: <span className="font-medium">{script.full_name || script.email}</span>
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
                        <div>
                          <span className="text-gray-500">Target:</span>{' '}
                          <span className="font-medium text-gray-900">{script.target_emotion}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Outcome:</span>{' '}
                          <span className="font-medium text-gray-900">{script.expected_outcome}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-2 md:gap-2 md:ml-4 w-full md:w-auto">
                      <button
                        onClick={() => {
                          setSelectedScript(script);
                          setShowPendingDrawer(true);
                        }}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 active:bg-primary-200 transition flex items-center justify-center"
                      >
                        <EyeIcon className="w-5 h-5 mr-2" />
                        View
                      </button>
                      <button
                        onClick={() => {
                          setSelectedScript(script);
                          approveScriptMutation.mutate({
                            status: 'APPROVED',
                            hookStrength: 7,
                            contentQuality: 7,
                            viralPotential: 7,
                            replicationClarity: 7,
                          });
                        }}
                        disabled={approveScriptMutation.isPending}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition disabled:opacity-50 flex items-center justify-center"
                      >
                        <CheckCircleIcon className="w-5 h-5 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedScript(script);
                          setShowRejectModal(true);
                        }}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 active:bg-red-800 transition flex items-center justify-center"
                      >
                        <XCircleIcon className="w-5 h-5 mr-2" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Shoot Reviews */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <VideoCameraIcon className="w-5 h-5 mr-2 text-green-600" />
              Shoot Reviews
            </h2>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {shootReviews.length} pending
            </span>
          </div>

          {shootsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : shootReviews.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <CheckCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No shoots pending review</p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {shootReviews.map((shoot: ViralAnalysis) => (
                <div
                  key={shoot.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {shoot.content_id && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                            {shoot.content_id}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          🟢 SHOOT DONE
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-2">
                        Uploaded {new Date(shoot.updated_at).toLocaleString()}
                      </div>

                      <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1 break-words">
                        {shoot.hook || 'No hook provided'}
                      </h3>

                      <p className="text-xs md:text-sm text-gray-600 mb-3">
                        Videographer: <span className="font-medium">{shoot.videographer?.full_name || shoot.videographer?.email || 'Unknown'}</span>
                      </p>

                      {shoot.production_notes && (
                        <p className="text-xs md:text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                          <span className="font-medium">Notes:</span> {shoot.production_notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-2 md:gap-2 md:ml-4 w-full md:w-auto">
                      <button
                        onClick={() => setSelectedShoot(shoot)}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 active:bg-primary-200 transition flex items-center justify-center"
                      >
                        <EyeIcon className="w-5 h-5 mr-2" />
                        View Files
                      </button>
                      <button
                        onClick={() => {
                          setSelectedShoot(shoot);
                          approveShootMutation.mutate({ production_stage: 'EDITING' });
                        }}
                        disabled={approveShootMutation.isPending}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition disabled:opacity-50 flex items-center justify-center"
                      >
                        <CheckCircleIcon className="w-5 h-5 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedShoot(shoot);
                          approveShootMutation.mutate({ production_stage: 'SHOOTING', production_notes: 'Reshoot required' });
                        }}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 active:bg-red-800 transition flex items-center justify-center"
                      >
                        <XCircleIcon className="w-5 h-5 mr-2" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Edit Reviews */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <FilmIcon className="w-5 h-5 mr-2 text-purple-600" />
              Edit Reviews
            </h2>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              {editReviews.length} pending
            </span>
          </div>

          {editsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : editReviews.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <CheckCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No edits pending review</p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {editReviews.map((edit: ViralAnalysis) => (
                <div
                  key={edit.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {edit.content_id && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                            {edit.content_id}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          🟣 EDIT DONE
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-2">
                        Submitted {new Date(edit.updated_at).toLocaleString()}
                      </div>

                      <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1 break-words">
                        {edit.hook || 'No hook provided'}
                      </h3>

                      <p className="text-xs md:text-sm text-gray-600">
                        Editor: <span className="font-medium">{edit.editor?.full_name || edit.editor?.email || 'Unknown'}</span>
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-2 md:gap-2 md:ml-4 w-full md:w-auto">
                      <button
                        onClick={() => setSelectedEdit(edit)}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 active:bg-primary-200 transition flex items-center justify-center"
                      >
                        <EyeIcon className="w-5 h-5 mr-2" />
                        Watch Video
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEdit(edit);
                          approveEditMutation.mutate({ production_stage: 'FINAL_REVIEW' });
                        }}
                        disabled={approveEditMutation.isPending}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition disabled:opacity-50 flex items-center justify-center"
                      >
                        <CheckCircleIcon className="w-5 h-5 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEdit(edit);
                          approveEditMutation.mutate({ production_stage: 'EDITING', production_notes: 'Revision needed' });
                        }}
                        className="w-full md:w-auto px-4 py-2.5 min-h-[48px] text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 active:bg-red-800 transition flex items-center justify-center"
                      >
                        <XCircleIcon className="w-5 h-5 mr-2" />
                        Request Fix
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approved Scripts Section */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <CheckCircleIcon className="w-5 h-5 mr-2 text-blue-600" />
              Approved Scripts
              <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {filteredApprovedScripts.length} {approvedScriptSearch ? 'found' : 'approved'}
              </span>
            </h2>
            <div className="relative w-full md:w-80">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={approvedScriptSearch}
                onChange={(e) => setApprovedScriptSearch(e.target.value)}
                placeholder="Search by content ID, hook, name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {approvedLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredApprovedScripts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <CheckCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">
                {approvedScriptSearch ? `No approved scripts found matching "${approvedScriptSearch}"` : 'No approved scripts yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApprovedScripts.map((script: ViralAnalysis) => (
                <div
                  key={script.id}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {script.content_id && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                            {script.content_id}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✅ APPROVED
                        </span>
                        {script.production_stage && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {script.production_stage.replace(/_/g, ' ')}
                          </span>
                        )}
                        {script.disapproval_count !== undefined && script.disapproval_count > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            ⚠️ Disapproved {script.disapproval_count}x
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Approved {new Date(script.updated_at).toLocaleString()}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {script.hook || 'No hook provided'}
                      </h3>

                      <p className="text-sm text-gray-600 mb-3">
                        By: <span className="font-medium">{script.full_name || script.email}</span>
                      </p>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Target:</span>{' '}
                          <span className="font-medium text-gray-900">{script.target_emotion}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Outcome:</span>{' '}
                          <span className="font-medium text-gray-900">{script.expected_outcome}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedApprovedScript(script);
                          setShowApprovedDrawer(true);
                        }}
                        className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition flex items-center"
                      >
                        <EyeIcon className="w-4 h-4 mr-1.5" />
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Pending Script Drawer - Comprehensive View */}
      {selectedScript && (
        <AnalysisSideDrawer
          analysis={selectedScript}
          isOpen={showPendingDrawer}
          onClose={() => {
            setShowPendingDrawer(false);
            setSelectedScript(null);
            // Refresh pending scripts list
            queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
          }}
          onApprove={() => {
            approveScriptMutation.mutate({
              status: 'APPROVED',
              hookStrength: 7,
              contentQuality: 7,
              viralPotential: 7,
              replicationClarity: 7,
            });
          }}
          onReject={() => {
            // Open rejection modal
            setShowRejectModal(true);
          }}
        />
      )}

      {/* Reject Script Modal */}
      {selectedScript && (
        <RejectScriptModal
          script={selectedScript}
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedScript(null);
          }}
          onReject={(data) => {
            rejectScriptMutation.mutate(data);
          }}
          isLoading={rejectScriptMutation.isPending}
        />
      )}

      {/* Assign Team Modal */}
      {showAssignTeamModal && selectedScript && (
        <AssignTeamModal
          analysis={selectedScript}
          isOpen={showAssignTeamModal}
          onClose={() => {
            setShowAssignTeamModal(false);
            setSelectedScript(null);
          }}
        />
      )}

      {/* Shoot Files Modal */}
      {selectedShoot && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setSelectedShoot(null)}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <VideoCameraIcon className="w-7 h-7 text-green-600 mr-2" />
                      Shoot Files - {selectedShoot.content_id}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedShoot.hook || 'No hook provided'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedShoot(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Videographer Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Videographer</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedShoot.videographer?.full_name || selectedShoot.videographer?.email || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Uploaded</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {new Date(selectedShoot.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {selectedShoot.production_notes && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-700">Production Notes</label>
                      <p className="mt-1 text-sm text-gray-900 bg-white p-3 rounded border border-gray-200">
                        {selectedShoot.production_notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Production Files */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Files</h3>
                  {shootFiles.length > 0 ? (
                    <div className="space-y-2">
                      {shootFiles.map((file: ProductionFile) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-primary-300 transition"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <DocumentTextIcon className="w-6 h-6 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.file_name}
                                </p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {file.file_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              {file.description && (
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                  {file.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                Uploaded {new Date(file.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition"
                          >
                            View File
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                      <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">No files uploaded yet</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 border-t pt-6">
                  <button
                    onClick={() => setSelectedShoot(null)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      approveShootMutation.mutate({ production_stage: 'SHOOTING', production_notes: 'Reshoot required' });
                    }}
                    disabled={approveShootMutation.isPending}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                  >
                    <XCircleIcon className="w-5 h-5 mr-2" />
                    Request Reshoot
                  </button>
                  <button
                    onClick={() => {
                      approveShootMutation.mutate({ production_stage: 'EDITING' });
                    }}
                    disabled={approveShootMutation.isPending}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                  >
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    Approve & Move to Editing
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approved Script Drawer */}
      {selectedApprovedScript && (
        <AnalysisSideDrawer
          analysis={selectedApprovedScript}
          isOpen={showApprovedDrawer}
          onClose={() => {
            setShowApprovedDrawer(false);
            setSelectedApprovedScript(null);
            // Refresh the approved scripts list
            queryClient.invalidateQueries({ queryKey: ['admin', 'approved-scripts'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'pending-count'] });
          }}
        />
      )}
    </div>
  );
}
