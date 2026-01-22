import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentService } from '@/services/assignmentService';
import {
  MegaphoneIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
  EyeIcon,
  TableCellsIcon,
  ViewColumnsIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { ViralAnalysis, UpdateProductionStageData } from '@/types';
import { ProductionStage } from '@/types';

// View types for the dashboard
type ViewType = 'table' | 'kanban' | 'calendar';

// Kanban columns configuration for posting manager
const KANBAN_COLUMNS = [
  { id: ProductionStage.FINAL_REVIEW, label: 'Final Review', color: 'bg-indigo-500' },
  { id: ProductionStage.READY_TO_POST, label: 'Ready to Post', color: 'bg-green-500' },
  { id: ProductionStage.POSTED, label: 'Posted', color: 'bg-gray-500' },
];

// Calendar helper functions
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
const formatMonthYear = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default function PostingManagerDashboard() {
  const queryClient = useQueryClient();
  const [selectedAnalysis, setSelectedAnalysis] = useState<ViralAnalysis | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [productionNotes, setProductionNotes] = useState('');

  // View management state
  const [currentView, setCurrentView] = useState<ViewType>('table');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

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

  // Filtered analyses based on selected filters
  const filteredAnalyses = useMemo(() => {
    return analyses.filter(analysis => {
      if (filterStage && analysis.production_stage !== filterStage) return false;
      if (filterPriority && analysis.priority !== filterPriority) return false;
      return true;
    });
  }, [analyses, filterStage, filterPriority]);

  // Group analyses by stage for Kanban view
  const kanbanGroups = useMemo(() => {
    const groups: Record<string, ViralAnalysis[]> = {};
    KANBAN_COLUMNS.forEach(col => {
      groups[col.id] = filteredAnalyses.filter(a => a.production_stage === col.id);
    });
    return groups;
  }, [filteredAnalyses]);

  // Group analyses by date for Calendar view
  const calendarEvents = useMemo(() => {
    const events: Record<string, ViralAnalysis[]> = {};
    filteredAnalyses.forEach(analysis => {
      // Use deadline or planned_date for calendar positioning
      const dateStr = analysis.deadline || analysis.planned_date;
      if (dateStr) {
        const date = new Date(dateStr).toISOString().split('T')[0];
        if (!events[date]) events[date] = [];
        events[date].push(analysis);
      }
    });
    return events;
  }, [filteredAnalyses]);

  // Calendar navigation
  const prevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCalendarDate(new Date());
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: { date: Date | null; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Next month padding (fill to 42 cells for 6 rows)
    while (days.length < 42) {
      days.push({ date: null, isCurrentMonth: false });
    }

    return days;
  }, [calendarDate]);

  // Clear all filters
  const clearFilters = () => {
    setFilterStage('');
    setFilterPriority('');
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

      {/* View Switcher & Filters - Notion-style header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">My Assigned Projects</h2>

            <div className="flex items-center gap-3">
              {/* View Switcher Tabs - Notion style */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrentView('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    currentView === 'table'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <TableCellsIcon className="w-4 h-4" />
                  Table
                </button>
                <button
                  onClick={() => setCurrentView('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    currentView === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ViewColumnsIcon className="w-4 h-4" />
                  Kanban
                </button>
                <button
                  onClick={() => setCurrentView('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    currentView === 'calendar'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <CalendarDaysIcon className="w-4 h-4" />
                  Calendar
                </button>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  showFilters || filterStage || filterPriority
                    ? 'bg-pink-50 text-pink-700 border-pink-200'
                    : 'text-gray-600 hover:text-gray-900 border-gray-200 hover:border-gray-300'
                }`}
              >
                <FunnelIcon className="w-4 h-4" />
                Filter
                {(filterStage || filterPriority) && (
                  <span className="ml-1 w-5 h-5 bg-pink-600 text-white rounded-full text-xs flex items-center justify-center">
                    {(filterStage ? 1 : 0) + (filterPriority ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="">All Stages</option>
                <option value={ProductionStage.FINAL_REVIEW}>Final Review</option>
                <option value={ProductionStage.READY_TO_POST}>Ready to Post</option>
                <option value={ProductionStage.POSTED}>Posted</option>
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>

              {(filterStage || filterPriority) && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="text-center py-12">
              <MegaphoneIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">
                {analyses.length === 0 ? 'No projects assigned yet' : 'No projects match your filters'}
              </p>
              {(filterStage || filterPriority) && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm text-pink-600 hover:text-pink-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* TABLE VIEW */}
              {currentView === 'table' && (
                <div className="overflow-x-auto">
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
                      {filteredAnalyses.map((analysis) => (
                        <tr key={analysis.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openViewModal(analysis)}>
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
                              onClick={(e) => { e.stopPropagation(); openViewModal(analysis); }}
                              className="text-pink-600 hover:text-pink-900"
                            >
                              View & Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* KANBAN VIEW */}
              {currentView === 'kanban' && (
                <div className="p-6">
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {KANBAN_COLUMNS.map((column) => (
                      <div key={column.id} className="flex-shrink-0 w-80">
                        {/* Column Header */}
                        <div className="flex items-center gap-2 mb-3 px-2">
                          <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                          <h3 className="font-semibold text-gray-700">{column.label}</h3>
                          <span className="ml-auto text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {kanbanGroups[column.id]?.length || 0}
                          </span>
                        </div>

                        {/* Column Cards */}
                        <div className="space-y-3 min-h-[200px] bg-gray-50 rounded-lg p-2">
                          {kanbanGroups[column.id]?.map((analysis) => (
                            <div
                              key={analysis.id}
                              onClick={() => openViewModal(analysis)}
                              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            >
                              {/* Card Priority Badge */}
                              <div className="flex items-center justify-between mb-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(analysis.priority)}`}>
                                  {analysis.priority || 'NORMAL'}
                                </span>
                                {analysis.deadline && (
                                  <span className="text-xs text-gray-500">
                                    {new Date(analysis.deadline).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              {/* Card Title */}
                              <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                                {analysis.hook || 'No hook provided'}
                              </p>

                              {/* Card Meta */}
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{analysis.target_emotion}</span>
                                <div className="flex items-center gap-1">
                                  {analysis.videographer && (
                                    <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center" title={analysis.videographer.full_name || analysis.videographer.email}>
                                      <span className="text-[10px] font-medium text-primary-700">V</span>
                                    </div>
                                  )}
                                  {analysis.editor && (
                                    <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center" title={analysis.editor.full_name || analysis.editor.email}>
                                      <span className="text-[10px] font-medium text-purple-700">E</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Quality Score */}
                              {analysis.overall_score && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <div className="flex items-center gap-1">
                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                                        style={{ width: `${analysis.overall_score * 10}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-600">{analysis.overall_score}/10</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          {(!kanbanGroups[column.id] || kanbanGroups[column.id].length === 0) && (
                            <div className="text-center py-8 text-gray-400 text-sm">
                              No items
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CALENDAR VIEW */}
              {currentView === 'calendar' && (
                <div className="p-6">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {formatMonthYear(calendarDate)}
                      </h3>
                      <button
                        onClick={goToToday}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300"
                      >
                        Today
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={prevMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7">
                      {calendarDays.map((day, index) => {
                        const dateStr = day.date?.toISOString().split('T')[0];
                        const dayEvents = dateStr ? calendarEvents[dateStr] || [] : [];
                        const isToday = day.date?.toDateString() === new Date().toDateString();

                        return (
                          <div
                            key={index}
                            className={`min-h-[120px] border-b border-r border-gray-200 p-2 ${
                              day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                            } ${index % 7 === 0 ? '' : ''}`}
                          >
                            {day.date && (
                              <>
                                <div className={`text-sm font-medium mb-1 ${
                                  isToday
                                    ? 'w-7 h-7 bg-pink-600 text-white rounded-full flex items-center justify-center'
                                    : day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                }`}>
                                  {day.date.getDate()}
                                </div>

                                {/* Events for this day */}
                                <div className="space-y-1">
                                  {dayEvents.slice(0, 3).map((event) => (
                                    <div
                                      key={event.id}
                                      onClick={() => openViewModal(event)}
                                      className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${
                                        event.production_stage === ProductionStage.READY_TO_POST
                                          ? 'bg-green-100 text-green-800'
                                          : event.production_stage === ProductionStage.POSTED
                                          ? 'bg-gray-100 text-gray-800'
                                          : 'bg-indigo-100 text-indigo-800'
                                      }`}
                                      title={event.hook || 'No hook'}
                                    >
                                      {event.hook?.slice(0, 20) || 'No hook'}...
                                    </div>
                                  ))}
                                  {dayEvents.length > 3 && (
                                    <div className="text-xs text-gray-500 pl-1">
                                      +{dayEvents.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Calendar Legend */}
                  <div className="mt-4 flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200"></div>
                      <span className="text-gray-600">Final Review</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                      <span className="text-gray-600">Ready to Post</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></div>
                      <span className="text-gray-600">Posted</span>
                    </div>
                  </div>
                </div>
              )}
            </>
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
