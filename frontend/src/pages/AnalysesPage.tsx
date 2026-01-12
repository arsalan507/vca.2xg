import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { analysesService } from '@/services/analysesService';
import { adminService } from '@/services/adminService';
import { profileService } from '@/services/profileService';
import { contentConfigService } from '@/services/contentConfigService';
import { PlusIcon, PencilIcon, LinkIcon, EyeIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import VoiceRecorder from '@/components/VoiceRecorder';
import MultiSelectTags from '@/components/MultiSelectTags';
import ReviewScoreInput from '@/components/ReviewScoreInput';
import type { ViralAnalysis, AnalysisFormData, ReviewAnalysisData } from '@/types';
import { UserRole } from '@/types';

const TARGET_EMOTIONS = [
  'Curiosity',
  'Fear',
  'Loss aversion',
  'Surprise',
  'Shock',
  'Identity recognition',
  'Relatability',
  'Frustration validation',
  'Doubt',
  'Cognitive dissonance',
  'Urgency',
  'FOMO',
  'Desire',
  'Aspiration',
  'Status threat',
  'Ego challenge',
  'Anxiety',
  'Confusion (intentional)',
  'Validation ("It\'s not just me")',
  'Intrigue',
];

const EXPECTED_OUTCOMES = [
  'Sales',
  'Qualified leads',
  'Inbound DMs / WhatsApp inquiries',
  'Store walk-ins / bookings',
  'Trust creation',
  'Brand authority',
  'Consideration building',
  'Decision acceleration',
  'Objection handling',
  'Shares (DMs)',
  'Saves',
  'Rewatches',
  'Profile visits',
  'Follower growth',
  'Brand recall',
];

export default function AnalysesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [viewingAnalysis, setViewingAnalysis] = useState<ViralAnalysis | null>(null);
  const [editingAnalysis, setEditingAnalysis] = useState<ViralAnalysis | null>(null);
  const [formData, setFormData] = useState<AnalysisFormData>({
    // Existing fields
    referenceUrl: '',
    hook: '',
    hookVoiceNote: null,
    hookVoiceNoteUrl: '',
    whyViral: '',
    whyViralVoiceNote: null,
    whyViralVoiceNoteUrl: '',
    howToReplicate: '',
    howToReplicateVoiceNote: null,
    howToReplicateVoiceNoteUrl: '',
    targetEmotion: '',
    expectedOutcome: '',
    // New enhanced fields
    industryId: '',
    profileId: '',
    hookTagIds: [],
    totalPeopleInvolved: 1,
    characterTagIds: [],
    onScreenTextHook: '',
    ourIdeaAudio: null,
    ourIdeaAudioUrl: '',
    shootLocation: '',
    shootPossibility: 50,
  });
  const [reviewData, setReviewData] = useState<ReviewAnalysisData>({
    status: 'APPROVED',
    feedback: '',
    hookStrength: 5,
    contentQuality: 5,
    viralPotential: 5,
    replicationClarity: 5,
  });

  // Check if current user is admin
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileService.getMyProfile,
  });

  const isAdmin = profile?.role === UserRole.SUPER_ADMIN;

  const { data: analyses, isLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: analysesService.getMyAnalyses,
  });

  // Fetch configuration data for form dropdowns
  const { data: industries = [] } = useQuery({
    queryKey: ['industries'],
    queryFn: contentConfigService.getAllIndustries,
  });

  const { data: hookTags = [] } = useQuery({
    queryKey: ['hook-tags'],
    queryFn: contentConfigService.getAllHookTags,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profile-list'],
    queryFn: contentConfigService.getAllProfiles,
  });

  const { data: characterTags = [] } = useQuery({
    queryKey: ['character-tags'],
    queryFn: contentConfigService.getAllCharacterTags,
  });

  const createMutation = useMutation({
    mutationFn: (data: AnalysisFormData) => analysesService.createAnalysis(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      toast.success('Analysis submitted successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit analysis');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AnalysisFormData }) =>
      analysesService.updateAnalysis(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      toast.success('Analysis updated successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update analysis');
    },
  });

  // Review analysis mutation (admin only)
  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewAnalysisData }) =>
      adminService.reviewAnalysis(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] });
      toast.success('Analysis reviewed successfully');
      setIsReviewModalOpen(false);
      setIsViewModalOpen(false);
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

  const openModal = async (analysis?: ViralAnalysis) => {
    if (analysis) {
      setEditingAnalysis(analysis);

      // Fetch existing tags for this analysis
      let existingHookTagIds: string[] = [];
      let existingCharacterTagIds: string[] = [];

      if (analysis.id) {
        const hookTagsData = await contentConfigService.getAnalysisHookTags(analysis.id);
        const characterTagsData = await contentConfigService.getAnalysisCharacterTags(analysis.id);
        existingHookTagIds = hookTagsData.map(t => t.id);
        existingCharacterTagIds = characterTagsData.map(t => t.id);
      }

      setFormData({
        referenceUrl: analysis.reference_url || '',
        hook: analysis.hook || '',
        hookVoiceNote: null,
        hookVoiceNoteUrl: analysis.hook_voice_note_url || '',
        whyViral: analysis.why_viral || '',
        whyViralVoiceNote: null,
        whyViralVoiceNoteUrl: analysis.why_viral_voice_note_url || '',
        howToReplicate: analysis.how_to_replicate || '',
        howToReplicateVoiceNote: null,
        howToReplicateVoiceNoteUrl: analysis.how_to_replicate_voice_note_url || '',
        targetEmotion: analysis.target_emotion || '',
        expectedOutcome: analysis.expected_outcome || '',
        // Enhanced fields
        industryId: analysis.industry_id || '',
        profileId: analysis.profile_id || '',
        hookTagIds: existingHookTagIds,
        totalPeopleInvolved: analysis.total_people_involved || 1,
        characterTagIds: existingCharacterTagIds,
        onScreenTextHook: analysis.on_screen_text_hook || '',
        ourIdeaAudio: null,
        ourIdeaAudioUrl: analysis.our_idea_audio_url || '',
        shootLocation: analysis.shoot_location || '',
        shootPossibility: (analysis.shoot_possibility as 25 | 50 | 75 | 100) || 50,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAnalysis(null);
    setFormData({
      referenceUrl: '',
      hook: '',
      hookVoiceNote: null,
      hookVoiceNoteUrl: '',
      whyViral: '',
      whyViralVoiceNote: null,
      whyViralVoiceNoteUrl: '',
      howToReplicate: '',
      howToReplicateVoiceNote: null,
      howToReplicateVoiceNoteUrl: '',
      targetEmotion: '',
      expectedOutcome: '',
      // Reset enhanced fields
      industryId: '',
      profileId: '',
      hookTagIds: [],
      totalPeopleInvolved: 1,
      characterTagIds: [],
      onScreenTextHook: '',
      ourIdeaAudio: null,
      ourIdeaAudioUrl: '',
      shootLocation: '',
      shootPossibility: 50,
    });
  };

  const openViewModal = (analysis: ViralAnalysis) => {
    setViewingAnalysis(analysis);
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setViewingAnalysis(null);
  };

  const openReviewModal = (analysis: ViralAnalysis) => {
    setViewingAnalysis(analysis);
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
    setViewingAnalysis(null);
    setReviewData({
      status: 'APPROVED',
      feedback: '',
      feedbackVoiceNote: null,
      hookStrength: 5,
      contentQuality: 5,
      viralPotential: 5,
      replicationClarity: 5,
    });
  };

  const handleSubmitReview = () => {
    if (!viewingAnalysis) return;

    if (reviewData.status === 'REJECTED' && !reviewData.feedback?.trim()) {
      toast.error('Feedback is required when rejecting an analysis');
      return;
    }

    reviewMutation.mutate({ id: viewingAnalysis.id, data: reviewData });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hook && !formData.hookVoiceNote) {
      toast.error('Please provide a hook either by typing or voice note');
      return;
    }
    if (editingAnalysis) {
      updateMutation.mutate({ id: editingAnalysis.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Viral Content Analyses</h1>
          <p className="mt-2 text-gray-600">Analyze viral content and create replication strategies</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Analysis
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : analyses && analyses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyses.map((analysis: ViralAnalysis) => (
            <div key={analysis.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                  {analysis.hook || 'Untitled Analysis'}
                </h3>
                <div className="flex flex-col items-end space-y-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(analysis.status)}`}>
                    {analysis.status}
                  </span>
                  {analysis.status === 'REJECTED' && analysis.rejection_count !== undefined && analysis.rejection_count > 0 && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      analysis.rejection_count >= 4
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      🔄 Rejected {analysis.rejection_count}x
                    </span>
                  )}
                  {analysis.is_dissolved && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-600 text-white">
                      ⚠️ Dissolved
                    </span>
                  )}
                </div>
              </div>
              {analysis.reference_url && (
                <a
                  href={analysis.reference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-primary-600 hover:text-primary-700 mb-3"
                >
                  <LinkIcon className="w-4 h-4 mr-1" />
                  View Reference
                </a>
              )}
              <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                {analysis.why_viral || analysis.how_to_replicate || 'No description'}
              </p>
              <div className="space-y-2 mb-4">
                {analysis.target_emotion && (
                  <div className="flex items-center text-sm text-gray-500">
                    <span className="font-medium mr-2">Emotion:</span>
                    {analysis.target_emotion}
                  </div>
                )}
                {analysis.expected_outcome && (
                  <div className="flex items-center text-sm text-gray-500">
                    <span className="font-medium mr-2">Outcome:</span>
                    {analysis.expected_outcome}
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => openViewModal(analysis)}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <EyeIcon className="h-4 w-4 mr-1" />
                  View
                </button>
                {(analysis.status === 'PENDING' || analysis.status === 'REJECTED') && !analysis.is_dissolved && (
                  <button
                    onClick={() => openModal(analysis)}
                    className={`flex-1 inline-flex justify-center items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-md ${
                      analysis.status === 'REJECTED'
                        ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                        : 'border-primary-300 text-primary-700 bg-primary-50 hover:bg-primary-100'
                    }`}
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    {analysis.status === 'REJECTED' ? 'Revise & Resubmit' : 'Edit'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No analyses yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by analyzing your first viral content piece.</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeModal}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {editingAnalysis ? 'Edit Viral Content Analysis' : 'Analyze Viral Content'}
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Break down what made this content viral and how to replicate it
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Industry Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Industry *
                    </label>
                    <select
                      required
                      value={formData.industryId}
                      onChange={(e) => setFormData({ ...formData, industryId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select industry...</option>
                      {industries.map((industry) => (
                        <option key={industry.id} value={industry.id}>
                          {industry.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Profile Assignment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile / Admin *
                    </label>
                    <select
                      required
                      value={formData.profileId}
                      onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select profile...</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reference Link *
                    </label>
                    <input
                      type="url"
                      required
                      value={formData.referenceUrl}
                      onChange={(e) => setFormData({ ...formData, referenceUrl: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://www.instagram.com/reel/example or https://youtube.com/watch?v=..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Paste the link to the viral content you want to analyze
                    </p>
                  </div>

                  {/* Hook Tags Multi-Select */}
                  <MultiSelectTags
                    label="Hook Tags"
                    options={hookTags.map(tag => ({ id: tag.id, name: tag.name }))}
                    selectedIds={formData.hookTagIds}
                    onChange={(ids) => setFormData({ ...formData, hookTagIds: ids })}
                    placeholder="Select hook types..."
                    required
                  />

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Hook (First 6 Seconds) *
                    </label>
                    <textarea
                      rows={3}
                      value={formData.hook}
                      onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
                      placeholder="Describe the opening hook that grabs attention in the first 6 seconds..."
                    />
                    <VoiceRecorder
                      label=""
                      placeholder="Or record your explanation of the hook"
                      onRecordingComplete={(blob, url) =>
                        setFormData({ ...formData, hookVoiceNote: blob, hookVoiceNoteUrl: url })
                      }
                      existingAudioUrl={formData.hookVoiceNoteUrl}
                      onClear={() =>
                        setFormData({ ...formData, hookVoiceNote: null, hookVoiceNoteUrl: '' })
                      }
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Why Did It Go Viral?
                    </label>
                    <textarea
                      rows={3}
                      value={formData.whyViral}
                      onChange={(e) => setFormData({ ...formData, whyViral: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
                      placeholder="Analyze the key factors that made this content go viral..."
                    />
                    <VoiceRecorder
                      label=""
                      placeholder="Or record your viral analysis"
                      onRecordingComplete={(blob, url) =>
                        setFormData({ ...formData, whyViralVoiceNote: blob, whyViralVoiceNoteUrl: url })
                      }
                      existingAudioUrl={formData.whyViralVoiceNoteUrl}
                      onClear={() =>
                        setFormData({ ...formData, whyViralVoiceNote: null, whyViralVoiceNoteUrl: '' })
                      }
                    />
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      How to Replicate for Our Brand
                    </label>
                    <textarea
                      rows={4}
                      value={formData.howToReplicate}
                      onChange={(e) => setFormData({ ...formData, howToReplicate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
                      placeholder="Explain step-by-step how we can adapt this viral format for our brand..."
                    />
                    <VoiceRecorder
                      label=""
                      placeholder="Or record your replication strategy"
                      onRecordingComplete={(blob, url) =>
                        setFormData({
                          ...formData,
                          howToReplicateVoiceNote: blob,
                          howToReplicateVoiceNoteUrl: url,
                        })
                      }
                      existingAudioUrl={formData.howToReplicateVoiceNoteUrl}
                      onClear={() =>
                        setFormData({
                          ...formData,
                          howToReplicateVoiceNote: null,
                          howToReplicateVoiceNoteUrl: '',
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What Emotions Are We Targeting? *
                    </label>
                    <select
                      required
                      value={formData.targetEmotion}
                      onChange={(e) => setFormData({ ...formData, targetEmotion: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select target emotion</option>
                      {TARGET_EMOTIONS.map((emotion) => (
                        <option key={emotion} value={emotion}>
                          {emotion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What Outcome Do We Expect? *
                    </label>
                    <select
                      required
                      value={formData.expectedOutcome}
                      onChange={(e) => setFormData({ ...formData, expectedOutcome: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select expected outcome</option>
                      {EXPECTED_OUTCOMES.map((outcome) => (
                        <option key={outcome} value={outcome}>
                          {outcome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Divider - Script Writer Specific Fields */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Details</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Additional information needed for video production
                    </p>
                  </div>

                  {/* ON SCREEN TEXT HOOK - Column L from Excel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      On-Screen Text Hook
                    </label>
                    <textarea
                      rows={2}
                      value={formData.onScreenTextHook}
                      onChange={(e) => setFormData({ ...formData, onScreenTextHook: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Text that will appear on screen during the hook (e.g., 'live robbery ( plus shooking emoji)')"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The text overlay that will grab attention in the first few seconds
                    </p>
                  </div>

                  {/* OUR IDEA - Column M from Excel (Audio recording) */}
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Our Idea (Voice Note)
                    </label>
                    <p className="text-xs text-gray-600 mb-3">
                      Record your detailed idea and vision for this content
                    </p>
                    <VoiceRecorder
                      label=""
                      placeholder="Record your detailed idea for this content"
                      onRecordingComplete={(blob, url) =>
                        setFormData({ ...formData, ourIdeaAudio: blob, ourIdeaAudioUrl: url })
                      }
                      existingAudioUrl={formData.ourIdeaAudioUrl}
                      onClear={() =>
                        setFormData({ ...formData, ourIdeaAudio: null, ourIdeaAudioUrl: '' })
                      }
                    />
                  </div>

                  {/* LOCATION OF SHOOT - Column N from Excel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location of the Shoot
                    </label>
                    <input
                      type="text"
                      value={formData.shootLocation}
                      onChange={(e) => setFormData({ ...formData, shootLocation: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., in store, outside store, client location"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Where will this video be shot?
                    </p>
                  </div>

                  {/* POSSIBILITY OF SHOOT - Column O from Excel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Possibility of Shoot *
                    </label>
                    <select
                      required
                      value={formData.shootPossibility}
                      onChange={(e) => setFormData({ ...formData, shootPossibility: parseInt(e.target.value) as 25 | 50 | 75 | 100 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="100">100% - Definitely can shoot</option>
                      <option value="75">75% - Very likely</option>
                      <option value="50">50% - Moderate chance</option>
                      <option value="25">25% - Challenging but possible</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      How confident are you that this can be shot successfully?
                    </p>
                  </div>

                  {/* Character Tags - Total People Involved */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total People Involved
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.totalPeopleInvolved}
                      onChange={(e) => setFormData({ ...formData, totalPeopleInvolved: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Number of people needed for the shoot"
                    />
                  </div>

                  {/* Character Tags Multi-Select */}
                  <MultiSelectTags
                    label="Character Tags"
                    options={characterTags.map(tag => ({ id: tag.id, name: tag.name }))}
                    selectedIds={formData.characterTagIds}
                    onChange={(ids) => setFormData({ ...formData, characterTagIds: ids })}
                    placeholder="Select characters involved..."
                  />

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
                    >
                      {createMutation.isPending || updateMutation.isPending
                        ? 'Saving...'
                        : editingAnalysis
                        ? 'Update Analysis'
                        : 'Submit Analysis'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {isViewModalOpen && viewingAnalysis && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeViewModal}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Analysis Details</h2>
                    <span className={`mt-2 inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(viewingAnalysis.status)}`}>
                      {viewingAnalysis.status}
                    </span>
                  </div>
                  <button
                    onClick={closeViewModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Reference URL */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Reference Link</h3>
                    {viewingAnalysis.reference_url ? (
                      <a
                        href={viewingAnalysis.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-primary-600 hover:text-primary-700"
                      >
                        <LinkIcon className="w-4 h-4 mr-2" />
                        {viewingAnalysis.reference_url}
                      </a>
                    ) : (
                      <p className="text-gray-500 text-sm">No reference URL provided</p>
                    )}
                  </div>

                  {/* Hook */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Hook (First 6 Seconds)</h3>
                    {viewingAnalysis.hook && (
                      <p className="text-gray-800 mb-3 whitespace-pre-wrap">{viewingAnalysis.hook}</p>
                    )}
                    {viewingAnalysis.hook_voice_note_url && (
                      <audio controls className="w-full mt-2">
                        <source src={viewingAnalysis.hook_voice_note_url} type="audio/webm" />
                        Your browser does not support audio playback.
                      </audio>
                    )}
                    {!viewingAnalysis.hook && !viewingAnalysis.hook_voice_note_url && (
                      <p className="text-gray-500 text-sm">No hook provided</p>
                    )}
                  </div>

                  {/* Why Viral */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Why Did It Go Viral?</h3>
                    {viewingAnalysis.why_viral && (
                      <p className="text-gray-800 mb-3 whitespace-pre-wrap">{viewingAnalysis.why_viral}</p>
                    )}
                    {viewingAnalysis.why_viral_voice_note_url && (
                      <audio controls className="w-full mt-2">
                        <source src={viewingAnalysis.why_viral_voice_note_url} type="audio/webm" />
                        Your browser does not support audio playback.
                      </audio>
                    )}
                    {!viewingAnalysis.why_viral && !viewingAnalysis.why_viral_voice_note_url && (
                      <p className="text-gray-500 text-sm">No viral analysis provided</p>
                    )}
                  </div>

                  {/* How to Replicate */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">How to Replicate for Our Brand</h3>
                    {viewingAnalysis.how_to_replicate && (
                      <p className="text-gray-800 mb-3 whitespace-pre-wrap">{viewingAnalysis.how_to_replicate}</p>
                    )}
                    {viewingAnalysis.how_to_replicate_voice_note_url && (
                      <audio controls className="w-full mt-2">
                        <source src={viewingAnalysis.how_to_replicate_voice_note_url} type="audio/webm" />
                        Your browser does not support audio playback.
                      </audio>
                    )}
                    {!viewingAnalysis.how_to_replicate && !viewingAnalysis.how_to_replicate_voice_note_url && (
                      <p className="text-gray-500 text-sm">No replication strategy provided</p>
                    )}
                  </div>

                  {/* Target Emotion & Expected Outcome */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Target Emotion</h3>
                      <p className="text-gray-800">{viewingAnalysis.target_emotion || 'Not specified'}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Expected Outcome</h3>
                      <p className="text-gray-800">{viewingAnalysis.expected_outcome || 'Not specified'}</p>
                    </div>
                  </div>

                  {/* Rejection Feedback (For Script Writers) */}
                  {!isAdmin && viewingAnalysis.status === 'REJECTED' && (viewingAnalysis.feedback || viewingAnalysis.feedback_voice_note_url) && (
                    <div className="bg-red-50 border-2 border-red-300 p-6 rounded-lg">
                      <h3 className="text-lg font-bold text-red-800 mb-3 flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Rejection Feedback - Please Review & Revise
                      </h3>

                      {viewingAnalysis.feedback && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-red-700 mb-2">Admin Feedback:</h4>
                          <p className="text-gray-800 whitespace-pre-wrap bg-white p-4 rounded border border-red-200">
                            {viewingAnalysis.feedback}
                          </p>
                        </div>
                      )}

                      {viewingAnalysis.feedback_voice_note_url && (
                        <div>
                          <h4 className="text-sm font-semibold text-red-700 mb-2">Voice Feedback:</h4>
                          <audio controls className="w-full">
                            <source src={viewingAnalysis.feedback_voice_note_url} type="audio/webm" />
                            <source src={viewingAnalysis.feedback_voice_note_url} type="audio/mpeg" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}

                      {viewingAnalysis.rejection_count !== undefined && viewingAnalysis.rejection_count > 0 && (
                        <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded">
                          <p className="text-sm text-orange-800">
                            <strong>⚠️ Warning:</strong> This script has been rejected {viewingAnalysis.rejection_count} time{viewingAnalysis.rejection_count > 1 ? 's' : ''}.
                            {viewingAnalysis.rejection_count >= 4 && (
                              <span className="block mt-1 font-bold text-red-700">
                                🚨 One more rejection will permanently dissolve this project!
                              </span>
                            )}
                          </p>
                        </div>
                      )}

                      {viewingAnalysis.is_dissolved && (
                        <div className="mt-4 p-3 bg-gray-800 text-white rounded">
                          <p className="text-sm font-bold">
                            ⛔ This project has been dissolved due to multiple rejections. No further revisions are allowed.
                          </p>
                          {viewingAnalysis.dissolution_reason && (
                            <p className="text-xs mt-1 text-gray-300">{viewingAnalysis.dissolution_reason}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Review Scores (if reviewed) */}
                  {viewingAnalysis.overall_score && (
                    <div className="bg-gradient-to-r from-primary-50 to-purple-50 p-6 rounded-lg border-2 border-primary-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <StarIconSolid className="w-5 h-5 text-yellow-500 mr-2" />
                        Admin Review Scores
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                          <div className="text-3xl font-bold text-primary-600">{viewingAnalysis.hook_strength}</div>
                          <div className="text-xs text-gray-600 mt-1">Hook Strength</div>
                        </div>
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                          <div className="text-3xl font-bold text-purple-600">{viewingAnalysis.content_quality}</div>
                          <div className="text-xs text-gray-600 mt-1">Content Quality</div>
                        </div>
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                          <div className="text-3xl font-bold text-pink-600">{viewingAnalysis.viral_potential}</div>
                          <div className="text-xs text-gray-600 mt-1">Viral Potential</div>
                        </div>
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                          <div className="text-3xl font-bold text-blue-600">{viewingAnalysis.replication_clarity}</div>
                          <div className="text-xs text-gray-600 mt-1">Replication Clarity</div>
                        </div>
                        <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 shadow-md border-2 border-green-300">
                          <div className="text-4xl font-bold text-green-600">{viewingAnalysis.overall_score}</div>
                          <div className="text-xs text-gray-700 mt-1 font-semibold">Overall Score</div>
                        </div>
                      </div>
                      {(viewingAnalysis.feedback || viewingAnalysis.feedback_voice_note_url) && (
                        <div className="mt-4 space-y-3">
                          {viewingAnalysis.feedback && (
                            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                              <div className="flex items-center mb-2">
                                <svg className="w-4 h-4 text-primary-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-700">Admin Feedback:</span>
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewingAnalysis.feedback}</p>
                            </div>
                          )}
                          {viewingAnalysis.feedback_voice_note_url && (
                            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                              <div className="flex items-center mb-2">
                                <svg className="w-4 h-4 text-primary-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-700">Voice Feedback:</span>
                              </div>
                              <audio controls className="w-full mt-2">
                                <source src={viewingAnalysis.feedback_voice_note_url} type="audio/webm" />
                                <source src={viewingAnalysis.feedback_voice_note_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          )}
                        </div>
                      )}
                      {viewingAnalysis.reviewed_at && (
                        <div className="mt-3 text-xs text-gray-600 text-right">
                          Reviewed on {new Date(viewingAnalysis.reviewed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="text-xs text-gray-500 border-t pt-4">
                    <p>Created: {new Date(viewingAnalysis.created_at).toLocaleString()}</p>
                    {viewingAnalysis.updated_at && (
                      <p>Updated: {new Date(viewingAnalysis.updated_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                  {isAdmin && (
                    <button
                      onClick={() => {
                        closeViewModal();
                        openReviewModal(viewingAnalysis);
                      }}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center"
                    >
                      <StarIcon className="w-5 h-5 mr-2" />
                      {viewingAnalysis.overall_score ? 'Update Review' : 'Review & Score'}
                    </button>
                  )}
                  {!isAdmin && (viewingAnalysis.status === 'PENDING' || viewingAnalysis.status === 'REJECTED') && !viewingAnalysis.is_dissolved && (
                    <button
                      onClick={() => {
                        closeViewModal();
                        openModal(viewingAnalysis);
                      }}
                      className={`px-6 py-2 border rounded-lg font-medium flex items-center ${
                        viewingAnalysis.status === 'REJECTED'
                          ? 'border-red-600 text-red-600 hover:bg-red-50 bg-red-50'
                          : 'border-primary-600 text-primary-600 hover:bg-primary-50'
                      }`}
                    >
                      <PencilIcon className="w-5 h-5 mr-2" />
                      {viewingAnalysis.status === 'REJECTED' ? 'Revise & Resubmit' : 'Edit Analysis'}
                    </button>
                  )}
                  <button
                    onClick={closeViewModal}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal with Scoring (Admin Only) */}
      {isReviewModalOpen && viewingAnalysis && isAdmin && (
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
                      Submitted by {viewingAnalysis.full_name || 'Unknown'} • {new Date(viewingAnalysis.created_at).toLocaleDateString()}
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
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Written Feedback {reviewData.status === 'REJECTED' && <span className="text-red-600">*</span>}
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

                    <div>
                      <VoiceRecorder
                        label="Voice Feedback (Optional)"
                        placeholder="Record audio feedback for the script writer"
                        onRecordingComplete={(blob, _url) => {
                          setReviewData({ ...reviewData, feedbackVoiceNote: blob });
                        }}
                        onClear={() => {
                          setReviewData({ ...reviewData, feedbackVoiceNote: null });
                        }}
                      />
                    </div>
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
    </div>
  );
}
