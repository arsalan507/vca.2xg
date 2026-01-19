import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentService } from '@/services/assignmentService';
import { productionFilesService } from '@/services/productionFilesService';
import { FilmIcon, CheckCircleIcon, PlayCircleIcon, EyeIcon, CloudArrowUpIcon, TrashIcon, DocumentIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { ViralAnalysis, UpdateProductionStageData, ProductionFile } from '@/types';
import { ProductionStage, FileType } from '@/types';

export default function EditorDashboard() {
  const queryClient = useQueryClient();
  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [productionNotes, setProductionNotes] = useState('');

  // File upload state
  const [showFileForm, setShowFileForm] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<string>(FileType.EDITED_VIDEO);
  const [fileUrl, setFileUrl] = useState('');
  const [fileDescription, setFileDescription] = useState('');

  // Fetch assigned analyses
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['editor', 'assignments'],
    queryFn: () => assignmentService.getMyAssignedAnalyses(),
  });

  const analyses = assignmentsData?.data || [];

  // Fetch files for selected analysis
  const { data: productionFiles = [] } = useQuery({
    queryKey: ['production-files', selectedAnalysis?.id],
    queryFn: () => productionFilesService.getFiles(selectedAnalysis!.id),
    enabled: !!selectedAnalysis?.id,
  });

  // Separate raw footage (from videographer) and edited videos (from editor)
  const rawFootageFiles = productionFiles.filter((f: ProductionFile) =>
    f.file_type === 'raw-footage'
  );
  const editedVideoFiles = productionFiles.filter((f: ProductionFile) =>
    f.file_type === 'edited-video' || f.file_type === 'final-video'
  );

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: (fileData: {
      analysisId: string;
      fileName: string;
      fileType: 'raw-footage' | 'edited-video' | 'final-video';
      fileUrl: string;
      fileId: string;
      description?: string;
    }) => productionFilesService.uploadFile({
      analysisId: fileData.analysisId,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileUrl: fileData.fileUrl,
      fileId: fileData.fileId,
      description: fileData.description,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File added successfully!');
      setShowFileForm(false);
      setFileName('');
      setFileUrl('');
      setFileDescription('');
      setFileType(FileType.EDITED_VIDEO);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add file');
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => productionFilesService.deleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File removed successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove file');
    },
  });

  // Update production stage mutation
  const updateStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductionStageData }) =>
      assignmentService.updateProductionStage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor', 'assignments'] });
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
    setSelectedStage(analysis.production_stage || ProductionStage.EDITING);
    setProductionNotes(analysis.production_notes || '');
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedAnalysis(null);
    setSelectedStage('');
    setProductionNotes('');
    setShowFileForm(false);
    setFileName('');
    setFileUrl('');
    setFileDescription('');
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

  const handleUploadFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnalysis || !fileName || !fileUrl) {
      toast.error('Please fill in all required fields');
      return;
    }

    uploadFileMutation.mutate({
      analysisId: selectedAnalysis.id,
      fileName,
      fileType: fileType === 'EDITED_VIDEO' ? 'edited-video' :
                fileType === 'FINAL_VIDEO' ? 'final-video' : 'raw-footage',
      fileUrl,
      fileId: 'temp-' + Date.now(),
      description: fileDescription,
    });
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (confirm(`Are you sure you want to remove "${fileName}"?`)) {
      deleteFileMutation.mutate(fileId);
    }
  };

  const getFileTypeBadge = (type: string) => {
    switch (type) {
      case FileType.RAW_FOOTAGE:
        return 'bg-blue-100 text-blue-800';
      case FileType.EDITED_VIDEO:
        return 'bg-green-100 text-green-800';
      case FileType.FINAL_VIDEO:
        return 'bg-purple-100 text-purple-800';
      case FileType.ASSET:
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case ProductionStage.SHOOT_REVIEW: return 'bg-yellow-100 text-yellow-800';
      case ProductionStage.EDITING: return 'bg-purple-100 text-purple-800';
      case ProductionStage.EDIT_REVIEW: return 'bg-pink-100 text-pink-800';
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
    editing: analyses.filter(a => a.production_stage === ProductionStage.EDITING).length,
    editReview: analyses.filter(a => a.production_stage === ProductionStage.EDIT_REVIEW).length,
    finalReview: analyses.filter(a => a.production_stage === ProductionStage.FINAL_REVIEW).length,
  };

  // Editors can only move to EDITING or submit for EDIT_REVIEW
  // They cannot change other stages - that's admin-only
  // const editorStages = [
  //   ProductionStage.EDITING,
  //   ProductionStage.EDIT_REVIEW, // Submit for admin review
  // ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <FilmIcon className="w-8 h-8 mr-3 text-purple-600" />
          Editor Dashboard
        </h1>
        <p className="mt-2 text-gray-600">
          Edit and refine video content
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
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FilmIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Editing</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.editing}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <PlayCircleIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Edit Review</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.editReview}</p>
            </div>
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <EyeIcon className="w-6 h-6 text-pink-600" />
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
              <CheckCircleIcon className="w-6 h-6 text-indigo-600" />
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
                        {analysis.posting_manager && (
                          <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center" title={`Posting Manager: ${analysis.posting_manager.full_name || analysis.posting_manager.email}`}>
                            <span className="text-xs font-medium text-pink-700">P</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openViewModal(analysis)}
                        className="text-purple-600 hover:text-purple-900"
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
              <FilmIcon className="mx-auto h-12 w-12 text-gray-400" />
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
                      <FilmIcon className="w-7 h-7 text-purple-600 mr-2" />
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

                  {/* Raw Footage from Videographer */}
                  <div className="border-t pt-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <ArrowDownTrayIcon className="w-5 h-5 mr-2 text-blue-600" />
                        Raw Footage & Assets
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">Files uploaded by the videographer</p>
                    </div>

                    <div className="space-y-2">
                      {rawFootageFiles.length > 0 ? (
                        rawFootageFiles.map((file: ProductionFile) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <DocumentIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getFileTypeBadge(file.file_type)}`}>
                                    {file.file_type.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                {file.description && (
                                  <p className="text-xs text-gray-600 mt-0.5 truncate">{file.description}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Uploaded by {file.uploader?.full_name || file.uploader?.email} • {new Date(file.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <a
                              href={file.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium ml-2"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                              Download
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                          <DocumentIcon className="mx-auto h-8 w-8 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-500">No raw footage uploaded yet</p>
                          <p className="text-xs text-gray-400">Waiting for videographer to upload files</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edited Videos Upload Section */}
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Your Edited Videos</h3>
                        <p className="text-sm text-gray-600 mt-1">Upload your edited versions</p>
                      </div>
                      <button
                        onClick={() => setShowFileForm(!showFileForm)}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        <CloudArrowUpIcon className="w-5 h-5 mr-2" />
                        Upload Edited Video
                      </button>
                    </div>

                    {/* Add File Form */}
                    {showFileForm && (
                      <form onSubmit={handleUploadFile} className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                              <input
                                type="text"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                required
                                placeholder="e.g., Final_Edit_v1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                              <select
                                value={fileType}
                                onChange={(e) => setFileType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                              >
                                <option value={FileType.EDITED_VIDEO}>Edited Video</option>
                                <option value={FileType.FINAL_VIDEO}>Final Video</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Google Drive URL
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input
                              type="url"
                              value={fileUrl}
                              onChange={(e) => setFileUrl(e.target.value)}
                              required
                              placeholder="https://drive.google.com/file/d/..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Upload the edited video to Google Drive first, then paste the shareable link here
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <textarea
                              value={fileDescription}
                              onChange={(e) => setFileDescription(e.target.value)}
                              rows={2}
                              placeholder="Changes made, version notes, etc..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowFileForm(false);
                                setFileName('');
                                setFileUrl('');
                                setFileDescription('');
                              }}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={uploadFileMutation.isPending}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                            >
                              {uploadFileMutation.isPending ? 'Uploading...' : 'Upload Video'}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Edited Videos List */}
                    <div className="space-y-2">
                      {editedVideoFiles.length > 0 ? (
                        editedVideoFiles.map((file: ProductionFile) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 transition">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <DocumentIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getFileTypeBadge(file.file_type)}`}>
                                    {file.file_type.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                {file.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{file.description}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Uploaded {new Date(file.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-2">
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700 text-sm font-medium"
                              >
                                View
                              </a>
                              <button
                                onClick={() => handleDeleteFile(file.id, file.file_name)}
                                disabled={deleteFileMutation.isPending}
                                className="text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                          <CloudArrowUpIcon className="mx-auto h-10 w-10 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-500">No edited videos uploaded yet</p>
                          <p className="text-xs text-gray-400 mt-1">Click "Upload Edited Video" to add your work</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Update Production Stage */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Editing Status</h3>
                    <p className="text-sm text-gray-600 mb-4">You can mark your editing work progress or submit for admin review</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Editing Status</label>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                            selectedStage === ProductionStage.EDITING
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : selectedStage === ProductionStage.EDIT_REVIEW
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {selectedStage === ProductionStage.EDITING && '✂️ Editing'}
                            {selectedStage === ProductionStage.EDIT_REVIEW && '⏳ Pending Review'}
                            {selectedStage !== ProductionStage.EDITING && selectedStage !== ProductionStage.EDIT_REVIEW && `${selectedStage.replace(/_/g, ' ')}`}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {selectedStage === ProductionStage.EDITING
                            ? 'Click "Submit for Review" when editing is complete'
                            : selectedStage === ProductionStage.EDIT_REVIEW
                            ? 'Waiting for admin approval to proceed'
                            : 'Stage controlled by admin'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Edit Notes</label>
                        <textarea
                          value={productionNotes}
                          onChange={(e) => setProductionNotes(e.target.value)}
                          rows={4}
                          placeholder="Add notes about the editing process, changes made, etc..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                    disabled={updateStageMutation.isPending || selectedStage !== ProductionStage.EDITING}
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

                  {/* Submit for Review Button - Only shown when in EDITING stage */}
                  {selectedStage === ProductionStage.EDITING && (
                    <button
                      onClick={() => {
                        handleUpdateStage(ProductionStage.EDIT_REVIEW);
                        setSelectedStage(ProductionStage.EDIT_REVIEW);
                      }}
                      disabled={updateStageMutation.isPending}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center"
                    >
                      {updateStageMutation.isPending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="w-5 h-5 mr-2" />
                          Submit for Review
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
