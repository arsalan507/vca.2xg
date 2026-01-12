import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentService } from '@/services/assignmentService';
import { productionFilesService } from '@/services/productionFilesService';
import { videographerProjectService } from '@/services/videographerProjectService';
import { VideoCameraIcon, ClockIcon, CheckCircleIcon, PlayCircleIcon, EyeIcon, CloudArrowUpIcon, TrashIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { ViralAnalysis, UpdateProductionStageData, ProductionFile } from '@/types';
import { ProductionStage, FileType } from '@/types';
import GoogleDriveOAuthUploader from '@/components/GoogleDriveOAuthUploader';

export default function VideographerDashboard() {
  const queryClient = useQueryClient();
  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [productionNotes, setProductionNotes] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // New project request state
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectReferenceUrl, setNewProjectReferenceUrl] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectShootDate, setNewProjectShootDate] = useState('');
  const [newProjectPeople, setNewProjectPeople] = useState<number>(1);

  // File upload state
  const [showFileForm, setShowFileForm] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<string>(FileType.A_ROLL);
  const [fileDescription, setFileDescription] = useState('');

  // Fetch assigned analyses
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['videographer', 'assignments'],
    queryFn: () => assignmentService.getMyAssignedAnalyses(),
  });

  const analyses = assignmentsData?.data || [];

  // Fetch files for selected analysis
  const { data: productionFiles = [] } = useQuery({
    queryKey: ['production-files', selectedAnalysis?.id],
    queryFn: () => productionFilesService.getFiles(selectedAnalysis!.id),
    enabled: !!selectedAnalysis?.id,
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: (fileData: {
      analysisId: string;
      fileName: string;
      fileType: typeof FileType[keyof typeof FileType];
      fileUrl: string;
      description?: string;
    }) => productionFilesService.uploadFile({
      analysisId: fileData.analysisId,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileUrl: fileData.fileUrl,
      description: fileData.description,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File added successfully!');
      setShowFileForm(false);
      setFileName('');
            setFileDescription('');
      setFileType(FileType.RAW_FOOTAGE);
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
      queryClient.invalidateQueries({ queryKey: ['videographer', 'assignments'] });
      toast.success('Production stage updated successfully');
      setIsViewModalOpen(false);
      setSelectedAnalysis(null);
      setProductionNotes('');
    },
    onError: () => {
      toast.error('Failed to update production stage');
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: videographerProjectService.createProject,
    onSuccess: async (newAnalysis) => {
      // Update the cache with the new project optimistically
      queryClient.setQueryData(['videographer', 'assignments'], (old: any) => {
        if (!old) return { data: [newAnalysis], total: 1 };
        return {
          data: [newAnalysis, ...old.data],
          total: old.total + 1,
        };
      });

      // Also invalidate to ensure fresh data from server
      await queryClient.invalidateQueries({ queryKey: ['videographer', 'assignments'] });

      toast.success('Project created successfully! You can now start uploading footage.');
      setIsNewProjectModalOpen(false);
      // Reset form
      setNewProjectTitle('');
      setNewProjectReferenceUrl('');
      setNewProjectDescription('');
      setNewProjectShootDate('');
      setNewProjectPeople(1);
      // Open the new project
      openViewModal(newAnalysis);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const openViewModal = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    // Initialize to SHOOTING stage (videographer's default starting stage)
    // If project is already in a videographer stage, use that
    const currentStage = analysis.production_stage;
    const isVideographerStage = currentStage && videographerStages.includes(currentStage as any);
    setSelectedStage(isVideographerStage ? currentStage! : ProductionStage.SHOOTING);
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
      case ProductionStage.PRE_PRODUCTION: return 'bg-blue-100 text-blue-800';
      case ProductionStage.SHOOTING: return 'bg-purple-100 text-purple-800';
      case ProductionStage.SHOOT_REVIEW: return 'bg-yellow-100 text-yellow-800';
      case ProductionStage.EDITING: return 'bg-orange-100 text-orange-800';
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
    preProduction: analyses.filter(a => a.production_stage === ProductionStage.PRE_PRODUCTION).length,
    shooting: analyses.filter(a => a.production_stage === ProductionStage.SHOOTING).length,
    shootReview: analyses.filter(a => a.production_stage === ProductionStage.SHOOT_REVIEW).length,
  };

  // Videographers can only move to SHOOTING or submit for SHOOT_REVIEW
  // They cannot change other stages - that's admin-only
  const videographerStages = [
    ProductionStage.SHOOTING,
    ProductionStage.SHOOT_REVIEW, // Submit for admin review
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <VideoCameraIcon className="w-8 h-8 mr-3 text-primary-600" />
            Videographer Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your assigned video projects
          </p>
        </div>
        <button
          onClick={() => setIsNewProjectModalOpen(true)}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
        >
          <VideoCameraIcon className="w-5 h-5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <VideoCameraIcon className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pre-Production</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.preProduction}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Shooting</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.shooting}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <PlayCircleIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Review</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.shootReview}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <EyeIcon className="w-6 h-6 text-yellow-600" />
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
                        {analysis.editor && (
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center" title={`Editor: ${analysis.editor.full_name || analysis.editor.email}`}>
                            <span className="text-xs font-medium text-purple-700">E</span>
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
                        className="text-primary-600 hover:text-primary-900"
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
              <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
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
                      <VideoCameraIcon className="w-7 h-7 text-primary-600 mr-2" />
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

                  {/* File Management Section */}
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Production Files</h3>
                        <p className="text-sm text-gray-600 mt-1">Upload raw footage, A-rolls, B-rolls, and other files</p>
                      </div>
                      <button
                        onClick={() => setShowFileForm(!showFileForm)}
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
                      >
                        <CloudArrowUpIcon className="w-5 h-5 mr-2" />
                        Add File
                      </button>
                    </div>

                    {/* Add File Form */}
                    {showFileForm && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                        <div className="space-y-4">
                          {/* File Metadata */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                              <input
                                type="text"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                placeholder="e.g., Main_Footage_Take1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                              <select
                                value={fileType}
                                onChange={(e) => setFileType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                              >
                                <option value={FileType.A_ROLL}>A-Roll (Main Footage)</option>
                                <option value={FileType.B_ROLL}>B-Roll (Supporting Footage)</option>
                                <option value={FileType.HOOK}>Hook (First 3-6 seconds)</option>
                                <option value={FileType.BODY}>Body (Main Content)</option>
                                <option value={FileType.CTA}>CTA (Call to Action)</option>
                                <option value={FileType.AUDIO_CLIP}>Audio Clip</option>
                                <option value={FileType.OTHER}>Other</option>
                              </select>
                            </div>
                          </div>

                          {/* Google Drive OAuth Upload */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Upload Video File
                            </label>
                            <GoogleDriveOAuthUploader
                              fileType="raw-footage"
                              projectId={selectedAnalysis?.content_id || ''}
                              onUploadComplete={(uploadedFileUrl: string, uploadedFileName: string, fileId: string) => {
                                // Auto-submit after successful upload
                                if (selectedAnalysis && uploadedFileUrl) {
                                  uploadFileMutation.mutate({
                                    analysisId: selectedAnalysis.id,
                                    fileName: fileName || uploadedFileName,
                                    fileType: fileType as typeof FileType[keyof typeof FileType],
                                    fileUrl: uploadedFileUrl,
                                    description: fileDescription,
                                  });
                                }
                              }}
                              acceptedFileTypes="video/*"
                              maxSizeMB={500}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <textarea
                              value={fileDescription}
                              onChange={(e) => setFileDescription(e.target.value)}
                              rows={2}
                              placeholder="Add any notes about this file..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                            />
                          </div>

                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowFileForm(false);
                                setFileName('');
                                                                setFileDescription('');
                              }}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Files List */}
                    <div className="space-y-2">
                      {productionFiles.length > 0 ? (
                        productionFiles.map((file: ProductionFile) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 transition">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <DocumentIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
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
                                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
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
                          <p className="mt-2 text-sm text-gray-500">No files uploaded yet</p>
                          <p className="text-xs text-gray-400 mt-1">Click "Add File" to upload your footage</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Production Details */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Details</h3>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Project Info */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Project ID</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedAnalysis.content_id || 'N/A'}</p>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Production Stage</label>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                              selectedStage === ProductionStage.SHOOTING
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : selectedStage === ProductionStage.SHOOT_REVIEW
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                              {selectedStage === ProductionStage.SHOOTING && '🎬 Shooting'}
                              {selectedStage === ProductionStage.SHOOT_REVIEW && '⏳ Pending Review'}
                              {selectedStage !== ProductionStage.SHOOTING && selectedStage !== ProductionStage.SHOOT_REVIEW && `${selectedStage}`}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {selectedStage === ProductionStage.SHOOTING
                              ? 'Click "Submit for Review" when done shooting'
                              : selectedStage === ProductionStage.SHOOT_REVIEW
                              ? 'Waiting for admin approval to proceed to editing'
                              : 'Stage controlled by admin'}
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700">Priority</label>
                          <p className="mt-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(selectedAnalysis.priority)}`}>
                              {selectedAnalysis.priority || 'NORMAL'}
                            </span>
                          </p>
                        </div>

                        {selectedAnalysis.deadline && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Deadline</label>
                            <p className="mt-1 text-sm text-gray-900">{new Date(selectedAnalysis.deadline).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>

                      {/* Team Info */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Script Writer</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedAnalysis.full_name || 'Unknown'}</p>
                        </div>

                        {selectedAnalysis.editor && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Editor</label>
                            <p className="mt-1 text-sm text-gray-900">{selectedAnalysis.editor.full_name || selectedAnalysis.editor.email}</p>
                          </div>
                        )}

                        {selectedAnalysis.posting_manager && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Posting Manager</label>
                            <p className="mt-1 text-sm text-gray-900">{selectedAnalysis.posting_manager.full_name || selectedAnalysis.posting_manager.email}</p>
                          </div>
                        )}

                        {selectedAnalysis.total_people_involved && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">People Involved</label>
                            <p className="mt-1 text-sm text-gray-900">{selectedAnalysis.total_people_involved}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Production Notes */}
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Production Notes</label>
                      <textarea
                        value={productionNotes}
                        onChange={(e) => setProductionNotes(e.target.value)}
                        rows={4}
                        placeholder="Add notes about the shoot, issues encountered, progress updates..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="mt-2 text-xs text-gray-500">These notes will be visible to the admin and other team members</p>
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
                    onClick={handleUpdateStage}
                    disabled={updateStageMutation.isPending || selectedStage !== ProductionStage.SHOOTING}
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

                  {/* Submit for Review Button - Only shown when in SHOOTING stage */}
                  {selectedStage === ProductionStage.SHOOTING && (
                    <button
                      onClick={() => {
                        handleUpdateStage(ProductionStage.SHOOT_REVIEW);
                        setSelectedStage(ProductionStage.SHOOT_REVIEW);
                      }}
                      disabled={updateStageMutation.isPending}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
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

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setIsNewProjectModalOpen(false)}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <VideoCameraIcon className="w-7 h-7 text-primary-600 mr-2" />
                    New Project
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Create a new video project and start shooting
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="e.g., Product Review - iPhone 15"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Link <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={newProjectReferenceUrl}
                    onChange={(e) => setNewProjectReferenceUrl(e.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Description</label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe the project, shooting requirements, expected outcome..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Shoot Date</label>
                    <input
                      type="date"
                      value={newProjectShootDate}
                      onChange={(e) => setNewProjectShootDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">People Required</label>
                    <input
                      type="number"
                      min="1"
                      value={newProjectPeople}
                      onChange={(e) => setNewProjectPeople(parseInt(e.target.value) || 1)}
                      placeholder="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This will create a new project and assign it to you. You can start uploading footage immediately.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setIsNewProjectModalOpen(false)}
                  disabled={createProjectMutation.isPending}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newProjectTitle.trim()) {
                      toast.error('Project title is required');
                      return;
                    }
                    if (!newProjectReferenceUrl.trim()) {
                      toast.error('Reference link is required');
                      return;
                    }

                    createProjectMutation.mutate({
                      title: newProjectTitle,
                      reference_url: newProjectReferenceUrl,
                      description: newProjectDescription || undefined,
                      estimated_shoot_date: newProjectShootDate || undefined,
                      people_required: newProjectPeople,
                    });
                  }}
                  disabled={createProjectMutation.isPending || !newProjectTitle.trim() || !newProjectReferenceUrl.trim()}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
