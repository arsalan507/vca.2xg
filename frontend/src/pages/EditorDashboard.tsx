import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { assignmentService } from '@/services/assignmentService';
import { productionFilesService } from '@/services/productionFilesService';
import { editorQueueService } from '@/services/editorQueueService';
import { FilmIcon, CheckCircleIcon, PlayCircleIcon, CloudArrowUpIcon, TrashIcon, DocumentIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, XMarkIcon, FunnelIcon, ArrowPathIcon, InboxIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import JSZip from 'jszip';
import { googleDriveOAuthService } from '@/services/googleDriveOAuthService';
import type { ViralAnalysis, UpdateProductionStageData, ProductionFile } from '@/types';
import { UserRole, ProductionStageV2 } from '@/types';
import MultiFileUploadQueue, { EDITOR_FILE_TYPES } from '@/components/MultiFileUploadQueue';
import BottomNavigation from '@/components/BottomNavigation';
import ProjectCard from '@/components/ProjectCard';

type TabType = 'available' | 'mywork' | 'profile';

export default function EditorDashboard() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current tab from URL or default to 'available'
  const currentTab = (searchParams.get('tab') as TabType) || 'available';

  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [productionNotes, setProductionNotes] = useState('');

  // File upload state
  const [showFileForm, setShowFileForm] = useState(false);

  // Zip download state
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');

  const handleDownloadAllAsZip = useCallback(async (files: ProductionFile[], projectName: string) => {
    if (isZipping || files.length === 0) return;

    try {
      setIsZipping(true);
      setZipProgress(`Preparing 0/${files.length} files...`);
      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setZipProgress(`Downloading ${i + 1}/${files.length}: ${file.file_name}`);

        try {
          const blob = await googleDriveOAuthService.downloadFileAsBlob(file.file_id);
          zip.file(file.file_name, blob);
        } catch (err) {
          console.error(`Failed to download ${file.file_name}:`, err);
          toast.error(`Failed to download: ${file.file_name}`);
        }
      }

      setZipProgress('Creating zip...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'raw-footage'}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Zip downloaded successfully!');
    } catch (err) {
      console.error('Zip download failed:', err);
      toast.error('Failed to create zip. Try downloading files individually.');
    } finally {
      setIsZipping(false);
      setZipProgress('');
    }
  }, [isZipping]);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch available projects (READY_FOR_EDIT queue with raw files)
  const { data: availableProjects = [], isLoading: isLoadingAvailable, refetch: refetchAvailable } = useQuery({
    queryKey: ['editor', 'available'],
    queryFn: () => editorQueueService.getAvailableProjects(),
  });

  // Fetch my assigned analyses (using the new service for consistency)
  const { data: myProjects = [], isLoading: isLoadingMyProjects } = useQuery({
    queryKey: ['editor', 'my-projects'],
    queryFn: () => editorQueueService.getMyProjects(),
  });

  // Fetch files for selected analysis
  const { data: productionFiles = [] } = useQuery({
    queryKey: ['production-files', selectedAnalysis?.id],
    queryFn: () => productionFilesService.getFiles(selectedAnalysis!.id),
    enabled: !!selectedAnalysis?.id,
  });

  // Separate raw footage (from videographer) and edited videos (from editor)
  const rawFootageFiles = productionFiles.filter((f: ProductionFile) =>
    f.file_type === 'raw-footage' || ['RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP'].includes(f.file_type)
  );
  const editedVideoFiles = productionFiles.filter((f: ProductionFile) =>
    f.file_type === 'edited-video' || f.file_type === 'final-video' || ['EDITED_VIDEO', 'FINAL_VIDEO'].includes(f.file_type)
  );

  // Pick project mutation
  const pickProjectMutation = useMutation({
    mutationFn: (analysisId: string) => editorQueueService.pickProject({ analysisId }),
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ['editor', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['editor', 'my-projects'] });
      toast.success('Project picked! You can now start editing.');
      setSearchParams({ tab: 'mywork' });
      openViewModal(updatedProject);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to pick project');
    },
  });

  // Mark editing complete mutation
  const markEditingCompleteMutation = useMutation({
    mutationFn: (data: { analysisId: string; productionNotes?: string }) =>
      editorQueueService.markEditingComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor', 'my-projects'] });
      toast.success('Editing marked as complete! Project moved to posting queue.');
      setIsViewModalOpen(false);
      setSelectedAnalysis(null);
      setProductionNotes('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark editing complete');
    },
  });

  // Upload file mutation (for single file from multi-upload queue)
  const uploadFileMutation = useMutation({
    mutationFn: (fileData: {
      analysisId: string;
      fileName: string;
      fileType: string;
      fileUrl: string;
      fileId: string;
      description?: string;
    }) => productionFilesService.uploadFile({
      analysisId: fileData.analysisId,
      fileName: fileData.fileName,
      fileType: fileData.fileType === 'FINAL_VIDEO' ? 'final-video' : 'edited-video',
      fileUrl: fileData.fileUrl,
      fileId: fileData.fileId,
      description: fileData.fileType, // Store the tag in description
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File added successfully!');
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

  // Update production stage mutation (for saving notes)
  const updateStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductionStageData }) =>
      assignmentService.updateProductionStage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor', 'my-projects'] });
      toast.success('Notes saved successfully');
      setIsViewModalOpen(false);
      setSelectedAnalysis(null);
      setProductionNotes('');
    },
    onError: () => {
      toast.error('Failed to save notes');
    },
  });

  const openViewModal = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    setSelectedStage(analysis.production_stage || ProductionStageV2.EDITING);
    setProductionNotes(analysis.production_notes || '');
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedAnalysis(null);
    setSelectedStage('');
    setProductionNotes('');
    setShowFileForm(false);
  };

  const handleSaveNotes = () => {
    if (!selectedAnalysis) return;

    updateStageMutation.mutate({
      id: selectedAnalysis.id,
      data: {
        production_stage: selectedStage as any,
        production_notes: productionNotes,
      },
    });
  };

  const handleMarkEditingComplete = () => {
    if (!selectedAnalysis) return;

    markEditingCompleteMutation.mutate({
      analysisId: selectedAnalysis.id,
      productionNotes,
    });
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (confirm(`Are you sure you want to remove "${fileName}"?`)) {
      deleteFileMutation.mutate(fileId);
    }
  };

  const handlePickProject = (project: ViralAnalysis) => {
    pickProjectMutation.mutate(project.id);
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
    available: availableProjects.length,
    editing: myProjects.filter(a => (a.production_stage as string) === ProductionStageV2.EDITING).length,
    readyToPost: myProjects.filter(a => (a.production_stage as string) === ProductionStageV2.READY_TO_POST).length,
    total: myProjects.length,
  };

  // Filtered analyses based on search and filters
  const filteredMyProjects = useMemo(() => {
    return myProjects.filter(analysis => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesContentId = analysis.content_id?.toLowerCase().includes(query);
        const matchesId = analysis.id.toLowerCase().includes(query);
        const matchesHook = analysis.hook?.toLowerCase().includes(query);
        if (!matchesContentId && !matchesId && !matchesHook) return false;
      }
      if (filterStage && analysis.production_stage !== filterStage) return false;
      if (filterPriority && analysis.priority !== filterPriority) return false;
      return true;
    });
  }, [myProjects, searchQuery, filterStage, filterPriority]);

  const hasActiveFilters = searchQuery || filterStage || filterPriority;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStage('');
    setFilterPriority('');
  };

  const setTab = (tab: TabType) => {
    setSearchParams({ tab });
  };

  // Render Available Projects Tab
  const renderAvailableTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Available Projects</h2>
        <button
          onClick={() => refetchAvailable()}
          disabled={isLoadingAvailable}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowPathIcon className={`w-5 h-5 ${isLoadingAvailable ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Pick a project to start editing. Projects with raw footage are waiting for an editor.
      </p>

      {isLoadingAvailable ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : availableProjects.length > 0 ? (
        <div className="space-y-4">
          {availableProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
            >
              {/* Header: ID + Priority */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {project.content_id ? (
                    <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded-lg font-semibold">
                      {project.content_id}
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                      {project.id.slice(0, 8)}
                    </span>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(project.priority)}`}>
                  {project.priority || 'NORMAL'}
                </span>
              </div>

              {/* Title/Hook */}
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                  {project.hook || project.title || 'No hook provided'}
                </p>
              </div>

              {/* Videographer Info */}
              {project.videographer && (
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">V</span>
                  <span>Shot by {project.videographer.full_name || project.videographer.email}</span>
                </div>
              )}

              {/* Raw Files Count */}
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                <FolderOpenIcon className="w-4 h-4" />
                <span>{project.production_files?.filter((f: any) => !f.is_deleted).length || 0} raw files available</span>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handlePickProject(project)}
                disabled={pickProjectMutation.isPending}
                className="w-full py-2.5 px-4 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pickProjectMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Picking...
                  </>
                ) : (
                  <>
                    <FilmIcon className="w-4 h-4" />
                    Pick to Edit
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <InboxIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No projects available</h3>
          <p className="mt-2 text-sm text-gray-500">
            All projects have been picked up or are waiting for raw footage. Check back later.
          </p>
        </div>
      )}
    </div>
  );

  // Render My Work Tab
  const renderMyWorkTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">My Edits</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition ${
              showFilters || hasActiveFilters
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or hook..."
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl">
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Stages</option>
              <option value={ProductionStageV2.EDITING}>Editing</option>
              <option value={ProductionStageV2.READY_TO_POST}>Ready to Post</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-700">{stats.editing}</p>
          <p className="text-xs text-orange-600">Editing</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{stats.readyToPost}</p>
          <p className="text-xs text-green-600">Ready to Post</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
          <p className="text-xs text-gray-600">Total</p>
        </div>
      </div>

      {/* Projects List */}
      {isLoadingMyProjects ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : filteredMyProjects.length > 0 ? (
        <div className="space-y-4">
          {filteredMyProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => openViewModal(project)}
              showStage={true}
              showFileCount={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FilmIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {myProjects.length === 0 ? 'No projects yet' : 'No projects match your search'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {myProjects.length === 0
              ? 'Pick a project from the Available tab to get started.'
              : 'Try adjusting your filters.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {filteredMyProjects.length > 0 && (
        <p className="text-xs text-center text-gray-500">
          Showing {filteredMyProjects.length} of {myProjects.length} projects
        </p>
      )}
    </div>
  );

  // Render Profile Tab
  const renderProfileTab = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Profile</h2>
      <p className="text-sm text-gray-600">
        Profile settings coming soon.
      </p>
    </div>
  );

  return (
    <div className="pb-20 md:pb-0">
      {/* Desktop Header - Hidden on mobile */}
      <div className="hidden md:block mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FilmIcon className="w-8 h-8 mr-3 text-purple-600" />
              Editor Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Edit and refine video content
            </p>
          </div>
        </div>

        {/* Desktop Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.available}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <InboxIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Editing</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.editing}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <PlayCircleIcon className="w-6 h-6 text-orange-600" />
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
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

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
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          {currentTab === 'available' ? 'Available Projects' : currentTab === 'mywork' ? 'My Edits' : 'Profile'}
        </h1>
      </div>

      {/* Desktop Tab Switcher */}
      <div className="hidden md:flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('available')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            currentTab === 'available'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Available ({stats.available})
        </button>
        <button
          onClick={() => setTab('mywork')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            currentTab === 'mywork'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          My Edits ({stats.total})
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {currentTab === 'available' && renderAvailableTab()}
        {currentTab === 'mywork' && renderMyWorkTab()}
        {currentTab === 'profile' && renderProfileTab()}
      </div>

      {/* Bottom Navigation (Mobile only) */}
      <BottomNavigation
        role={UserRole.EDITOR}
        badges={{
          available: stats.available > 0 ? stats.available : undefined,
          myWork: stats.editing > 0 ? stats.editing : undefined,
        }}
      />

      {/* View & Edit Modal */}
      {isViewModalOpen && selectedAnalysis && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity hidden sm:block"
            onClick={closeViewModal}
          ></div>
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity sm:hidden"></div>

          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="relative bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center">
                      <FilmIcon className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600 mr-2 flex-shrink-0" />
                      <span className="truncate">Project Details</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                      Script by {selectedAnalysis.full_name} • {new Date(selectedAnalysis.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getPriorityColor(selectedAnalysis.priority)}`}>
                      {selectedAnalysis.priority || 'NORMAL'}
                    </span>
                    <button
                      onClick={closeViewModal}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
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
                      className="text-purple-600 hover:text-purple-700 underline break-all"
                    >
                      {selectedAnalysis.reference_url}
                    </a>
                  </div>

                  {/* Admin Remarks */}
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

                  {/* Script Details Section - Only show if there's actual content */}
                  {(selectedAnalysis.hook || selectedAnalysis.hook_voice_note_url ||
                    selectedAnalysis.why_viral || selectedAnalysis.why_viral_voice_note_url ||
                    selectedAnalysis.how_to_replicate || selectedAnalysis.how_to_replicate_voice_note_url) && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Script Details</h3>

                      {/* Hook - only show if has content */}
                      {(selectedAnalysis.hook || selectedAnalysis.hook_voice_note_url) && (
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
                      )}

                      {/* Why Viral - only show if has content */}
                      {(selectedAnalysis.why_viral || selectedAnalysis.why_viral_voice_note_url) && (
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
                      )}

                      {/* How to Replicate - only show if has content */}
                      {(selectedAnalysis.how_to_replicate || selectedAnalysis.how_to_replicate_voice_note_url) && (
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
                      )}
                    </div>
                  )}

                  {/* Raw Footage Section */}
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <ArrowDownTrayIcon className="w-5 h-5 mr-2 text-blue-600" />
                          Raw Footage
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">Files uploaded by the videographer</p>
                      </div>
                      {rawFootageFiles.length > 1 && (
                        <button
                          onClick={() => handleDownloadAllAsZip(
                            rawFootageFiles,
                            selectedAnalysis?.content_id || selectedAnalysis?.id?.slice(0, 8) || 'raw-footage'
                          )}
                          disabled={isZipping}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait text-sm font-medium transition"
                        >
                          {isZipping ? (
                            <>
                              <svg className="animate-spin w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              {zipProgress || 'Zipping...'}
                            </>
                          ) : (
                            <>
                              <ArrowDownTrayIcon className="w-4 h-4 mr-1.5" />
                              Download All as Zip ({rawFootageFiles.length})
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {rawFootageFiles.length > 0 ? (
                        rawFootageFiles.map((file: ProductionFile) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <DocumentIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                <p className="text-xs text-gray-500">{file.description || file.file_type}</p>
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
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edited Videos Section */}
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
                        Upload
                      </button>
                    </div>

                    {showFileForm && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-semibold text-gray-900">Upload Edited Videos</h4>
                          <button
                            type="button"
                            onClick={() => setShowFileForm(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </div>
                        <MultiFileUploadQueue
                          projectId={selectedAnalysis?.content_id || ''}
                          acceptedFileTypes="video/*"
                          maxSizeMB={500}
                          fileTypeOptions={EDITOR_FILE_TYPES as any}
                          defaultFileType="EDITED_VIDEO"
                          driveFolder="edited-video"
                          onSingleFileComplete={(file) => {
                            if (selectedAnalysis) {
                              uploadFileMutation.mutate({
                                analysisId: selectedAnalysis.id,
                                fileName: file.fileName,
                                fileType: file.fileType,
                                fileUrl: file.fileUrl,
                                fileId: file.fileId,
                              });
                            }
                          }}
                          onUploadComplete={(files) => {
                            if (files.length > 0) {
                              toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded!`);
                              setShowFileForm(false);
                            }
                          }}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      {editedVideoFiles.length > 0 ? (
                        editedVideoFiles.map((file: ProductionFile) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 transition">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <DocumentIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                <p className="text-xs text-gray-500">{file.description || file.file_type}</p>
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
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Production Notes */}
                  <div className="border-t pt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Edit Notes</label>
                    <textarea
                      value={productionNotes}
                      onChange={(e) => setProductionNotes(e.target.value)}
                      rows={3}
                      placeholder="Add notes about the editing process..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t pt-4">
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                      <button
                        onClick={closeViewModal}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleSaveNotes}
                        disabled={updateStageMutation.isPending}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                      >
                        {updateStageMutation.isPending ? 'Saving...' : 'Save Notes'}
                      </button>

                      {(selectedAnalysis.production_stage as string) === ProductionStageV2.EDITING && (
                        <button
                          onClick={handleMarkEditingComplete}
                          disabled={markEditingCompleteMutation.isPending || editedVideoFiles.length === 0}
                          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                          title={editedVideoFiles.length === 0 ? 'Upload at least one edited video first' : ''}
                        >
                          {markEditingCompleteMutation.isPending ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Completing...
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="w-5 h-5 mr-2" />
                              Mark Editing Complete
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {(selectedAnalysis.production_stage as string) === ProductionStageV2.EDITING && editedVideoFiles.length === 0 && (
                      <p className="mt-2 text-xs text-amber-600 text-center sm:text-right">
                        Upload at least one edited video before marking as complete
                      </p>
                    )}
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
