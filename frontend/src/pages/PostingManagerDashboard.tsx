import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentService } from '@/services/assignmentService';
import { MegaphoneIcon, CheckCircleIcon, RocketLaunchIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { ViralAnalysis, UpdateProductionStageData } from '@/types';
import { ProductionStage } from '@/types';

export default function PostingManagerDashboard() {
  const queryClient = useQueryClient();
  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [productionNotes, setProductionNotes] = useState('');

  // Fetch assigned analyses
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['posting-manager', 'assignments'],
    queryFn: () => assignmentService.getMyAssignedAnalyses(),
  });

  const analyses = assignmentsData?.data || [];

  // Update production stage mutation
  const updateStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductionStageData }) =>
      assignmentService.updateProductionStage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-manager', 'assignments'] });
      toast.success('Production stage updated successfully');
      setIsViewModalOpen(false);
      setSelectedAnalysis(null);
      setProductionNotes('');
    },
    onError: () => {
      toast.error('Failed to update production stage');
    },
  });

  const openViewModal = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    setSelectedStage(analysis.production_stage || ProductionStage.READY_TO_POST);
    setProductionNotes(analysis.production_notes || '');
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedAnalysis(null);
    setSelectedStage('');
    setProductionNotes('');
  };

  const handleUpdateStage = (stageOverride?: string) => {
    if (!selectedAnalysis) return;

    updateStageMutation.mutate({
      id: selectedAnalysis.id,
      data: {
        production_stage: (stageOverride || selectedStage) as any,
        production_notes: productionNotes,
      },
    });
  };

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case ProductionStage.FINAL_REVIEW: return 'bg-indigo-100 text-indigo-800';
      case ProductionStage.READY_TO_POST: return 'bg-green-100 text-green-800';
      case ProductionStage.POSTED: return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'NORMAL': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'LOW': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Stats calculations
  const stats = {
    total: analyses.length,
    readyToPost: analyses.filter(a => a.production_stage === ProductionStage.READY_TO_POST).length,
    posted: analyses.filter(a => a.production_stage === ProductionStage.POSTED).length,
    finalReview: analyses.filter(a => a.production_stage === ProductionStage.FINAL_REVIEW).length,
  };

  // Posting Managers can only mark as POSTED
  // They cannot change other stages - that's admin-only
  // const postingManagerStages = [
  //   ProductionStage.READY_TO_POST,
  //   ProductionStage.POSTED, // Mark as posted after publishing
  // ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <MegaphoneIcon className="w-8 h-8 mr-3 text-pink-600" />
          Posting Manager Dashboard
        </h1>
        <p className="mt-2 text-gray-600">
          Manage content posting and distribution
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <MegaphoneIcon className="w-6 h-6 text-pink-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Final Review</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.finalReview}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <EyeIcon className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ready to Post</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.readyToPost}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <RocketLaunchIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Posted</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.posted}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Projects */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">My Assigned Projects</h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
          ) : analyses && analyses.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
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
                        {analysis.target_emotion} • {analysis.expected_outcome}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(analysis.priority)}`}>
                        {analysis.priority || 'NORMAL'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(analysis.production_stage)}`}>
                        {analysis.production_stage?.replace(/_/g, ' ') || 'NOT STARTED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {analysis.deadline ? new Date(analysis.deadline).toLocaleDateString() : 'No deadline'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {analysis.videographer && (
                          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center" title={`Videographer: ${analysis.videographer.full_name || analysis.videographer.email}`}>
                            <span className="text-xs font-medium text-primary-700">V</span>
                          </div>
                        )}
                        {analysis.editor && (
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center" title={`Editor: ${analysis.editor.full_name || analysis.editor.email}`}>
                            <span className="text-xs font-medium text-purple-700">E</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openViewModal(analysis)}
                        className="text-pink-600 hover:text-pink-900"
                      >
                        View & Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <MegaphoneIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No projects assigned yet</p>
            </div>
          )}
        </div>
      </div>

      {/* View & Update Modal */}
      {isViewModalOpen && selectedAnalysis && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeViewModal}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <MegaphoneIcon className="w-7 h-7 text-pink-600 mr-2" />
                      Project Details
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Script by {selectedAnalysis.full_name} • Assigned on {new Date(selectedAnalysis.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(selectedAnalysis.priority)}`}>
                      {selectedAnalysis.priority || 'NORMAL'}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Reference URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reference Video</label>
                    <a
                      href={selectedAnalysis.reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 underline break-all"
                    >
                      {selectedAnalysis.reference_url}
                    </a>
                  </div>

                  {/* Admin Remarks - Highlighted Banner */}
                  {selectedAnalysis.admin_remarks && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <span className="inline-block w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-1">Admin Remarks</h4>
                          <p className="text-gray-800 whitespace-pre-wrap">{selectedAnalysis.admin_remarks}</p>
                        </div>
                      </div>
                    </div>
                  )}

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

                  {/* Deadline & Budget */}
                  {(selectedAnalysis.deadline || selectedAnalysis.budget) && (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedAnalysis.deadline && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                          <p className="text-gray-900 font-medium">{new Date(selectedAnalysis.deadline).toLocaleDateString()}</p>
                        </div>
                      )}
                      {selectedAnalysis.budget && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                          <p className="text-gray-900 font-medium">${selectedAnalysis.budget.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Previous Production Notes */}
                  {selectedAnalysis.production_notes && (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Previous Production Notes</label>
                      <p className="text-sm text-gray-900">{selectedAnalysis.production_notes}</p>
                    </div>
                  )}

                  {/* Review Scores */}
                  {selectedAnalysis.overall_score && (
                    <div className="bg-gradient-to-r from-primary-50 to-purple-50 p-6 rounded-lg border border-primary-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Quality Scores</h3>
                      <div className="grid grid-cols-5 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-600">{selectedAnalysis.hook_strength}</div>
                          <div className="text-xs text-gray-600 mt-1">Hook</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">{selectedAnalysis.content_quality}</div>
                          <div className="text-xs text-gray-600 mt-1">Quality</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-pink-600">{selectedAnalysis.viral_potential}</div>
                          <div className="text-xs text-gray-600 mt-1">Viral</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{selectedAnalysis.replication_clarity}</div>
                          <div className="text-xs text-gray-600 mt-1">Clarity</div>
                        </div>
                        <div className="text-center bg-white rounded-lg p-2">
                          <div className="text-3xl font-bold text-green-600">{selectedAnalysis.overall_score}</div>
                          <div className="text-xs text-gray-600 mt-1 font-semibold">Overall</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Update Production Stage */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Posting Status</h3>
                    <p className="text-sm text-gray-600 mb-4">You can mark content as posted after publishing</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Production Stage</label>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                            selectedStage === ProductionStage.READY_TO_POST
                              ? 'bg-pink-100 text-pink-800 border border-pink-200'
                              : selectedStage === ProductionStage.POSTED
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {selectedStage === ProductionStage.READY_TO_POST && '📱 Ready to Post'}
                            {selectedStage === ProductionStage.POSTED && '✅ Posted'}
                            {selectedStage !== ProductionStage.READY_TO_POST && selectedStage !== ProductionStage.POSTED && `${selectedStage.replace(/_/g, ' ')}`}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {selectedStage === ProductionStage.READY_TO_POST
                            ? 'Click "Mark as Posted" after publishing content'
                            : selectedStage === ProductionStage.POSTED
                            ? 'Content has been published - workflow complete'
                            : 'Stage controlled by admin'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Posting Notes</label>
                        <textarea
                          value={productionNotes}
                          onChange={(e) => setProductionNotes(e.target.value)}
                          rows={4}
                          placeholder="Add notes about posting strategy, platforms used, scheduling details, etc..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t pt-6">
                  <button
                    onClick={closeViewModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  {/* Save Notes Button - Always available */}
                  <button
                    onClick={() => handleUpdateStage()}
                    disabled={updateStageMutation.isPending || selectedStage !== ProductionStage.READY_TO_POST}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center"
                  >
                    {updateStageMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5 mr-2" />
                        Save Notes
                      </>
                    )}
                  </button>

                  {/* Mark as Posted Button - Only shown when in READY_TO_POST stage */}
                  {selectedStage === ProductionStage.READY_TO_POST && (
                    <button
                      onClick={() => {
                        handleUpdateStage(ProductionStage.POSTED);
                        setSelectedStage(ProductionStage.POSTED);
                      }}
                      disabled={updateStageMutation.isPending}
                      className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center"
                    >
                      {updateStageMutation.isPending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Marking as Posted...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="w-5 h-5 mr-2" />
                          Mark as Posted
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
