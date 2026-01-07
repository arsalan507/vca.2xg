import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { analysesService } from '@/services/analysesService';
import { PlusIcon, PencilIcon, LinkIcon, EyeIcon } from '@heroicons/react/24/outline';
import VoiceRecorder from '@/components/VoiceRecorder';
import type { ViralAnalysis, AnalysisFormData } from '@/types';

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
  const [viewingAnalysis, setViewingAnalysis] = useState<ViralAnalysis | null>(null);
  const [editingAnalysis, setEditingAnalysis] = useState<ViralAnalysis | null>(null);
  const [formData, setFormData] = useState<AnalysisFormData>({
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
  });

  const { data: analyses, isLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: analysesService.getMyAnalyses,
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

  const openModal = (analysis?: ViralAnalysis) => {
    if (analysis) {
      setEditingAnalysis(analysis);
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
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(analysis.status)}`}>
                  {analysis.status}
                </span>
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
                {analysis.status === 'PENDING' && (
                  <button
                    onClick={() => openModal(analysis)}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-primary-300 shadow-sm text-sm font-medium rounded-md text-primary-700 bg-primary-50 hover:bg-primary-100"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
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

                  {/* Timestamps */}
                  <div className="text-xs text-gray-500 border-t pt-4">
                    <p>Created: {new Date(viewingAnalysis.created_at).toLocaleString()}</p>
                    {viewingAnalysis.updated_at && (
                      <p>Updated: {new Date(viewingAnalysis.updated_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                  {viewingAnalysis.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        closeViewModal();
                        openModal(viewingAnalysis);
                      }}
                      className="px-6 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 font-medium"
                    >
                      Edit Analysis
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
    </div>
  );
}
