import {
  ClockIcon,
  UserGroupIcon,
  VideoCameraIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  LinkIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import type { ViralAnalysis } from '@/types';
import { ProductionStageLabels, ProductionStageColors } from '@/types';

interface ProjectCardProps {
  project: ViralAnalysis;
  onClick?: () => void;
  onPlayReel?: (e: React.MouseEvent) => void;
  actionButton?: {
    label: string;
    onClick: (e: React.MouseEvent) => void;
  };
  showStage?: boolean;
  showFileCount?: boolean;
  compact?: boolean;
}

const getPriorityConfig = (priority?: string) => {
  switch (priority) {
    case 'URGENT':
      return { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' };
    case 'HIGH':
      return { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' };
    case 'NORMAL':
      return { color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
    case 'LOW':
      return { color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
    default:
      return { color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  }
};

export default function ProjectCard({
  project,
  onClick,
  onPlayReel,
  actionButton,
  showStage = true,
  showFileCount = false,
  compact = false,
}: ProjectCardProps) {
  const priorityConfig = getPriorityConfig(project.priority);
  const stageColor = project.production_stage
    ? ProductionStageColors[project.production_stage] || 'bg-gray-100 text-gray-800'
    : 'bg-gray-100 text-gray-800';
  const stageLabel = project.production_stage
    ? ProductionStageLabels[project.production_stage] || project.production_stage
    : 'Unknown';

  const fileCount = project.production_files?.filter(f => !f.is_deleted).length || 0;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm active:shadow-md transition-all ${
          onClick ? 'cursor-pointer active:scale-[0.99]' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {project.content_id && (
                <span className="text-xs font-mono text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                  {project.content_id}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />
                {project.priority || 'NORMAL'}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 line-clamp-1">
              {project.hook || project.title || 'Untitled'}
            </p>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md active:shadow-md transition-all ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      }`}
    >
      {/* Header: ID + Priority */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {project.content_id ? (
            <span className="text-xs font-mono text-primary-600 bg-primary-50 px-2 py-1 rounded-lg font-semibold">
              {project.content_id}
            </span>
          ) : (
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
              {project.id.slice(0, 8)}
            </span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityConfig.color}`}>
          <span className={`w-2 h-2 rounded-full ${priorityConfig.dot}`} />
          {project.priority || 'NORMAL'}
        </span>
      </div>

      {/* Title/Hook */}
      <div className="mb-3">
        <div className="flex items-start gap-2">
          <VideoCameraIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-gray-900 line-clamp-2">
            {project.hook || project.title || 'No hook provided'}
          </p>
        </div>
      </div>

      {/* Script Writer */}
      {project.full_name && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <DocumentTextIcon className="w-4 h-4" />
          <span>Script by {project.full_name}</span>
        </div>
      )}

      {/* Reference Link */}
      {project.reference_url && (
        <div className="mb-3 flex items-center gap-2">
          <a
            href={project.reference_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 hover:underline bg-primary-50 px-2 py-1 rounded-lg transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>View Reference</span>
          </a>
          {onPlayReel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayReel(e);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 px-2.5 py-1 rounded-lg transition-all shadow-sm hover:shadow"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              <span>View Reel</span>
            </button>
          )}
        </div>
      )}

      {/* Meta info row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mb-3">
        {showStage && (
          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${stageColor}`}>
            {stageLabel}
          </span>
        )}

        {project.deadline && (
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            <span>{new Date(project.deadline).toLocaleDateString()}</span>
          </div>
        )}

        {project.total_people_involved && (
          <div className="flex items-center gap-1">
            <UserGroupIcon className="w-4 h-4" />
            <span>{project.total_people_involved} people</span>
          </div>
        )}

        {showFileCount && fileCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">{fileCount} files</span>
          </div>
        )}
      </div>

      {/* Profile & Tags */}
      {(project.profile || project.hook_tags?.length || project.character_tags?.length) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.profile && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {project.profile.name}
            </span>
          )}
          {project.hook_tags?.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
            >
              {tag.name}
            </span>
          ))}
          {project.character_tags?.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700"
            >
              {tag.name}
            </span>
          ))}
          {((project.hook_tags?.length || 0) > 2 || (project.character_tags?.length || 0) > 2) && (
            <span className="text-xs text-gray-400">
              +{(project.hook_tags?.length || 0) + (project.character_tags?.length || 0) - 4} more
            </span>
          )}
        </div>
      )}

      {/* Team Members */}
      {(project.videographer || project.editor || project.posting_manager) && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          {project.videographer && (
            <div
              className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm"
              title={`Videographer: ${project.videographer.full_name || project.videographer.email}`}
            >
              <span className="text-xs font-semibold text-blue-700">V</span>
            </div>
          )}
          {project.editor && (
            <div
              className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center border-2 border-white shadow-sm -ml-2"
              title={`Editor: ${project.editor.full_name || project.editor.email}`}
            >
              <span className="text-xs font-semibold text-purple-700">E</span>
            </div>
          )}
          {project.posting_manager && (
            <div
              className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center border-2 border-white shadow-sm -ml-2"
              title={`Posting: ${project.posting_manager.full_name || project.posting_manager.email}`}
            >
              <span className="text-xs font-semibold text-pink-700">P</span>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {actionButton && (
        <div className="pt-3 mt-3 border-t border-gray-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              actionButton.onClick(e);
            }}
            className="w-full py-2.5 px-4 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors flex items-center justify-center gap-2"
          >
            {actionButton.label}
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
