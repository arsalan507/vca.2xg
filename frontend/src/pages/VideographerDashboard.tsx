import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { assignmentService } from '@/services/assignmentService';
import { productionFilesService } from '@/services/productionFilesService';
import { videographerProjectService } from '@/services/videographerProjectService';
import { videographerQueueService } from '@/services/videographerQueueService';
import { contentConfigService } from '@/services/contentConfigService';
import { VideoCameraIcon, ClockIcon, CheckCircleIcon, PlayCircleIcon, CloudArrowUpIcon, TrashIcon, DocumentIcon, MagnifyingGlassIcon, XMarkIcon, FunnelIcon, UserGroupIcon, PlusIcon, ArrowPathIcon, InboxIcon, ChevronLeftIcon, ChevronRightIcon, ArrowPathRoundedSquareIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { ViralAnalysis, UpdateProductionStageData, ProductionFile, CastFilter, CastComposition } from '@/types';
import { ProductionStage, FileType, UserRole, ProductionStageV2 } from '@/types';
import { CastFilterDropdown, ActiveCastFilters } from '@/components/filters';
import MultiFileUploadQueue from '@/components/MultiFileUploadQueue';
import BottomNavigation from '@/components/BottomNavigation';
import ProjectCard from '@/components/ProjectCard';
import PickProjectModal from '@/components/PickProjectModal';

// Constants for dropdowns
const SHOOT_TYPES = ['Indoor', 'Outdoor', 'Both'];

const HOOK_TYPES = [
  { id: 'visual', label: 'Visual Hook' },
  { id: 'audio', label: 'Audio Hook' },
  { id: 'sfx', label: 'SFX Hook' },
  { id: 'onscreen', label: 'Onscreen Hook' },
];

const WORKS_WITHOUT_AUDIO_OPTIONS = ['Yes', 'No', 'Maybe'];

interface NewProjectFormData {
  referenceUrl: string;
  title: string;
  shootType: string;
  creatorName: string;
  hookTypes: string[];
  worksWithoutAudio: string;
  profileId: string;
}

type TabType = 'available' | 'mywork' | 'profile';

export default function VideographerDashboard() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current tab from URL or default to 'available'
  const currentTab = (searchParams.get('tab') as TabType) || 'available';

  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [productionNotes, setProductionNotes] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isPickProjectModalOpen, setIsPickProjectModalOpen] = useState(false);
  const [selectedProjectToPick, setSelectedProjectToPick] = useState<ViralAnalysis | null>(null);

  // New project form state
  const [newProjectForm, setNewProjectForm] = useState<NewProjectFormData>({
    referenceUrl: '',
    title: '',
    shootType: '',
    creatorName: '',
    hookTypes: [],
    worksWithoutAudio: '',
    profileId: '',
  });
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // File upload state
  const [showFileForm, setShowFileForm] = useState(false);

  // Profile selection state for view modal (when profile not set during pick)
  const [editingProfileId, setEditingProfileId] = useState<string>('');

  // Reel viewer state
  const [isReelViewerOpen, setIsReelViewerOpen] = useState(false);
  const [reelViewerIndex, setReelViewerIndex] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);

  // Rejected projects state (persisted in localStorage)
  const [rejectedIds, setRejectedIds] = useState<string[]>(() => videographerQueueService.getRejectedProjectIds());

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [castFilter, setCastFilter] = useState<CastFilter>({});
  const [availableCastFilter, setAvailableCastFilter] = useState<CastFilter>({});

  // Fetch available projects (PLANNING queue)
  const { data: availableProjects = [], isLoading: isLoadingAvailable, refetch: refetchAvailable } = useQuery({
    queryKey: ['videographer', 'available'],
    queryFn: () => videographerQueueService.getAvailableProjects(),
  });

  // Fetch my assigned analyses
  const { data: assignmentsData, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['videographer', 'assignments'],
    queryFn: () => assignmentService.getMyAssignedAnalyses(),
  });

  const myProjects = assignmentsData?.data || [];

  // Fetch files for selected analysis
  const { data: productionFiles = [] } = useQuery({
    queryKey: ['production-files', selectedAnalysis?.id],
    queryFn: () => productionFilesService.getFiles(selectedAnalysis!.id),
    enabled: !!selectedAnalysis?.id,
  });

  // Fetch profiles for new project modal and view modal
  const { data: profiles = [] } = useQuery({
    queryKey: ['profile-list'],
    queryFn: contentConfigService.getAllProfiles,
    enabled: isNewProjectModalOpen || isViewModalOpen,
  });


  // Create profile mutation (for new project modal)
  const createProfileMutation = useMutation({
    mutationFn: (name: string) => contentConfigService.createProfile({ name }),
    onSuccess: (newProfile) => {
      queryClient.invalidateQueries({ queryKey: ['profile-list'] });
      setNewProjectForm(prev => ({ ...prev, profileId: newProfile.id }));
      setNewProfileName('');
      setIsAddingProfile(false);
      toast.success(`Profile "${newProfile.name}" created!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create profile');
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
      fileType: 'raw-footage',
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

  // Mark shooting complete mutation
  const markShootingCompleteMutation = useMutation({
    mutationFn: (data: { analysisId: string; productionNotes?: string }) =>
      videographerQueueService.markShootingComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videographer', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['videographer', 'my-projects'] });
      toast.success('Shooting marked as complete! Project moved to editing queue.');
      setIsViewModalOpen(false);
      setSelectedAnalysis(null);
      setProductionNotes('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark shooting complete');
    },
  });

  // Set profile and generate content ID mutation
  const setProfileMutation = useMutation({
    mutationFn: async (data: { analysisId: string; profileId: string }) => {
      // First update the profile
      const { error: updateError } = await supabase
        .from('viral_analyses')
        .update({ profile_id: data.profileId })
        .eq('id', data.analysisId);

      if (updateError) throw updateError;

      // Then generate content ID if not already set
      const { data: analysis } = await supabase
        .from('viral_analyses')
        .select('content_id')
        .eq('id', data.analysisId)
        .single();

      if (!analysis?.content_id) {
        const { error: contentIdError } = await supabase.rpc(
          'generate_content_id_on_approval',
          {
            p_analysis_id: data.analysisId,
            p_profile_id: data.profileId,
          }
        );

        if (contentIdError) {
          console.error('Failed to generate content_id:', contentIdError);
          throw new Error('Failed to generate content ID');
        }
      }

      // Fetch and return updated analysis
      return videographerQueueService.getProjectById(data.analysisId);
    },
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ['videographer', 'assignments'] });
      // Update the selected analysis with new data
      setSelectedAnalysis(updatedProject);
      setEditingProfileId('');
      toast.success('Profile set and Content ID generated!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to set profile');
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
      resetNewProjectForm();
      // Switch to My Work tab
      setSearchParams({ tab: 'mywork' });
      // Open the new project
      openViewModal(newAnalysis);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  // Reset new project form
  const resetNewProjectForm = () => {
    setNewProjectForm({
      referenceUrl: '',
      title: '',
      shootType: '',
      creatorName: '',
      hookTypes: [],
      worksWithoutAudio: '',
      profileId: '',
    });
    setIsAddingProfile(false);
    setNewProfileName('');
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isNewProjectModalOpen) {
      resetNewProjectForm();
    }
  }, [isNewProjectModalOpen]);

  // Handle new project submission
  const handleNewProjectSubmit = () => {
    const errors: string[] = [];
    if (!newProjectForm.referenceUrl.trim()) errors.push('Reference Link');
    if (!newProjectForm.title.trim()) errors.push('Title');
    if (!newProjectForm.profileId) errors.push('Profile');

    if (errors.length > 0) {
      toast.error(`Please fill: ${errors.join(', ')}`);
      return;
    }

    // Map form data to service format
    createProjectMutation.mutate({
      referenceUrl: newProjectForm.referenceUrl,
      title: newProjectForm.title,
      shootType: newProjectForm.shootType || undefined,
      creatorName: newProjectForm.creatorName || undefined,
      hookTypes: newProjectForm.hookTypes.length > 0 ? newProjectForm.hookTypes : undefined,
      worksWithoutAudio: newProjectForm.worksWithoutAudio || undefined,
      profileId: newProjectForm.profileId,
    });
  };

  const openViewModal = (analysis: ViralAnalysis) => {
    setSelectedAnalysis(analysis);
    // Initialize to SHOOTING stage (videographer's default starting stage)
    // If project is already in a videographer stage, use that
    const currentStage = analysis.production_stage;
    const isVideographerStage = currentStage && videographerStages.includes(currentStage as any);
    setSelectedStage(isVideographerStage ? currentStage! : ProductionStage.SHOOTING);
    setProductionNotes(analysis.production_notes || '');
    setEditingProfileId(''); // Reset profile editing state
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedAnalysis(null);
    setSelectedStage('');
    setProductionNotes('');
    setShowFileForm(false);
    setEditingProfileId(''); // Reset profile editing state
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

  const handleMarkShootingComplete = () => {
    if (!selectedAnalysis) return;

    markShootingCompleteMutation.mutate({
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
    setSelectedProjectToPick(project);
    setIsPickProjectModalOpen(true);
  };

  const handlePickProjectSuccess = (project: ViralAnalysis) => {
    // Switch to My Work tab and open the project
    setSearchParams({ tab: 'mywork' });
    openViewModal(project);
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
      case ProductionStageV2.PLANNING: return 'bg-blue-100 text-blue-800';
      case ProductionStageV2.SHOOTING: return 'bg-yellow-100 text-yellow-800';
      case ProductionStageV2.READY_FOR_EDIT: return 'bg-purple-100 text-purple-800';
      case ProductionStageV2.EDITING: return 'bg-orange-100 text-orange-800';
      case ProductionStageV2.READY_TO_POST: return 'bg-green-100 text-green-800';
      case ProductionStageV2.POSTED: return 'bg-gray-100 text-gray-800';
      // Legacy stages
      case ProductionStage.PRE_PRODUCTION: return 'bg-blue-100 text-blue-800';
      case ProductionStage.PLANNED: return 'bg-cyan-100 text-cyan-800';
      case ProductionStage.SHOOT_REVIEW: return 'bg-yellow-100 text-yellow-800';
      case ProductionStage.EDIT_REVIEW: return 'bg-pink-100 text-pink-800';
      case ProductionStage.FINAL_REVIEW: return 'bg-indigo-100 text-indigo-800';
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

  // Stats calculations are below (after filteredAvailableProjects is defined)

  // Videographers can only move to SHOOTING or submit for READY_FOR_EDIT
  const videographerStages = [
    ProductionStage.SHOOTING,
    ProductionStageV2.SHOOTING,
    ProductionStage.SHOOT_REVIEW, // Legacy
    ProductionStageV2.READY_FOR_EDIT,
  ];

  // Helper function to check if a project matches cast filter
  const matchesCastFilter = (project: ViralAnalysis, filter: CastFilter): boolean => {
    const cast = project.cast_composition as CastComposition | null;
    if (!cast) return Object.keys(filter).length === 0; // If no cast, only match if no filters

    // Check men filter
    if (filter.minMen !== undefined && (cast.man || 0) < filter.minMen) return false;
    if (filter.maxMen !== undefined && (cast.man || 0) > filter.maxMen) return false;

    // Check women filter
    if (filter.minWomen !== undefined && (cast.woman || 0) < filter.minWomen) return false;
    if (filter.maxWomen !== undefined && (cast.woman || 0) > filter.maxWomen) return false;

    // Check boys filter
    if (filter.minBoys !== undefined && (cast.boy || 0) < filter.minBoys) return false;
    if (filter.maxBoys !== undefined && (cast.boy || 0) > filter.maxBoys) return false;

    // Check girls filter
    if (filter.minGirls !== undefined && (cast.girl || 0) < filter.minGirls) return false;
    if (filter.maxGirls !== undefined && (cast.girl || 0) > filter.maxGirls) return false;

    // Check total filter
    if (filter.minTotal !== undefined && (cast.total || 0) < filter.minTotal) return false;
    if (filter.maxTotal !== undefined && (cast.total || 0) > filter.maxTotal) return false;

    // Check owner filter
    if (filter.ownerRequired === true && !cast.include_owner) return false;
    if (filter.ownerRequired === false && cast.include_owner) return false;

    // Check needs children
    if (filter.needsChildren && (cast.boy || 0) === 0 && (cast.girl || 0) === 0) return false;

    // Check needs seniors
    if (filter.needsSeniors && (cast.senior_man || 0) === 0 && (cast.senior_woman || 0) === 0) return false;

    // Check needs teens
    if (filter.needsTeens && (cast.teen_boy || 0) === 0 && (cast.teen_girl || 0) === 0) return false;

    return true;
  };

  // Filtered analyses based on search and filters
  const filteredMyProjects = useMemo(() => {
    return myProjects.filter(analysis => {
      // Search by project ID (content_id or id) or hook
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesContentId = analysis.content_id?.toLowerCase().includes(query);
        const matchesId = analysis.id.toLowerCase().includes(query);
        const matchesHook = analysis.hook?.toLowerCase().includes(query);
        if (!matchesContentId && !matchesId && !matchesHook) return false;
      }
      if (filterStage && analysis.production_stage !== filterStage) return false;
      if (filterPriority && analysis.priority !== filterPriority) return false;

      // Cast filter
      if (Object.keys(castFilter).length > 0 && !matchesCastFilter(analysis, castFilter)) return false;

      return true;
    });
  }, [myProjects, searchQuery, filterStage, filterPriority, castFilter]);

  // Filtered available projects based on cast filter and rejections
  const filteredAvailableProjects = useMemo(() => {
    let projects = availableProjects.filter(p => !rejectedIds.includes(p.id));
    if (Object.keys(availableCastFilter).length > 0) {
      projects = projects.filter(project => matchesCastFilter(project, availableCastFilter));
    }
    return projects;
  }, [availableProjects, availableCastFilter, rejectedIds]);

  // Stats calculations — use filtered count so rejected projects are excluded from the tab badge
  const stats = {
    available: filteredAvailableProjects.length,
    shooting: myProjects.filter(a => a.production_stage === ProductionStageV2.SHOOTING).length,
    readyForEdit: myProjects.filter(a => a.production_stage === ProductionStageV2.READY_FOR_EDIT).length,
    total: myProjects.length,
  };

  // Check if any filters are active
  const hasActiveFilters = searchQuery || filterStage || filterPriority || Object.keys(castFilter).length > 0;
  const hasAvailableFilters = Object.keys(availableCastFilter).length > 0;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterStage('');
    setFilterPriority('');
    setCastFilter({});
  };

  // Clear available project filters
  const clearAvailableFilters = () => {
    setAvailableCastFilter({});
  };

  // Instagram embed URL helper
  const getInstagramEmbedUrl = (url: string): string | null => {
    const match = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    return `https://www.instagram.com/reel/${match[1]}/embed`;
  };

  // Reel viewer handlers
  const openReelViewer = useCallback((projectIndex: number) => {
    setReelViewerIndex(projectIndex);
    setIframeKey(0);
    setIsReelViewerOpen(true);
  }, []);

  const closeReelViewer = useCallback(() => {
    setIsReelViewerOpen(false);
  }, []);

  const goToNextReel = useCallback(() => {
    if (reelViewerIndex < filteredAvailableProjects.length - 1) {
      setReelViewerIndex(prev => prev + 1);
      setIframeKey(0);
    }
  }, [reelViewerIndex, filteredAvailableProjects.length]);

  const goToPrevReel = useCallback(() => {
    if (reelViewerIndex > 0) {
      setReelViewerIndex(prev => prev - 1);
      setIframeKey(0);
    }
  }, [reelViewerIndex]);

  const replayReel = useCallback(() => {
    setIframeKey(prev => prev + 1);
  }, []);

  const handleAcceptFromViewer = useCallback(() => {
    const project = filteredAvailableProjects[reelViewerIndex];
    if (!project) return;
    setIsReelViewerOpen(false);
    handlePickProject(project);
  }, [filteredAvailableProjects, reelViewerIndex]);

  const handleRejectReel = useCallback(() => {
    const project = filteredAvailableProjects[reelViewerIndex];
    if (project) {
      videographerQueueService.rejectProject(project.id);
      setRejectedIds(prev => [...prev, project.id]);
    }
    // The rejected project gets filtered out, so the next project slides into the same index.
    // If we were on the last item, step back or close.
    const remainingAfterReject = filteredAvailableProjects.length - 1;
    if (remainingAfterReject <= 0) {
      setIsReelViewerOpen(false);
    } else if (reelViewerIndex >= remainingAfterReject) {
      setReelViewerIndex(remainingAfterReject - 1);
    }
    setIframeKey(prev => prev + 1);
  }, [filteredAvailableProjects, reelViewerIndex]);

  // Swipe handling for mobile reel viewer
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndY.current = e.targetTouches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndY.current = e.targetTouches[0].clientY;
    const distance = Math.abs(touchStartY.current - touchEndY.current);
    if (distance > 10) isSwiping.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;
    const swipeDistance = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 60;

    if (swipeDistance > minSwipeDistance) {
      // Swipe up → next reel
      goToNextReel();
    } else if (swipeDistance < -minSwipeDistance) {
      // Swipe down → previous reel
      goToPrevReel();
    }
  }, [goToNextReel, goToPrevReel]);

  // Remove specific cast filter key
  const removeCastFilterKey = (key: keyof CastFilter) => {
    setCastFilter(prev => {
      const newFilter = { ...prev };
      delete newFilter[key];
      return newFilter;
    });
  };

  // Remove specific available cast filter key
  const removeAvailableCastFilterKey = (key: keyof CastFilter) => {
    setAvailableCastFilter(prev => {
      const newFilter = { ...prev };
      delete newFilter[key];
      return newFilter;
    });
  };

  // Set tab in URL
  const setTab = (tab: TabType) => {
    setSearchParams({ tab });
  };

  // Render Available Projects Tab
  const renderAvailableTab = () => (
    <div className="space-y-4">
      {/* Header with refresh and filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Available Projects</h2>
        <div className="flex items-center gap-2">
          <CastFilterDropdown
            filters={availableCastFilter}
            onChange={setAvailableCastFilter}
            matchCount={filteredAvailableProjects.length}
          />
          <button
            onClick={() => refetchAvailable()}
            disabled={isLoadingAvailable}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isLoadingAvailable ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Pick a project to start shooting. Projects in the planning stage are waiting for a videographer.
      </p>

      {/* Rejected projects info */}
      {rejectedIds.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">
            {rejectedIds.length} rejected project{rejectedIds.length !== 1 ? 's' : ''} hidden
          </span>
          <button
            onClick={() => {
              videographerQueueService.clearAllRejections();
              setRejectedIds([]);
            }}
            className="text-primary-600 hover:text-primary-700 font-medium underline"
          >
            Show all
          </button>
        </div>
      )}

      {/* Active Cast Filters */}
      {hasAvailableFilters && (
        <ActiveCastFilters
          filters={availableCastFilter}
          onRemove={removeAvailableCastFilterKey}
          onClearAll={clearAvailableFilters}
        />
      )}

      {isLoadingAvailable ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredAvailableProjects.length > 0 ? (
        <div className="space-y-4">
          {filteredAvailableProjects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              showStage={false}
              onPlayReel={project.reference_url ? () => openReelViewer(index) : undefined}
              actionButton={{
                label: 'Pick Project',
                onClick: () => handlePickProject(project),
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <InboxIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {availableProjects.length === 0 ? 'No projects available' : 'No projects match your filters'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {availableProjects.length === 0
              ? 'All projects have been picked up. Check back later for new ones.'
              : 'Try adjusting your cast filter to see more projects.'}
          </p>
          {hasAvailableFilters && (
            <button
              onClick={clearAvailableFilters}
              className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Render My Work Tab
  const renderMyWorkTab = () => (
    <div className="space-y-4">
      {/* Header with search */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">My Projects</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition ${
              showFilters || hasActiveFilters
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
            {hasActiveFilters && (
              <span className="sr-only">Filters active</span>
            )}
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
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
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
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Stages</option>
              <option value={ProductionStageV2.SHOOTING}>Shooting</option>
              <option value={ProductionStageV2.READY_FOR_EDIT}>Ready for Edit</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>

            <CastFilterDropdown
              filters={castFilter}
              onChange={setCastFilter}
              matchCount={filteredMyProjects.length}
            />

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

        {/* Active Cast Filters */}
        {Object.keys(castFilter).length > 0 && (
          <ActiveCastFilters
            filters={castFilter}
            onRemove={removeCastFilterKey}
            onClearAll={() => setCastFilter({})}
          />
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700">{stats.shooting}</p>
          <p className="text-xs text-yellow-600">Shooting</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{stats.readyForEdit}</p>
          <p className="text-xs text-purple-600">Ready for Edit</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
          <p className="text-xs text-gray-600">Total</p>
        </div>
      </div>

      {/* Projects List */}
      {isLoadingAssignments ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
          <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
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
              className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
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
        Profile settings coming soon. For now, use the top navigation to access settings.
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
                <p className="text-sm font-medium text-gray-600">Shooting</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.shooting}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <PlayCircleIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready for Edit</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.readyForEdit}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

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
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          {currentTab === 'available' ? 'Available Projects' : currentTab === 'mywork' ? 'My Projects' : 'Profile'}
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
          My Work ({stats.total})
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
        role={UserRole.VIDEOGRAPHER}
        onNewAction={() => setIsNewProjectModalOpen(true)}
        badges={{
          available: stats.available > 0 ? stats.available : undefined,
          myWork: stats.shooting > 0 ? stats.shooting : undefined,
        }}
      />

      {/* Full-Screen Reel Viewer */}
      {isReelViewerOpen && filteredAvailableProjects.length > 0 && (() => {
        const currentProject = filteredAvailableProjects[reelViewerIndex];
        if (!currentProject) return null;
        const embedUrl = currentProject.reference_url ? getInstagramEmbedUrl(currentProject.reference_url) : null;

        return (
          <div className="fixed inset-0 z-50 bg-black">
            {/* Mobile View */}
            <div
              className="md:hidden h-full w-full flex flex-col"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="relative flex-1 w-full">
                {embedUrl ? (
                  <iframe
                    key={`${currentProject.id}-${iframeKey}`}
                    src={embedUrl}
                    className="absolute inset-0 w-full h-full border-0"
                    allowFullScreen
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    title={currentProject.hook || currentProject.title || `Reel ${reelViewerIndex + 1}`}
                    loading="eager"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <p className="text-center px-4">No embeddable reel found for this reference URL</p>
                  </div>
                )}

                {/* Top black overlay to hide profile/username */}
                <div className="absolute top-0 left-0 right-0 h-[70px] bg-black z-10" />

                {/* Top overlay with close button and info */}
                <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-20">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium bg-black/50 px-2 py-1 rounded-full">
                      {reelViewerIndex + 1}/{filteredAvailableProjects.length}
                    </span>
                    {currentProject.content_id && (
                      <span className="text-xs font-mono text-pink-300 bg-black/50 px-2 py-1 rounded-full">
                        {currentProject.content_id}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={closeReelViewer}
                    className="p-2 rounded-full bg-black/50 text-white active:bg-white/20"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Project info overlay */}
                <div className="absolute top-[70px] left-0 right-0 px-3 py-2 z-20">
                  <p className="text-white text-sm font-medium line-clamp-2 drop-shadow-lg">
                    {currentProject.hook || currentProject.title || 'Untitled'}
                  </p>
                  {currentProject.full_name && (
                    <p className="text-white/70 text-xs mt-0.5 drop-shadow-lg">
                      Script by {currentProject.full_name}
                    </p>
                  )}
                </div>

                {/* Left/Right navigation arrows */}
                {reelViewerIndex > 0 && (
                  <button
                    onClick={goToPrevReel}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white active:bg-black/60 transition-all"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                )}
                {reelViewerIndex < filteredAvailableProjects.length - 1 && (
                  <button
                    onClick={goToNextReel}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white active:bg-black/60 transition-all"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                )}

                {/* Bottom overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-[130px] bg-black z-10" />

                {/* Replay button */}
                <button
                  onClick={replayReel}
                  className="absolute bottom-[140px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 active:bg-white/30 text-white text-sm"
                >
                  <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                  Replay
                </button>
              </div>

              {/* Fixed bottom action bar for mobile */}
              <div className="flex-shrink-0 bg-black px-4 py-3 pb-safe">
                <div className="flex items-center justify-between max-w-sm mx-auto gap-3">
                  <button
                    onClick={handleRejectReel}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-red-500/20 text-red-400 active:bg-red-500 active:text-white transition-all"
                  >
                    <XMarkIcon className="h-5 w-5" />
                    <span className="font-medium">Reject</span>
                  </button>

                  <button
                    onClick={handleAcceptFromViewer}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-green-500 text-white active:bg-green-600 transition-all shadow-lg"
                  >
                    <CheckIcon className="h-5 w-5" />
                    <span className="font-medium">Accept</span>
                  </button>
                </div>

                {/* Navigation dots */}
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {filteredAvailableProjects.slice(0, 8).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setReelViewerIndex(idx); setIframeKey(0); }}
                      className={`rounded-full transition-all ${
                        idx === reelViewerIndex
                          ? 'bg-white w-2 h-2'
                          : 'bg-white/40 w-1.5 h-1.5'
                      }`}
                    />
                  ))}
                  {filteredAvailableProjects.length > 8 && (
                    <span className="text-white/50 text-xs ml-1">+{filteredAvailableProjects.length - 8}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex h-full w-full items-center justify-center">
              {/* Close button */}
              <button
                onClick={closeReelViewer}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-20"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              {/* Top info */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
                <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                  {reelViewerIndex + 1} / {filteredAvailableProjects.length}
                </span>
                {currentProject.priority && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    currentProject.priority === 'URGENT' ? 'bg-red-500/80 text-white' :
                    currentProject.priority === 'HIGH' ? 'bg-orange-500/80 text-white' :
                    currentProject.priority === 'NORMAL' ? 'bg-blue-500/80 text-white' :
                    'bg-gray-500/80 text-white'
                  }`}>
                    {currentProject.priority}
                  </span>
                )}
              </div>

              {/* Project info panel (left side) */}
              <div className="absolute left-4 top-16 bottom-20 w-64 z-20 flex flex-col">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-white space-y-3 overflow-y-auto">
                  <h3 className="font-semibold text-sm line-clamp-3">
                    {currentProject.hook || currentProject.title || 'Untitled'}
                  </h3>
                  {currentProject.full_name && (
                    <p className="text-white/70 text-xs">Script by {currentProject.full_name}</p>
                  )}
                  {currentProject.content_id && (
                    <span className="inline-block text-xs font-mono text-pink-300 bg-black/30 px-2 py-1 rounded">
                      {currentProject.content_id}
                    </span>
                  )}
                  {currentProject.total_people_involved && (
                    <div className="flex items-center gap-1.5 text-xs text-white/70">
                      <UserGroupIcon className="w-4 h-4" />
                      <span>{currentProject.total_people_involved} people</span>
                    </div>
                  )}
                  {currentProject.deadline && (
                    <div className="flex items-center gap-1.5 text-xs text-white/70">
                      <ClockIcon className="w-4 h-4" />
                      <span>{new Date(currentProject.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Prev button */}
                <button
                  onClick={goToPrevReel}
                  disabled={reelViewerIndex === 0}
                  className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>

                {/* Iframe container */}
                <div className="relative" style={{ width: '380px', height: 'calc(100vh - 180px)' }}>
                  {embedUrl ? (
                    <iframe
                      key={`${currentProject.id}-${iframeKey}`}
                      src={embedUrl}
                      className="w-full h-full border-0 rounded-lg"
                      allowFullScreen
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      title={currentProject.hook || currentProject.title || `Reel ${reelViewerIndex + 1}`}
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full border-0 rounded-lg bg-gray-900 flex items-center justify-center text-white">
                      <p className="text-center px-4">No embeddable reel for this URL</p>
                    </div>
                  )}

                  {/* Top black overlay */}
                  <div className="absolute top-0 left-0 right-0 h-[65px] bg-black rounded-t-lg z-10" />
                  {/* Bottom black overlay */}
                  <div className="absolute bottom-0 left-0 right-0 h-[140px] bg-black rounded-b-lg z-10" />

                  {/* Replay button */}
                  <button
                    onClick={replayReel}
                    className="absolute bottom-[150px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm transition-all"
                  >
                    <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                    Replay
                  </button>
                </div>

                {/* Next button */}
                <button
                  onClick={goToNextReel}
                  disabled={reelViewerIndex === filteredAvailableProjects.length - 1}
                  className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Bottom action bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-6">
                  <button
                    onClick={handleRejectReel}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <XMarkIcon className="h-5 w-5" />
                    <span className="font-medium">Reject</span>
                  </button>

                  {/* Navigation dots */}
                  <div className="flex items-center gap-1.5">
                    {filteredAvailableProjects.slice(0, 10).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setReelViewerIndex(idx); setIframeKey(0); }}
                        className={`rounded-full transition-all ${
                          idx === reelViewerIndex
                            ? 'bg-white w-2.5 h-2.5'
                            : 'bg-white/40 w-2 h-2 hover:bg-white/60'
                        }`}
                      />
                    ))}
                    {filteredAvailableProjects.length > 10 && (
                      <span className="text-white/50 text-xs ml-1">+{filteredAvailableProjects.length - 10}</span>
                    )}
                  </div>

                  <button
                    onClick={handleAcceptFromViewer}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg"
                  >
                    <CheckIcon className="h-5 w-5" />
                    <span className="font-medium">Accept & Pick</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pick Project Modal */}
      <PickProjectModal
        isOpen={isPickProjectModalOpen}
        onClose={() => {
          setIsPickProjectModalOpen(false);
          setSelectedProjectToPick(null);
        }}
        project={selectedProjectToPick}
        onSuccess={handlePickProjectSuccess}
      />

      {/* View & Update Modal */}
      {isViewModalOpen && selectedAnalysis && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop - only clickable on desktop, not on mobile to prevent accidental closes */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity hidden sm:block"
            onClick={closeViewModal}
          ></div>
          {/* Mobile backdrop - no click handler to prevent accidental navigation */}
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity sm:hidden"></div>

          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="relative bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {/* Mobile header with close button */}
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center">
                      <VideoCameraIcon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600 mr-2 flex-shrink-0" />
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
                    {/* Close button - visible on all screen sizes */}
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

                  {/* Planned Date - if set */}
                  {selectedAnalysis.planned_date && (
                    <div className={`rounded-lg p-4 ${
                      new Date(selectedAnalysis.planned_date).toDateString() === new Date().toDateString()
                        ? 'bg-amber-100 border border-amber-300'
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Planned Shoot Date:</span>
                        <span className={`font-bold ${
                          new Date(selectedAnalysis.planned_date).toDateString() === new Date().toDateString()
                            ? 'text-amber-800'
                            : 'text-blue-800'
                        }`}>
                          {new Date(selectedAnalysis.planned_date).toLocaleDateString()}
                        </span>
                        {new Date(selectedAnalysis.planned_date).toDateString() === new Date().toDateString() && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-800">TODAY</span>
                        )}
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

                  {/* Target Emotion & Expected Outcome - only show if has content */}
                  {(selectedAnalysis.target_emotion || selectedAnalysis.expected_outcome) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {selectedAnalysis.target_emotion && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Target Emotion</label>
                          <p className="text-gray-900 font-medium">{selectedAnalysis.target_emotion}</p>
                        </div>
                      )}
                      {selectedAnalysis.expected_outcome && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Expected Outcome</label>
                          <p className="text-gray-900 font-medium">{selectedAnalysis.expected_outcome}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Deadline & Budget */}
                  {(selectedAnalysis.deadline || selectedAnalysis.budget) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                    {/* Multi-File Upload Form */}
                    {showFileForm && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-semibold text-gray-900">Upload Multiple Files</h4>
                          <button
                            type="button"
                            onClick={() => setShowFileForm(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <span className="sr-only">Close</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <MultiFileUploadQueue
                          projectId={selectedAnalysis?.content_id || ''}
                          acceptedFileTypes="video/*,audio/*"
                          maxSizeMB={500}
                          onSingleFileComplete={(file) => {
                            // Save each file to database as it completes
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
                            // All files uploaded
                            if (files.length > 0) {
                              toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded successfully!`);
                              setShowFileForm(false);
                            }
                          }}
                        />
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
                  <div className="border-t pt-4 sm:pt-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Production Details</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      {/* Project Info */}
                      <div className="space-y-4">
                        {/* Profile Selection - Required for Content ID */}
                        <div className={`p-3 rounded-lg border-2 ${!selectedAnalysis.profile_id ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                            <UserGroupIcon className="w-4 h-4" />
                            Profile
                            {!selectedAnalysis.profile_id && (
                              <span className="text-xs text-amber-700 font-normal">(Required for Content ID)</span>
                            )}
                          </label>
                          {selectedAnalysis.profile_id ? (
                            <div className="flex flex-wrap gap-2">
                              <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white ring-2 ring-indigo-300">
                                <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                                {selectedAnalysis.profile?.name || profiles.find((p: any) => p.id === selectedAnalysis.profile_id)?.name || 'Unknown Profile'}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {profiles.filter((p: any) => p.is_active).map((profile: any) => {
                                  const isSelected = editingProfileId === profile.id;
                                  return (
                                    <button
                                      key={profile.id}
                                      type="button"
                                      onClick={() => setEditingProfileId(profile.id)}
                                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                                          : 'bg-white border border-gray-300 text-gray-700 hover:border-indigo-400'
                                      }`}
                                    >
                                      {isSelected && <CheckCircleIcon className="w-4 h-4 inline mr-1" />}
                                      {profile.name}
                                    </button>
                                  );
                                })}
                              </div>
                              {editingProfileId && (
                                <button
                                  onClick={() => setProfileMutation.mutate({ analysisId: selectedAnalysis.id, profileId: editingProfileId })}
                                  disabled={setProfileMutation.isPending}
                                  className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                                >
                                  {setProfileMutation.isPending ? 'Setting Profile...' : 'Set Profile & Generate Content ID'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700">Project ID</label>
                          <p className={`mt-1 text-sm ${selectedAnalysis.content_id ? 'text-gray-900 font-medium' : 'text-gray-400 italic'}`}>
                            {selectedAnalysis.content_id || 'Will be generated when profile is selected'}
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Production Stage</label>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${getStageColor(selectedAnalysis.production_stage)}`}>
                              {selectedAnalysis.production_stage === ProductionStageV2.SHOOTING && '🎬 Shooting'}
                              {selectedAnalysis.production_stage === ProductionStageV2.READY_FOR_EDIT && '✅ Ready for Edit'}
                              {selectedAnalysis.production_stage === ProductionStage.SHOOT_REVIEW && '⏳ Pending Review (Legacy)'}
                              {!selectedAnalysis.production_stage && 'Unknown'}
                              {selectedAnalysis.production_stage &&
                                selectedAnalysis.production_stage !== ProductionStageV2.SHOOTING &&
                                selectedAnalysis.production_stage !== ProductionStageV2.READY_FOR_EDIT &&
                                selectedAnalysis.production_stage !== ProductionStage.SHOOT_REVIEW &&
                                selectedAnalysis.production_stage.replace(/_/g, ' ')}
                            </span>
                          </div>
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
                    <div className="mt-4 sm:mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Production Notes</label>
                      <textarea
                        value={productionNotes}
                        onChange={(e) => setProductionNotes(e.target.value)}
                        rows={3}
                        placeholder="Add notes about the shoot, issues encountered, progress updates..."
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                      />
                      <p className="mt-1.5 sm:mt-2 text-xs text-gray-500">These notes will be visible to the admin and other team members</p>
                    </div>

                    {/* Action Buttons - Inside scrollable content */}
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                        <button
                          onClick={closeViewModal}
                          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                        >
                          Cancel
                        </button>

                        {/* Save Notes Button */}
                        <button
                          onClick={() => handleUpdateStage()}
                          disabled={updateStageMutation.isPending}
                          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
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

                        {/* Mark Shooting Complete Button - Only shown when in SHOOTING stage */}
                        {selectedAnalysis.production_stage === ProductionStageV2.SHOOTING && (
                          <button
                            onClick={handleMarkShootingComplete}
                            disabled={markShootingCompleteMutation.isPending || productionFiles.length === 0 || !selectedAnalysis.profile_id}
                            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
                            title={!selectedAnalysis.profile_id ? 'Select a profile first' : productionFiles.length === 0 ? 'Upload at least one file first' : ''}
                          >
                            {markShootingCompleteMutation.isPending ? (
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
                                Mark Shooting Complete
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {selectedAnalysis.production_stage === ProductionStageV2.SHOOTING && (!selectedAnalysis.profile_id || productionFiles.length === 0) && (
                        <p className="mt-2 text-xs text-amber-600 text-center sm:text-right">
                          {!selectedAnalysis.profile_id
                            ? 'Select a profile above before marking shooting as complete'
                            : 'Upload at least one file before marking shooting as complete'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop - only clickable on desktop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity hidden sm:block"
            onClick={() => setIsNewProjectModalOpen(false)}
          ></div>
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity sm:hidden"></div>

          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex-shrink-0 bg-gradient-to-r from-primary-600 to-purple-600 px-4 sm:px-6 py-4 flex items-center justify-between">
                <div className="flex items-center text-white">
                  <VideoCameraIcon className="w-6 h-6 mr-2" />
                  <div>
                    <h2 className="text-lg font-bold">New Project</h2>
                    <p className="text-xs text-white/80">Create and start shooting</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

                {/* Reference Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Link <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={newProjectForm.referenceUrl}
                    onChange={(e) => setNewProjectForm(prev => ({ ...prev, referenceUrl: e.target.value }))}
                    placeholder="https://www.instagram.com/reel/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProjectForm.title}
                    onChange={(e) => setNewProjectForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter a title for this project"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                </div>

                {/* Shoot Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shoot Type</label>
                  <div className="flex flex-wrap gap-2">
                    {SHOOT_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewProjectForm(prev => ({ ...prev, shootType: type }))}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          newProjectForm.shootType === type
                            ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                            : 'bg-white border border-gray-300 text-gray-700 hover:border-primary-400'
                        }`}
                      >
                        {newProjectForm.shootType === type && <CheckCircleIcon className="w-4 h-4 inline mr-1" />}
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Creator Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Creator Name</label>
                  <input
                    type="text"
                    value={newProjectForm.creatorName}
                    onChange={(e) => setNewProjectForm(prev => ({ ...prev, creatorName: e.target.value }))}
                    placeholder="Name of the original creator"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                </div>

                {/* Hook Type - Multi-select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hook Type <span className="text-gray-400">(select all that apply)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {HOOK_TYPES.map((hook) => {
                      const isSelected = newProjectForm.hookTypes.includes(hook.id);
                      return (
                        <button
                          key={hook.id}
                          type="button"
                          onClick={() => {
                            setNewProjectForm(prev => ({
                              ...prev,
                              hookTypes: isSelected
                                ? prev.hookTypes.filter(h => h !== hook.id)
                                : [...prev.hookTypes, hook.id]
                            }));
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                              : 'bg-white border border-gray-300 text-gray-700 hover:border-purple-400'
                          }`}
                        >
                          {isSelected && <CheckCircleIcon className="w-4 h-4 inline mr-1" />}
                          {hook.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Works Without Audio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Works Without Audio?</label>
                  <div className="flex flex-wrap gap-2">
                    {WORKS_WITHOUT_AUDIO_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setNewProjectForm(prev => ({ ...prev, worksWithoutAudio: option }))}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          newProjectForm.worksWithoutAudio === option
                            ? 'bg-green-600 text-white ring-2 ring-green-300'
                            : 'bg-white border border-gray-300 text-gray-700 hover:border-green-400'
                        }`}
                      >
                        {newProjectForm.worksWithoutAudio === option && <CheckCircleIcon className="w-4 h-4 inline mr-1" />}
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Profile Selection */}
                <div className={`rounded-lg p-3 border ${!newProjectForm.profileId ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200'}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <UserGroupIcon className="w-4 h-4 inline mr-1" />
                    Profile <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {profiles
                      .filter((p: any) => p.is_active)
                      .map((profile: any) => {
                        const isSelected = newProjectForm.profileId === profile.id;
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => setNewProjectForm(prev => ({ ...prev, profileId: profile.id }))}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                                : 'bg-white border border-gray-300 text-gray-700 hover:border-indigo-400'
                            }`}
                          >
                            {isSelected && <CheckCircleIcon className="w-4 h-4 inline mr-1" />}
                            {profile.name}
                          </button>
                        );
                      })}
                    {!isAddingProfile && (
                      <button
                        type="button"
                        onClick={() => setIsAddingProfile(true)}
                        className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border border-dashed border-gray-400"
                      >
                        <PlusIcon className="w-4 h-4 inline mr-1" />
                        Add
                      </button>
                    )}
                    {isAddingProfile && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          placeholder="New profile name"
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 w-32"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newProfileName.trim()) {
                              e.preventDefault();
                              createProfileMutation.mutate(newProfileName.trim());
                            } else if (e.key === 'Escape') {
                              setIsAddingProfile(false);
                              setNewProfileName('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newProfileName.trim()) {
                              createProfileMutation.mutate(newProfileName.trim());
                            }
                          }}
                          disabled={!newProfileName.trim() || createProfileMutation.isPending}
                          className="px-2 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {createProfileMutation.isPending ? '...' : 'Add'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingProfile(false);
                            setNewProfileName('');
                          }}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This will create a project with a proper content ID and assign it to you. You can start uploading footage immediately.
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 sm:px-6">
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    disabled={createProjectMutation.isPending}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNewProjectSubmit}
                    disabled={createProjectMutation.isPending}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center text-sm font-medium"
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
                      <>
                        <VideoCameraIcon className="w-5 h-5 mr-2" />
                        Create Project
                      </>
                    )}
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
