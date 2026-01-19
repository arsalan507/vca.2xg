import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { ChartBarIcon, MagnifyingGlassIcon, CheckCircleIcon, ExclamationTriangleIcon, MinusCircleIcon, ArrowDownTrayIcon, EyeIcon, ChevronRightIcon, CalendarIcon, PlayIcon, SunIcon } from '@heroicons/react/24/outline';
import { ProductionStage } from '@/types';
import type { ViralAnalysis } from '@/types';
import ProductionDetailDrawer from '@/components/admin/ProductionDetailDrawer';

type TabType = 'unassigned' | 'planning' | 'shooting' | 'editing' | 'ready' | 'posted';

interface ProductionFile {
  id: string;
  file_type: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  uploaded_by: string;
}

export default function ProductionStatusPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('unassigned');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [showShootingTodayOnly, setShowShootingTodayOnly] = useState(false);

  // Fetch all approved analyses
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['admin', 'production-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (email, full_name, avatar_url),
          project_assignments (
            role,
            user:user_id (id, email, full_name, avatar_url)
          )
        `)
        .eq('status', 'APPROVED')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      return data.map((item: any) => ({
        ...item,
        email: item.profiles?.email,
        full_name: item.profiles?.full_name,
        avatar_url: item.profiles?.avatar_url,
        videographer: item.project_assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
        editor: item.project_assignments?.find((a: any) => a.role === 'EDITOR')?.user,
        posting_manager: item.project_assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
      })) as ViralAnalysis[];
    },
  });

  // Fetch production files for all analyses
  const { data: productionFiles = {} } = useQuery({
    queryKey: ['admin', 'production-files-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_files')
        .select('*')
        .eq('is_deleted', false);

      if (error) throw error;

      // Group files by analysis_id
      const filesByAnalysis: Record<string, ProductionFile[]> = {};
      (data || []).forEach((file: any) => {
        if (!filesByAnalysis[file.analysis_id]) {
          filesByAnalysis[file.analysis_id] = [];
        }
        filesByAnalysis[file.analysis_id].push(file);
      });
      return filesByAnalysis;
    },
  });

  // Mutation to set planned date
  const setPlannedDateMutation = useMutation({
    mutationFn: async ({ analysisId, plannedDate }: { analysisId: string; plannedDate: string }) => {
      const { error } = await supabase
        .from('viral_analyses')
        .update({
          planned_date: plannedDate,
          production_stage: ProductionStage.PLANNED
        })
        .eq('id', analysisId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-all'] });
      toast.success('Planned date set successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to set planned date');
    },
  });

  // Mutation to start shooting (move to SHOOTING stage)
  const startShootingMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      const { error } = await supabase
        .from('viral_analyses')
        .update({ production_stage: ProductionStage.SHOOTING })
        .eq('id', analysisId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-all'] });
      toast.success('Moved to Shooting stage');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start shooting');
    },
  });

  // Filter by search
  const filteredAnalyses = useMemo(() => {
    if (!searchQuery.trim()) return analyses;
    const search = searchQuery.toLowerCase();
    return analyses.filter(a =>
      a.content_id?.toLowerCase().includes(search) ||
      a.hook?.toLowerCase().includes(search) ||
      a.videographer?.full_name?.toLowerCase().includes(search) ||
      a.editor?.full_name?.toLowerCase().includes(search) ||
      a.posting_manager?.full_name?.toLowerCase().includes(search)
    );
  }, [analyses, searchQuery]);

  // Helper to check if a date is today
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Group by tabs
  const unassigned = filteredAnalyses.filter(a => !a.videographer && !a.editor && !a.posting_manager);

  // Planning tab: PRE_PRODUCTION and PLANNED stages
  const planningAll = filteredAnalyses.filter(a =>
    a.production_stage === ProductionStage.PRE_PRODUCTION ||
    a.production_stage === ProductionStage.PLANNED
  );
  const planningToday = planningAll.filter(a => isToday(a.planned_date));
  const planning = showTodayOnly ? planningToday : planningAll;

  const shootingAll = filteredAnalyses.filter(a =>
    a.production_stage === ProductionStage.SHOOTING ||
    a.production_stage === ProductionStage.SHOOT_REVIEW
  );
  const shootingToday = shootingAll.filter(a => isToday(a.planned_date));
  const shooting = showShootingTodayOnly ? shootingToday : shootingAll;
  const editing = filteredAnalyses.filter(a =>
    a.production_stage === ProductionStage.EDITING ||
    a.production_stage === ProductionStage.EDIT_REVIEW
  );
  const ready = filteredAnalyses.filter(a =>
    a.production_stage === ProductionStage.FINAL_REVIEW ||
    a.production_stage === ProductionStage.READY_TO_POST
  );
  const posted = filteredAnalyses.filter(a => a.production_stage === ProductionStage.POSTED);

  // Debug: Log production stages
  const stageBreakdown = filteredAnalyses.reduce((acc: any, a) => {
    const stage = a.production_stage || 'NOT_STARTED';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  console.log('Stage breakdown:', stageBreakdown);
  console.log('Editing count:', editing.length);
  console.log('Scripts in EDITING stage:', filteredAnalyses.filter(a => a.production_stage === 'EDITING').map(a => a.content_id));
  console.log('Scripts in EDIT_REVIEW stage:', filteredAnalyses.filter(a => a.production_stage === 'EDIT_REVIEW').map(a => a.content_id));

  const tabs = [
    { id: 'unassigned' as TabType, label: 'Unassigned', count: unassigned.length, color: 'red' },
    { id: 'planning' as TabType, label: 'Planning', count: planningAll.length, todayCount: planningToday.length, color: 'cyan' },
    { id: 'shooting' as TabType, label: 'Shooting', count: shootingAll.length, todayCount: shootingToday.length, color: 'indigo' },
    { id: 'editing' as TabType, label: 'Editing', count: editing.length, color: 'purple' },
    { id: 'ready' as TabType, label: 'Ready to Post', count: ready.length, color: 'green' },
    { id: 'posted' as TabType, label: 'Posted', count: posted.length, color: 'emerald' },
  ];

  const getCurrentData = () => {
    switch (activeTab) {
      case 'unassigned': return unassigned;
      case 'planning': return planning;
      case 'shooting': return shooting;
      case 'editing': return editing;
      case 'ready': return ready;
      case 'posted': return posted;
      default: return [];
    }
  };

  const getDaysInStage = (updatedAt: string) => {
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getFileStatus = (analysisId: string, requiredFileType: string, deadline?: string) => {
    const files = productionFiles[analysisId] || [];
    const hasFile = files.some(f => f.file_type === requiredFileType);

    if (hasFile) {
      const file = files.find(f => f.file_type === requiredFileType);
      return { status: 'uploaded', file, icon: CheckCircleIcon, color: 'text-green-600' };
    }

    if (deadline && new Date(deadline) < new Date()) {
      return { status: 'overdue', file: null, icon: ExclamationTriangleIcon, color: 'text-orange-600' };
    }

    return { status: 'pending', file: null, icon: MinusCircleIcon, color: 'text-gray-400' };
  };

  const handleViewFile = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
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

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case ProductionStage.PRE_PRODUCTION: return 'bg-blue-100 text-blue-800';
      case ProductionStage.PLANNED: return 'bg-cyan-100 text-cyan-800';
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

  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center">
              <ChartBarIcon className="w-6 h-6 md:w-7 md:h-7 mr-2 md:mr-3 text-primary-600" />
              Production Status
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAnalyses.length} project{filteredAnalyses.length !== 1 ? 's' : ''} in pipeline
            </p>
          </div>
          <div className="relative w-full md:w-96">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by content ID, hook, team..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8">
        <div className="flex items-center justify-between">
          <div className="flex overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-shrink-0 px-4 md:px-6 py-3 md:py-4 text-sm font-medium border-b-2 transition whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? `bg-${tab.color}-100 text-${tab.color}-800` : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
                {(tab.id === 'planning' || tab.id === 'shooting') && tab.todayCount !== undefined && tab.todayCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold">
                    {tab.todayCount} today
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Planning tab controls */}
          {activeTab === 'planning' && (
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() => setShowTodayOnly(!showTodayOnly)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${showTodayOnly
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }
                `}
              >
                <SunIcon className="w-4 h-4" />
                Planned for Today
                {planningToday.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-200 text-amber-900">
                    {planningToday.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Shooting tab controls */}
          {activeTab === 'shooting' && (
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() => setShowShootingTodayOnly(!showShootingTodayOnly)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${showShootingTodayOnly
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }
                `}
              >
                <SunIcon className="w-4 h-4" />
                Shooting Today
                {shootingToday.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-200 text-amber-900">
                    {shootingToday.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : getCurrentData().length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No projects in this stage</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Content ID
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[200px]">
                      Hook/Title
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Stage
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Team
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Files
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Priority
                    </th>
                    {activeTab === 'planning' && (
                      <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Planned Date
                      </th>
                    )}
                    {activeTab === 'shooting' && (
                      <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Shoot Date
                      </th>
                    )}
                    {activeTab !== 'planning' && activeTab !== 'shooting' && (
                      <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Deadline
                      </th>
                    )}
                    <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Days
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getCurrentData().map((project) => {
                    const daysInStage = getDaysInStage(project.updated_at);
                    let fileStatus;

                    if (activeTab === 'shooting') {
                      fileStatus = getFileStatus(project.id, 'raw-footage', project.deadline);
                    } else if (activeTab === 'editing') {
                      fileStatus = getFileStatus(project.id, 'edited-video', project.deadline);
                    } else if (activeTab === 'ready') {
                      fileStatus = getFileStatus(project.id, 'final-video', project.deadline);
                    }

                    return (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">
                          {project.content_id || '-'}
                        </td>
                        <td className="px-3 md:px-6 py-4 text-sm text-gray-900">
                          <div className="line-clamp-2 max-w-xs">
                            {project.hook || 'No hook provided'}
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(project.production_stage)}`}>
                            {project.production_stage?.replace(/_/g, ' ') || 'NOT STARTED'}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                          <div className="space-y-1">
                            {project.videographer && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">V:</span>
                                <span>{project.videographer.full_name || project.videographer.email}</span>
                              </div>
                            )}
                            {project.editor && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">E:</span>
                                <span>{project.editor.full_name || project.editor.email}</span>
                              </div>
                            )}
                            {project.posting_manager && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">PM:</span>
                                <span>{project.posting_manager.full_name || project.posting_manager.email}</span>
                              </div>
                            )}
                            {!project.videographer && !project.editor && !project.posting_manager && (
                              <span className="text-red-600 font-medium">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                          {fileStatus ? (
                            <div className="flex items-center justify-center gap-2">
                              <fileStatus.icon className={`w-5 h-5 ${fileStatus.color}`} />
                              {fileStatus.file && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleViewFile(fileStatus.file!.file_url)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                    title="View file"
                                  >
                                    <EyeIcon className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadFile(fileStatus.file!.file_url, fileStatus.file!.file_name)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                    title="Download file"
                                  >
                                    <ArrowDownTrayIcon className="w-4 h-4 text-gray-600" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(project.priority)}`}>
                            {project.priority || 'NORMAL'}
                          </span>
                        </td>
                        {activeTab === 'planning' && (
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-center">
                            {project.planned_date ? (
                              <div className={`flex items-center justify-center gap-1 ${isToday(project.planned_date) ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                                <CalendarIcon className="w-4 h-4" />
                                {new Date(project.planned_date).toLocaleDateString()}
                                {isToday(project.planned_date) && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">Today</span>
                                )}
                              </div>
                            ) : (
                              <input
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    setPlannedDateMutation.mutate({ analysisId: project.id, plannedDate: e.target.value });
                                  }
                                }}
                              />
                            )}
                          </td>
                        )}
                        {activeTab === 'shooting' && (
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-center">
                            {project.planned_date ? (
                              <div className={`flex items-center justify-center gap-1 ${isToday(project.planned_date) ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                                <CalendarIcon className="w-4 h-4" />
                                {new Date(project.planned_date).toLocaleDateString()}
                                {isToday(project.planned_date) && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">Today</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </td>
                        )}
                        {activeTab !== 'planning' && activeTab !== 'shooting' && (
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-center">
                            {project.deadline ? (
                              <div className={`${new Date(project.deadline) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {new Date(project.deadline).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className={`${daysInStage > 7 ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                            {daysInStage}d
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Quick Start Shooting button for PLANNED items */}
                            {activeTab === 'planning' && project.production_stage === ProductionStage.PLANNED && (
                              <button
                                onClick={() => startShootingMutation.mutate(project.id)}
                                disabled={startShootingMutation.isPending}
                                className="inline-flex items-center px-2.5 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                                title="Start Shooting"
                              >
                                <PlayIcon className="w-3.5 h-3.5 mr-1" />
                                Start
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedAnalysis(project);
                                setShowDetailDrawer(true);
                              }}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                              title="View details"
                            >
                              View <ChevronRightIcon className="w-4 h-4 ml-1" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Production Detail Drawer */}
      <ProductionDetailDrawer
        analysis={selectedAnalysis}
        isOpen={showDetailDrawer}
        onClose={() => {
          setShowDetailDrawer(false);
          setSelectedAnalysis(null);
        }}
      />
    </div>
  );
}
