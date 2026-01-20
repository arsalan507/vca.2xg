import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { assignmentService } from '@/services/assignmentService';
import { contentConfigService } from '@/services/contentConfigService';
import { supabase } from '@/lib/supabase';
import { ProductionStage } from '@/types';
import type { ViralAnalysis, AssignTeamData } from '@/types';
import MultiSelectTags from '@/components/MultiSelectTags';
import {
  XMarkIcon,
  VideoCameraIcon,
  FilmIcon,
  MegaphoneIcon,
  UserGroupIcon,
  SparklesIcon,
  CheckCircleIcon,
  CalendarIcon,
  ClockIcon,
  FlagIcon,
  ArrowRightIcon,
  XCircleIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ChartBarIcon,
  PencilIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

interface ProductionDetailPanelProps {
  analysis: ViralAnalysis;
  onClose: () => void;
}

const SHOOT_POSSIBILITIES = [
  { value: 25, label: '25%', description: 'Low', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 50, label: '50%', description: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 75, label: '75%', description: 'Good', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 100, label: '100%', description: 'Ready', color: 'bg-green-100 text-green-800 border-green-300' },
];

export default function ProductionDetailPanel({
  analysis,
  onClose,
}: ProductionDetailPanelProps) {
  const queryClient = useQueryClient();
  const [showAssignTeam, setShowAssignTeam] = useState(false);
  const [showEditProductionDetails, setShowEditProductionDetails] = useState(false);
  const [formData, setFormData] = useState<AssignTeamData>({
    videographerId: undefined,
    editorId: undefined,
    postingManagerId: undefined,
    autoAssignVideographer: false,
    autoAssignEditor: false,
    autoAssignPostingManager: false,
  });
  const [productionDetailsData, setProductionDetailsData] = useState<{
    industryId: string;
    profileId: string;
    hookTagIds: string[];
    characterTagIds: string[];
    totalPeopleInvolved: number;
    shootPossibility: 25 | 50 | 75 | 100 | undefined;
  }>({
    industryId: '',
    profileId: '',
    hookTagIds: [],
    characterTagIds: [],
    totalPeopleInvolved: 1,
    shootPossibility: undefined,
  });
  const [showDisapproveForm, setShowDisapproveForm] = useState(false);
  const [disapproveFeedback, setDisapproveFeedback] = useState('');
  const [pendingStageTransition, setPendingStageTransition] = useState<{ stage: string; label: string } | null>(null);
  const [stageTransitionFeedback, setStageTransitionFeedback] = useState('');

  // Fetch latest analysis data to ensure we have fresh data after mutations
  const { data: latestAnalysis } = useQuery({
    queryKey: ['admin', 'production-detail', analysis?.id],
    queryFn: async () => {
      if (!analysis?.id) return null;

      const { data, error } = await supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (email, full_name, avatar_url),
          project_assignments (
            role,
            user:user_id (id, email, full_name, avatar_url)
          ),
          industry:industry_id (id, name, short_code),
          profile:profile_id (id, name),
          analysis_hook_tags (
            hook_tags (id, name)
          ),
          analysis_character_tags (
            character_tags (id, name)
          )
        `)
        .eq('id', analysis.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        email: data.profiles?.email,
        full_name: data.profiles?.full_name,
        avatar_url: data.profiles?.avatar_url,
        videographer: data.project_assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
        editor: data.project_assignments?.find((a: any) => a.role === 'EDITOR')?.user,
        posting_manager: data.project_assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
        hook_tags: data.analysis_hook_tags?.map((t: any) => t.hook_tags).filter(Boolean) || [],
        character_tags: data.analysis_character_tags?.map((t: any) => t.character_tags).filter(Boolean) || [],
      } as ViralAnalysis;
    },
    enabled: !!analysis?.id,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always',
  });

  // Use latest analysis data if available, otherwise use prop
  const currentAnalysis = latestAnalysis || analysis;

  // Update form data when analysis changes
  useEffect(() => {
    if (currentAnalysis) {
      setFormData({
        videographerId: currentAnalysis.videographer?.id,
        editorId: currentAnalysis.editor?.id,
        postingManagerId: currentAnalysis.posting_manager?.id,
        autoAssignVideographer: false,
        autoAssignEditor: false,
        autoAssignPostingManager: false,
      });
      setProductionDetailsData({
        industryId: currentAnalysis.industry_id || '',
        profileId: currentAnalysis.profile_id || '',
        hookTagIds: currentAnalysis.hook_tags?.map((t: any) => t.id) || [],
        characterTagIds: currentAnalysis.character_tags?.map((t: any) => t.id) || [],
        totalPeopleInvolved: currentAnalysis.total_people_involved || 1,
        shootPossibility: currentAnalysis.shoot_possibility || undefined,
      });
    }
  }, [currentAnalysis]);

  // Fetch production details options
  const { data: industries = [] } = useQuery({
    queryKey: ['industries'],
    queryFn: contentConfigService.getAllIndustries,
    enabled: showEditProductionDetails,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profile-list'],
    queryFn: contentConfigService.getAllProfiles,
    enabled: showEditProductionDetails,
  });

  const { data: hookTags = [] } = useQuery({
    queryKey: ['hook-tags'],
    queryFn: contentConfigService.getAllHookTags,
    enabled: showEditProductionDetails,
  });

  const { data: characterTags = [] } = useQuery({
    queryKey: ['character-tags'],
    queryFn: contentConfigService.getAllCharacterTags,
    enabled: showEditProductionDetails,
  });

  // Fetch users by role
  const { data: videographers = [] } = useQuery({
    queryKey: ['users', 'VIDEOGRAPHER'],
    queryFn: () => assignmentService.getUsersByRole('VIDEOGRAPHER'),
    enabled: showAssignTeam,
  });

  const { data: editors = [] } = useQuery({
    queryKey: ['users', 'EDITOR'],
    queryFn: () => assignmentService.getUsersByRole('EDITOR'),
    enabled: showAssignTeam,
  });

  const { data: postingManagers = [] } = useQuery({
    queryKey: ['users', 'POSTING_MANAGER'],
    queryFn: () => assignmentService.getUsersByRole('POSTING_MANAGER'),
    enabled: showAssignTeam,
  });

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: (data: AssignTeamData) =>
      assignmentService.assignTeam(analysis!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-detail', analysis?.id] });
      toast.success('Team assigned successfully!');
      setShowAssignTeam(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign team');
    },
  });

  // Production details mutation
  const productionDetailsMutation = useMutation({
    mutationFn: async (data: typeof productionDetailsData) => {
      const updateData: Record<string, any> = {
        industry_id: data.industryId || null,
        profile_id: data.profileId || null,
        total_people_involved: data.totalPeopleInvolved,
        shoot_possibility: data.shootPossibility || null,
      };

      const { error: updateError } = await supabase
        .from('viral_analyses')
        .update(updateData)
        .eq('id', analysis!.id);

      if (updateError) throw updateError;

      // Handle hook tags - first create any custom tags
      const resolvedHookTagIds: string[] = [];
      for (const tagId of data.hookTagIds) {
        if (tagId.startsWith('custom-')) {
          // Extract name from custom tag ID (format: custom-timestamp-name)
          const tagName = tagId.replace(/^custom-\d+-/, '').replace(/-/g, ' ');
          // Create in database
          const { data: newTag, error: createError } = await supabase
            .from('hook_tags')
            .insert({ name: tagName, is_active: true })
            .select()
            .single();
          if (createError) throw createError;
          resolvedHookTagIds.push(newTag.id);
        } else {
          resolvedHookTagIds.push(tagId);
        }
      }

      const { error: deleteHookTagsError } = await supabase
        .from('analysis_hook_tags')
        .delete()
        .eq('analysis_id', analysis!.id);

      if (deleteHookTagsError) {
        console.error('Error deleting hook tags:', deleteHookTagsError);
        throw deleteHookTagsError;
      }

      if (resolvedHookTagIds.length > 0) {
        const hookTagInserts = resolvedHookTagIds.map((tagId) => ({
          analysis_id: analysis!.id,
          hook_tag_id: tagId,
        }));
        const { error: insertHookTagsError } = await supabase.from('analysis_hook_tags').insert(hookTagInserts);
        if (insertHookTagsError) throw insertHookTagsError;
      }

      // Handle character tags - first create any custom tags
      const resolvedCharacterTagIds: string[] = [];
      for (const tagId of data.characterTagIds) {
        if (tagId.startsWith('custom-')) {
          // Extract name from custom tag ID (format: custom-timestamp-name)
          const tagName = tagId.replace(/^custom-\d+-/, '').replace(/-/g, ' ');
          // Create in database
          const { data: newTag, error: createError } = await supabase
            .from('character_tags')
            .insert({ name: tagName, is_active: true })
            .select()
            .single();
          if (createError) throw createError;
          resolvedCharacterTagIds.push(newTag.id);
        } else {
          resolvedCharacterTagIds.push(tagId);
        }
      }

      const { error: deleteCharacterTagsError } = await supabase
        .from('analysis_character_tags')
        .delete()
        .eq('analysis_id', analysis!.id);

      if (deleteCharacterTagsError) {
        console.error('Error deleting character tags:', deleteCharacterTagsError);
        throw deleteCharacterTagsError;
      }

      if (resolvedCharacterTagIds.length > 0) {
        const characterTagInserts = resolvedCharacterTagIds.map((tagId) => ({
          analysis_id: analysis!.id,
          character_tag_id: tagId,
        }));
        const { error: insertCharacterTagsError } = await supabase.from('analysis_character_tags').insert(characterTagInserts);
        if (insertCharacterTagsError) throw insertCharacterTagsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-detail', analysis?.id] });
      // Invalidate tag queries so newly created tags appear in dropdowns
      queryClient.invalidateQueries({ queryKey: ['hook-tags'] });
      queryClient.invalidateQueries({ queryKey: ['character-tags'] });
      toast.success('Production details saved!');
      setShowEditProductionDetails(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save production details');
    },
  });

  // Stage transition mutation
  const stageTransitionMutation = useMutation({
    mutationFn: async ({ newStage, feedback }: { newStage: string; feedback: string }) => {
      // Get existing admin_remarks to append new feedback
      const { data: existingData } = await supabase
        .from('viral_analyses')
        .select('admin_remarks')
        .eq('id', analysis!.id)
        .single();

      const timestamp = new Date().toLocaleString();
      const newRemark = `[${timestamp}] Stage → ${newStage.replace(/_/g, ' ')}: ${feedback}`;
      const updatedRemarks = existingData?.admin_remarks
        ? `${existingData.admin_remarks}\n\n${newRemark}`
        : newRemark;

      const { error } = await supabase
        .from('viral_analyses')
        .update({
          production_stage: newStage,
          admin_remarks: updatedRemarks,
        })
        .eq('id', analysis!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-detail', analysis?.id] });
      toast.success('Stage updated successfully!');
      setPendingStageTransition(null);
      setStageTransitionFeedback('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update stage');
    },
  });

  // Disapprove mutation - directly rejects with feedback
  const disapproveMutation = useMutation({
    mutationFn: async (feedback: string) => {
      // Get current rejection count
      const { data: currentData } = await supabase
        .from('viral_analyses')
        .select('rejection_count')
        .eq('id', analysis!.id)
        .single();

      const currentRejectionCount = currentData?.rejection_count || 0;
      const newRejectionCount = currentRejectionCount + 1;

      const { error } = await supabase
        .from('viral_analyses')
        .update({
          status: 'REJECTED',
          production_stage: null,
          feedback: feedback || null,
          rejection_count: newRejectionCount,
          // Mark as dissolved if rejected 4+ times
          is_dissolved: newRejectionCount >= 4,
        })
        .eq('id', analysis!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      toast.success('Script rejected and sent back for revision');
      setShowDisapproveForm(false);
      setDisapproveFeedback('');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject script');
    },
  });

  const handleAssignTeam = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.videographerId &&
      !formData.editorId &&
      !formData.postingManagerId &&
      !formData.autoAssignVideographer &&
      !formData.autoAssignEditor &&
      !formData.autoAssignPostingManager
    ) {
      toast.error('Please assign at least one team member');
      return;
    }

    assignMutation.mutate(formData);
  };

  const getNextStageOptions = (currentStage: string) => {
    const stageFlow: Record<string, { next: string; label: string; description: string }[]> = {
      [ProductionStage.NOT_STARTED]: [
        { next: ProductionStage.PRE_PRODUCTION, label: 'Start Production', description: 'Assign team and begin' }
      ],
      [ProductionStage.PRE_PRODUCTION]: [
        { next: ProductionStage.PLANNED, label: 'Set as Planned', description: 'Set planned date for shoot' },
        { next: ProductionStage.SHOOTING, label: 'Begin Shooting', description: 'Skip planning, start immediately' }
      ],
      [ProductionStage.PLANNED]: [
        { next: ProductionStage.SHOOTING, label: 'Start Shooting', description: 'Videographer starts shooting' },
        { next: ProductionStage.PRE_PRODUCTION, label: 'Back to Planning', description: 'Needs more planning' }
      ],
      [ProductionStage.SHOOTING]: [
        { next: ProductionStage.SHOOT_REVIEW, label: 'Submit for Review', description: 'Send to admin for review' }
      ],
      [ProductionStage.SHOOT_REVIEW]: [
        { next: ProductionStage.EDITING, label: 'Approve Shoot', description: 'Move to editing stage' },
        { next: ProductionStage.SHOOTING, label: 'Request Reshoot', description: 'Send back to videographer' }
      ],
      [ProductionStage.EDITING]: [
        { next: ProductionStage.EDIT_REVIEW, label: 'Submit Edit', description: 'Send to admin for review' }
      ],
      [ProductionStage.EDIT_REVIEW]: [
        { next: ProductionStage.READY_TO_POST, label: 'Approve Edit', description: 'Ready for posting' },
        { next: ProductionStage.EDITING, label: 'Request Revision', description: 'Send back to editor' }
      ],
      [ProductionStage.READY_TO_POST]: [
        { next: ProductionStage.POSTED, label: 'Mark as Posted', description: 'Content is live' }
      ],
      [ProductionStage.POSTED]: []
    };

    return stageFlow[currentStage] || [];
  };

  if (!currentAnalysis) return null;

  const hasTeam = currentAnalysis.videographer || currentAnalysis.editor || currentAnalysis.posting_manager;
  const nextStageOptions = getNextStageOptions(currentAnalysis.production_stage || ProductionStage.NOT_STARTED);

  // Check if can be disapproved (early stages only)
  const canDisapprove = currentAnalysis.status === 'APPROVED' && (
    !currentAnalysis.production_stage ||
    currentAnalysis.production_stage === ProductionStage.NOT_STARTED ||
    currentAnalysis.production_stage === ProductionStage.PRE_PRODUCTION ||
    currentAnalysis.production_stage === ProductionStage.PLANNED ||
    currentAnalysis.production_stage === ProductionStage.SHOOTING ||
    currentAnalysis.production_stage === ProductionStage.SHOOT_REVIEW
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Production Details</h2>
          <p className="text-primary-100 text-sm">
            {currentAnalysis.content_id || 'No content ID'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-full transition"
          title="Close panel"
        >
          <XMarkIcon className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Script Details */}
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <SparklesIcon className="w-4 h-4 mr-1.5 text-primary-600" />
            Script Details
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Hook</label>
              <p className="text-sm text-gray-900 mt-0.5">{currentAnalysis.hook || 'No hook provided'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Target Emotion</label>
                <p className="text-sm text-gray-900 mt-0.5">{currentAnalysis.target_emotion || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Expected Outcome</label>
                <p className="text-sm text-gray-900 mt-0.5">{currentAnalysis.expected_outcome || 'Not specified'}</p>
              </div>
            </div>
            {currentAnalysis.overall_score && (
              <div>
                <label className="text-xs font-medium text-gray-500">Overall Score</label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="text-xl font-bold text-primary-600">
                    {currentAnalysis.overall_score.toFixed(1)}
                  </div>
                  <span className="text-gray-500 text-sm">/ 10</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Production Status */}
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <FlagIcon className="w-4 h-4 mr-1.5 text-orange-600" />
            Production Status
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="text-xs font-medium text-gray-500">Current Stage</label>
              <p className="text-gray-900 mt-0.5 font-medium">
                {currentAnalysis.production_stage?.replace(/_/g, ' ') || 'NOT STARTED'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Priority</label>
              <p className="text-gray-900 mt-0.5 font-medium">
                {currentAnalysis.priority || 'NORMAL'}
              </p>
            </div>
            {currentAnalysis.planned_date && (
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Planned Date
                </label>
                <p className={`mt-0.5 font-medium ${
                  new Date(currentAnalysis.planned_date).toDateString() === new Date().toDateString()
                    ? 'text-amber-700'
                    : 'text-gray-900'
                }`}>
                  {new Date(currentAnalysis.planned_date).toLocaleDateString()}
                  {new Date(currentAnalysis.planned_date).toDateString() === new Date().toDateString() && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">Today</span>
                  )}
                </p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5" />
                Days in Stage
              </label>
              <p className="text-gray-900 mt-0.5 font-medium">
                {Math.floor((Date.now() - new Date(currentAnalysis.updated_at).getTime()) / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
          </div>

          {/* Admin Remarks */}
          {currentAnalysis.admin_remarks && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="text-xs font-semibold text-amber-800 flex items-center gap-1 mb-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Admin Remarks
              </label>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{currentAnalysis.admin_remarks}</p>
            </div>
          )}
        </section>

        {/* Stage Transitions */}
        {nextStageOptions.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <ArrowRightIcon className="w-4 h-4 mr-1.5 text-blue-600" />
              Stage Transitions
            </h3>

            {pendingStageTransition ? (
              // Feedback form for stage transition
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  stageTransitionMutation.mutate({
                    newStage: pendingStageTransition.stage,
                    feedback: stageTransitionFeedback,
                  });
                }}
                className="space-y-3"
              >
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-800">
                    Moving to: {pendingStageTransition.label}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Feedback / Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={stageTransitionFeedback}
                    onChange={(e) => setStageTransitionFeedback(e.target.value)}
                    placeholder="Add notes about this stage transition..."
                    rows={3}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingStageTransition(null);
                      setStageTransitionFeedback('');
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={stageTransitionMutation.isPending || !stageTransitionFeedback.trim()}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                  >
                    {stageTransitionMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <ArrowRightIcon className="w-4 h-4 mr-1.5" />
                        Confirm
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              // Stage transition buttons
              <div className="space-y-2">
                {nextStageOptions.map((option) => (
                  <button
                    key={option.next}
                    onClick={() => setPendingStageTransition({ stage: option.next, label: option.label })}
                    disabled={stageTransitionMutation.isPending}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{option.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                      </div>
                      <ArrowRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Production Details (Categorization) */}
        <section className="bg-white border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <BuildingOfficeIcon className="w-4 h-4 mr-1.5 text-blue-600" />
              Production Details
            </h3>
            {!showEditProductionDetails && (
              <button
                onClick={() => setShowEditProductionDetails(true)}
                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center"
              >
                <PencilIcon className="w-3.5 h-3.5 mr-1" />
                Edit
              </button>
            )}
          </div>

          {!showEditProductionDetails ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Industry</label>
                  <p className="text-gray-900 mt-0.5">
                    {currentAnalysis.industry?.name || <span className="text-gray-400">Not set</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Profile</label>
                  <p className="text-gray-900 mt-0.5">
                    {currentAnalysis.profile?.name || <span className="text-gray-400">Not set</span>}
                  </p>
                </div>
              </div>

              {/* Hook Tags */}
              <div>
                <label className="text-xs font-medium text-gray-500">Hook Tags</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentAnalysis.hook_tags && currentAnalysis.hook_tags.length > 0 ? (
                    currentAnalysis.hook_tags.map((tag: any) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200"
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs">No tags</span>
                  )}
                </div>
              </div>

              {/* Character Tags */}
              <div>
                <label className="text-xs font-medium text-gray-500">Character Tags</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentAnalysis.character_tags && currentAnalysis.character_tags.length > 0 ? (
                    currentAnalysis.character_tags.map((tag: any) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200"
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs">No tags</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center">
                    <UsersIcon className="w-3.5 h-3.5 mr-1" />
                    People Involved
                  </label>
                  <p className="text-gray-900 mt-0.5 font-medium">
                    {currentAnalysis.total_people_involved || <span className="text-gray-400">Not set</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center">
                    <ChartBarIcon className="w-3.5 h-3.5 mr-1" />
                    Shoot Possibility
                  </label>
                  <p className="text-gray-900 mt-0.5 font-medium">
                    {currentAnalysis.shoot_possibility ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        currentAnalysis.shoot_possibility === 100 ? 'bg-green-100 text-green-800' :
                        currentAnalysis.shoot_possibility === 75 ? 'bg-blue-100 text-blue-800' :
                        currentAnalysis.shoot_possibility === 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {currentAnalysis.shoot_possibility}%
                      </span>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Edit Mode
            <form onSubmit={(e) => { e.preventDefault(); productionDetailsMutation.mutate(productionDetailsData); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
                  <select
                    value={productionDetailsData.industryId}
                    onChange={(e) => setProductionDetailsData({ ...productionDetailsData, industryId: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select...</option>
                    {industries.filter((i: any) => i.is_active).map((industry: any) => (
                      <option key={industry.id} value={industry.id}>
                        {industry.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Profile</label>
                  <select
                    value={productionDetailsData.profileId}
                    onChange={(e) => setProductionDetailsData({ ...productionDetailsData, profileId: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select...</option>
                    {profiles.filter((p: any) => p.is_active).map((profile: any) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hook Tags */}
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <MultiSelectTags
                  label="Hook Tags"
                  options={hookTags.filter((t: any) => t.is_active).map((t: any) => ({ id: t.id, name: t.name }))}
                  selectedIds={productionDetailsData.hookTagIds}
                  onChange={(ids) => setProductionDetailsData({ ...productionDetailsData, hookTagIds: ids })}
                  placeholder="Select hook types..."
                  allowCreate={true}
                  onAddCustomTag={(tagName) => console.log('Custom hook tag:', tagName)}
                />
              </div>

              {/* Character Tags */}
              <div className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                <MultiSelectTags
                  label="Character Tags"
                  options={characterTags.filter((t: any) => t.is_active).map((t: any) => ({ id: t.id, name: t.name }))}
                  selectedIds={productionDetailsData.characterTagIds}
                  onChange={(ids) => setProductionDetailsData({ ...productionDetailsData, characterTagIds: ids })}
                  placeholder="Select characters..."
                  allowCreate={true}
                  onAddCustomTag={(tagName) => console.log('Custom character tag:', tagName)}
                />
              </div>

              {/* Total People & Shoot Possibility */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <UsersIcon className="w-3.5 h-3.5 inline mr-1" />
                    People Involved
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={productionDetailsData.totalPeopleInvolved}
                    onChange={(e) => setProductionDetailsData({ ...productionDetailsData, totalPeopleInvolved: parseInt(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <ChartBarIcon className="w-3.5 h-3.5 inline mr-1" />
                    Shoot Possibility
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {SHOOT_POSSIBILITIES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setProductionDetailsData({ ...productionDetailsData, shootPossibility: option.value as 25 | 50 | 75 | 100 })}
                        className={`px-2 py-1 rounded border text-xs font-medium transition-all ${
                          productionDetailsData.shootPossibility === option.value
                            ? `${option.color} ring-1 ring-primary-400`
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProductionDetails(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productionDetailsMutation.isPending}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {productionDetailsMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Team Assignment */}
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <UserGroupIcon className="w-4 h-4 mr-1.5 text-indigo-600" />
              Team Assignment
            </h3>
            {!showAssignTeam && (
              <button
                onClick={() => setShowAssignTeam(true)}
                className="px-2 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-xs font-medium"
              >
                {hasTeam ? 'Edit Team' : 'Assign Team'}
              </button>
            )}
          </div>

          {!showAssignTeam ? (
            <div className="space-y-2">
              {/* Videographer */}
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <VideoCameraIcon className="w-4 h-4 text-indigo-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 font-medium">Videographer</p>
                  <p className="text-sm text-gray-900">
                    {currentAnalysis.videographer?.full_name || currentAnalysis.videographer?.email || (
                      <span className="text-red-600 font-medium">Unassigned</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Editor */}
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <FilmIcon className="w-4 h-4 text-purple-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 font-medium">Editor</p>
                  <p className="text-sm text-gray-900">
                    {currentAnalysis.editor?.full_name || currentAnalysis.editor?.email || (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Posting Manager */}
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <MegaphoneIcon className="w-4 h-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 font-medium">Posting Manager</p>
                  <p className="text-sm text-gray-900">
                    {currentAnalysis.posting_manager?.full_name || currentAnalysis.posting_manager?.email || (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAssignTeam} className="space-y-3">
              {/* Videographer Assignment */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                  <VideoCameraIcon className="w-4 h-4 text-indigo-600" />
                  Videographer
                </label>
                <select
                  value={formData.videographerId || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      videographerId: e.target.value || undefined,
                      autoAssignVideographer: false,
                    })
                  }
                  disabled={formData.autoAssignVideographer}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">{formData.autoAssignVideographer ? 'Auto-assign' : 'Select...'}</option>
                  {videographers.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.full_name || v.email}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.autoAssignVideographer}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoAssignVideographer: e.target.checked,
                        videographerId: e.target.checked ? undefined : formData.videographerId,
                      })
                    }
                    className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                  />
                  Auto-assign (lowest workload)
                </label>
              </div>

              {/* Editor Assignment */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                  <FilmIcon className="w-4 h-4 text-purple-600" />
                  Editor (Optional)
                </label>
                <select
                  value={formData.editorId || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      editorId: e.target.value || undefined,
                      autoAssignEditor: false,
                    })
                  }
                  disabled={formData.autoAssignEditor}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">{formData.autoAssignEditor ? 'Auto-assign' : 'Select...'}</option>
                  {editors.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.full_name || e.email}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.autoAssignEditor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoAssignEditor: e.target.checked,
                        editorId: e.target.checked ? undefined : formData.editorId,
                      })
                    }
                    className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                  />
                  Auto-assign
                </label>
              </div>

              {/* Posting Manager Assignment */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                  <MegaphoneIcon className="w-4 h-4 text-green-600" />
                  Posting Manager (Optional)
                </label>
                <select
                  value={formData.postingManagerId || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      postingManagerId: e.target.value || undefined,
                      autoAssignPostingManager: false,
                    })
                  }
                  disabled={formData.autoAssignPostingManager}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">{formData.autoAssignPostingManager ? 'Auto-assign' : 'Select...'}</option>
                  {postingManagers.map((pm: any) => (
                    <option key={pm.id} value={pm.id}>{pm.full_name || pm.email}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.autoAssignPostingManager}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoAssignPostingManager: e.target.checked,
                        postingManagerId: e.target.checked ? undefined : formData.postingManagerId,
                      })
                    }
                    className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                  />
                  Auto-assign
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignTeam(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignMutation.isPending}
                  className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {assignMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      Assign
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Reference URL */}
        {currentAnalysis.reference_url && (
          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
              <LinkIcon className="w-4 h-4 mr-1.5 text-gray-600" />
              Reference Content
            </h3>
            <a
              href={currentAnalysis.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 underline text-sm break-all"
            >
              {currentAnalysis.reference_url}
            </a>
          </section>
        )}

        {/* Reject Script */}
        {canDisapprove && (
          <section className="bg-white border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
              <XCircleIcon className="w-4 h-4 mr-1.5 text-red-600" />
              Reject Script
            </h3>

            {!showDisapproveForm ? (
              <>
                <p className="text-xs text-gray-600 mb-3">
                  Reject this script and send it back to the writer for revision with feedback.
                </p>
                <button
                  onClick={() => setShowDisapproveForm(true)}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium flex items-center justify-center"
                >
                  <XCircleIcon className="w-4 h-4 mr-1.5" />
                  Reject Script
                </button>
              </>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                disapproveMutation.mutate(disapproveFeedback);
              }}>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Feedback for Writer <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={disapproveFeedback}
                    onChange={(e) => setDisapproveFeedback(e.target.value)}
                    placeholder="Explain why this script is being rejected and what needs to be improved..."
                    rows={3}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisapproveForm(false);
                      setDisapproveFeedback('');
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={disapproveMutation.isPending || !disapproveFeedback.trim()}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                  >
                    {disapproveMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5"></div>
                        Rejecting...
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="w-4 h-4 mr-1.5" />
                        Reject
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
