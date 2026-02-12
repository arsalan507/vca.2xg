import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Folder } from 'lucide-react';
import { adminService, type QueueStats } from '@/services/adminService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'shooting' | 'editing' | 'edit_review' | 'ready';

interface StageSection {
  id: string;
  emoji: string;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  stages: string[];
}

const STAGE_SECTIONS: StageSection[] = [
  {
    id: 'shooting',
    emoji: '🎬',
    label: 'Shooting',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    stages: ['SHOOTING'],
  },
  {
    id: 'editing',
    emoji: '✂️',
    label: 'Editing',
    color: 'bg-pink-500',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    stages: ['READY_FOR_EDIT', 'SHOOT_REVIEW', 'EDITING'],
  },
  {
    id: 'edit_review',
    emoji: '🔍',
    label: 'Edit Review',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    stages: ['EDIT_REVIEW'],
  },
  {
    id: 'ready',
    emoji: '✅',
    label: 'Ready to Post',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    stages: ['READY_TO_POST', 'FINAL_REVIEW'],
  },
];

export default function ProductionPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [allProjects, setAllProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, shootingProjects, editingProjects, readyForEditProjects, editReviewProjects, readyToPostProjects] = await Promise.all([
        adminService.getQueueStats(),
        adminService.getAnalysesByStage('shooting'),
        adminService.getAnalysesByStage('editing'),
        adminService.getAnalysesByStage('ready_for_edit'),
        adminService.getAnalysesByStage('edit_review'),
        adminService.getAnalysesByStage('ready_to_post'),
      ]);
      setStats(statsData);
      setAllProjects([...shootingProjects, ...readyForEditProjects, ...editingProjects, ...editReviewProjects, ...readyToPostProjects]);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load production data');
    } finally {
      setLoading(false);
    }
  };

  const getProjectsBySection = (sectionId: string) => {
    const section = STAGE_SECTIONS.find(s => s.id === sectionId);
    if (!section) return [];
    return allProjects.filter(p => section.stages.includes(p.production_stage || ''));
  };

  const getFilteredSections = () => {
    if (filter === 'all') return STAGE_SECTIONS;
    return STAGE_SECTIONS.filter(s => s.id === filter);
  };

  const getPlatformLabel = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram_reel': return { emoji: '📸', label: 'Instagram' };
      case 'youtube_shorts': return { emoji: '🎬', label: 'YouTube Shorts' };
      case 'youtube_long': return { emoji: '▶️', label: 'YouTube' };
      default: return { emoji: '📹', label: 'Video' };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Started today';
    if (diffDays === 1) return 'Started 1d ago';
    return `Started ${diffDays}d ago`;
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || '??';
  };

  const getStageProgress = (stage?: string) => {
    switch (stage) {
      case 'SHOOTING': return 20;
      case 'READY_FOR_EDIT':
      case 'SHOOT_REVIEW': return 40;
      case 'EDITING': return 55;
      case 'EDIT_REVIEW': return 75;
      case 'READY_TO_POST':
      case 'FINAL_REVIEW': return 90;
      default: return 10;
    }
  };

  const totalPipeline = (stats?.shooting || 0) + (stats?.readyForEdit || 0) + (stats?.editing || 0) + (stats?.editReview || 0) + (stats?.readyToPost || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <Link
          to="/admin"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Production</h1>
          <p className="text-sm text-gray-500">{totalPipeline} projects in pipeline</p>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-5 gap-2 mb-4"
      >
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <div className="text-xl font-bold text-orange-500">{stats?.shooting || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase">Shooting</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <div className="text-xl font-bold text-pink-500">{(stats?.readyForEdit || 0) + (stats?.editing || 0)}</div>
          <div className="text-[10px] text-gray-500 uppercase">Editing</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <div className="text-xl font-bold text-amber-500">{stats?.editReview || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase">Review</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <div className="text-xl font-bold text-green-500">{stats?.readyToPost || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase">Ready</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <div className="text-xl font-bold text-cyan-500">{stats?.posted || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase">Posted</div>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar -mx-4 px-4"
      >
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            filter === 'all'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          All
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === 'all' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {totalPipeline}
          </span>
        </button>
        <button
          onClick={() => setFilter('shooting')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            filter === 'shooting'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Shooting
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === 'shooting' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {stats?.shooting || 0}
          </span>
        </button>
        <button
          onClick={() => setFilter('editing')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            filter === 'editing'
              ? 'bg-pink-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Editing
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === 'editing' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {(stats?.readyForEdit || 0) + (stats?.editing || 0)}
          </span>
        </button>
        <button
          onClick={() => setFilter('edit_review')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            filter === 'edit_review'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Review
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === 'edit_review' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {stats?.editReview || 0}
          </span>
        </button>
        <button
          onClick={() => setFilter('ready')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            filter === 'ready'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Ready
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === 'ready' ? 'bg-white/20' : 'bg-gray-200'}`}>
            {stats?.readyToPost || 0}
          </span>
        </button>
      </motion.div>

      {/* Sections */}
      {getFilteredSections().map((section, sectionIndex) => {
        const sectionProjects = getProjectsBySection(section.id);
        if (sectionProjects.length === 0) return null;

        return (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + sectionIndex * 0.05 }}
            className="mb-6"
          >
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>{section.emoji}</span>
              {section.label}
            </h2>

            <div className="space-y-3">
              {sectionProjects.map((project) => {
                const platform = getPlatformLabel(project.platform);
                const assignee = project.videographer || project.editor || project.posting_manager;
                const assigneeRole = project.videographer ? 'Videographer' :
                  project.editor ? 'Editor' :
                  project.posting_manager ? 'Posting Manager' : null;

                return (
                  <Link
                    key={project.id}
                    to={`/admin/project/${project.id}`}
                    className="block bg-white rounded-xl p-4 border border-gray-100 active:bg-gray-50"
                  >
                    {/* Title and Badge */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 flex-1 truncate pr-2">
                        {project.title || 'Untitled Project'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${section.bgColor} ${section.textColor} whitespace-nowrap`}>
                        {section.label.split(' ')[0]}
                      </span>
                    </div>

                    {/* Content ID and Time */}
                    <p className="text-sm text-gray-500 mb-2">
                      {project.content_id || 'No ID'} • {formatTimeAgo(project.created_at)}
                    </p>

                    {/* Platform and Files */}
                    <div className="flex gap-2 mb-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                        {platform.emoji} {platform.label}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                        <Folder className="w-3 h-3" />
                        {project.files_count || 0} files
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full ${section.color} rounded-full transition-all`}
                        style={{ width: `${getStageProgress(project.production_stage)}%` }}
                      />
                    </div>

                    {/* Assignee */}
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full ${section.color} flex items-center justify-center text-white text-xs font-semibold`}>
                          {getInitials(assignee.full_name, assignee.email)}
                        </div>
                        <span className="text-sm text-gray-600">
                          {assignee.full_name || assignee.email} ({assigneeRole})
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No assignee yet</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.section>
        );
      })}

      {/* Empty State */}
      {totalPipeline === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="text-5xl mb-4">🎬</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Projects in Production</h3>
          <p className="text-gray-500 text-sm">Approved scripts will appear here</p>
        </motion.div>
      )}
    </div>
  );
}
