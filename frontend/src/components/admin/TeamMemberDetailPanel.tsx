/**
 * Team Member Detail Panel - Shows projects for a selected team member
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  UserCircleIcon,
  DocumentTextIcon,
  VideoCameraIcon,
  FilmIcon,
  MegaphoneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { ViralAnalysis } from '@/types';

interface TeamMemberDetailPanelProps {
  memberId: string | null;
  memberName: string;
  memberRole: string;
  onClose?: () => void;
}

export default function TeamMemberDetailPanel({
  memberId,
  memberName,
  memberRole,
  onClose,
}: TeamMemberDetailPanelProps) {
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Fetch projects based on role
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['team-member-projects', memberId, memberRole],
    queryFn: async () => {
      if (!memberId) return [];

      let data: any[] = [];

      // Filter based on role
      if (memberRole === 'SCRIPT_WRITER') {
        const { data: analyses, error } = await supabase
          .from('viral_analyses')
          .select('*')
          .eq('user_id', memberId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = analyses || [];
      } else {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('project_assignments')
          .select('analysis_id')
          .eq('user_id', memberId)
          .eq('role', memberRole);

        if (assignmentsError) throw assignmentsError;

        if (assignments && assignments.length > 0) {
          const analysisIds = assignments.map((a: any) => a.analysis_id);

          const { data: analyses, error } = await supabase
            .from('viral_analyses')
            .select('*')
            .in('id', analysisIds)
            .order('created_at', { ascending: false });

          if (error) throw error;
          data = analyses || [];
        }
      }

      // Fetch related profile data and production files
      if (data && data.length > 0) {
        const analysisIds = data.map((d) => d.id);

        const { data: allAssignments } = await supabase
          .from('project_assignments')
          .select('analysis_id, user_id, role')
          .in('analysis_id', analysisIds);

        const { data: allFiles } = await supabase
          .from('production_files')
          .select('*')
          .in('analysis_id', analysisIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        const userIds = new Set<string>();
        data.forEach((project) => {
          if (project.user_id) userIds.add(project.user_id);
        });
        allAssignments?.forEach((assignment: any) => {
          if (assignment.user_id) userIds.add(assignment.user_id);
        });
        allFiles?.forEach((file: any) => {
          if (file.uploaded_by) userIds.add(file.uploaded_by);
        });

        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', Array.from(userIds));

          const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

          data.forEach((project) => {
            if (project.user_id) {
              const creator: any = profileMap.get(project.user_id);
              if (creator) {
                project.full_name = creator.full_name;
                project.email = creator.email;
              }
            }

            const projectAssignments =
              allAssignments?.filter((a: any) => a.analysis_id === project.id) || [];
            projectAssignments.forEach((assignment: any) => {
              const profile = profileMap.get(assignment.user_id);
              if (profile) {
                if (assignment.role === 'VIDEOGRAPHER') {
                  project.videographer = profile;
                } else if (assignment.role === 'EDITOR') {
                  project.editor = profile;
                } else if (assignment.role === 'POSTING_MANAGER') {
                  project.posting_manager = profile;
                }
              }
            });

            const projectFiles = allFiles?.filter((f: any) => f.analysis_id === project.id) || [];
            projectFiles.forEach((file: any) => {
              if (file.uploaded_by) {
                file.uploader = profileMap.get(file.uploaded_by);
              }
            });
            project.production_files = projectFiles;
          });
        }
      }

      return data as ViralAnalysis[];
    },
    enabled: !!memberId,
  });

  if (!memberId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center px-6 py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <UserCircleIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No member selected</h3>
          <p className="text-sm text-gray-500">
            Click on a team member's name to view their projects
          </p>
        </div>
      </div>
    );
  }

  const getRoleIcon = () => {
    switch (memberRole) {
      case 'SCRIPT_WRITER':
        return <DocumentTextIcon className="w-5 h-5 text-blue-600" />;
      case 'VIDEOGRAPHER':
        return <VideoCameraIcon className="w-5 h-5 text-indigo-600" />;
      case 'EDITOR':
        return <FilmIcon className="w-5 h-5 text-purple-600" />;
      case 'POSTING_MANAGER':
        return <MegaphoneIcon className="w-5 h-5 text-pink-600" />;
      default:
        return <UserCircleIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getRoleBgColor = () => {
    switch (memberRole) {
      case 'SCRIPT_WRITER':
        return 'from-blue-50 to-indigo-50';
      case 'VIDEOGRAPHER':
        return 'from-indigo-50 to-purple-50';
      case 'EDITOR':
        return 'from-purple-50 to-pink-50';
      case 'POSTING_MANAGER':
        return 'from-pink-50 to-rose-50';
      default:
        return 'from-gray-50 to-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProductionStageColor = (stage: string) => {
    switch (stage) {
      case 'NOT_STARTED':
        return 'bg-gray-100 text-gray-800';
      case 'PRE_PRODUCTION':
      case 'SHOOTING':
        return 'bg-blue-100 text-blue-800';
      case 'SHOOT_REVIEW':
      case 'EDITING':
        return 'bg-purple-100 text-purple-800';
      case 'EDIT_REVIEW':
      case 'FINAL_REVIEW':
        return 'bg-indigo-100 text-indigo-800';
      case 'READY_TO_POST':
        return 'bg-orange-100 text-orange-800';
      case 'POSTED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStageName = (stage: string) => {
    return stage
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatRoleName = (role: string) => {
    return role
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div
        className={`flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gradient-to-r ${getRoleBgColor()}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
              {getRoleIcon()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{memberName}</h2>
              <p className="text-sm text-gray-600">
                {formatRoleName(memberRole)} • {projects.length} project
                {projects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/10 rounded-full transition"
              title="Close panel"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-gray-500">No projects found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {projects.map((project) => (
              <div key={project.id} className="p-4 hover:bg-gray-50 transition">
                {/* Project Header */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {project.content_id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                          {project.content_id}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}
                      >
                        {project.status}
                      </span>
                      {project.production_stage && (
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getProductionStageColor(project.production_stage)}`}
                        >
                          {formatStageName(project.production_stage)}
                        </span>
                      )}
                      {project.rejection_count !== undefined && project.rejection_count > 0 && (
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            project.rejection_count >= 4
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          Rejected {project.rejection_count}x
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm">
                      {project.hook || 'Untitled Project'}
                    </h3>
                  </div>

                  <button
                    onClick={() =>
                      setExpandedProjectId(expandedProjectId === project.id ? null : project.id)
                    }
                    className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition flex items-center flex-shrink-0"
                  >
                    {expandedProjectId === project.id ? (
                      <>
                        <ChevronUpIcon className="w-3 h-3 mr-1" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="w-3 h-3 mr-1" />
                        More
                      </>
                    )}
                  </button>
                </div>

                {/* Basic Info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {project.target_emotion && <span>Emotion: {project.target_emotion}</span>}
                  {project.expected_outcome && <span>Outcome: {project.expected_outcome}</span>}
                  {memberRole !== 'SCRIPT_WRITER' && (
                    <span>By: {project.full_name || project.email}</span>
                  )}
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>

                {/* Reference URL */}
                {project.reference_url && (
                  <a
                    href={project.reference_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    View Reference →
                  </a>
                )}

                {/* Expanded Details */}
                {expandedProjectId === project.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    {/* Why Viral */}
                    {project.why_viral && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-1">
                          Why It's Viral:
                        </h4>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">
                          {project.why_viral}
                        </p>
                      </div>
                    )}

                    {/* How to Replicate */}
                    {project.how_to_replicate && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-1">
                          How to Replicate:
                        </h4>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">
                          {project.how_to_replicate}
                        </p>
                      </div>
                    )}

                    {/* Production Info */}
                    {(project.priority || project.deadline || project.production_notes) && (
                      <div className="bg-blue-50 p-2 rounded text-xs">
                        <h4 className="font-semibold text-gray-700 mb-1">Production Info:</h4>
                        <div className="grid grid-cols-2 gap-1">
                          {project.priority && (
                            <div>
                              <span className="text-gray-600">Priority:</span>{' '}
                              <span className="font-medium">{project.priority}</span>
                            </div>
                          )}
                          {project.deadline && (
                            <div>
                              <span className="text-gray-600">Deadline:</span>{' '}
                              <span className="font-medium">
                                {new Date(project.deadline).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        {project.production_notes && (
                          <p className="text-gray-600 mt-1">{project.production_notes}</p>
                        )}
                      </div>
                    )}

                    {/* Rejection Feedback */}
                    {project.status === 'REJECTED' && project.feedback && (
                      <div className="bg-red-50 p-2 rounded border border-red-200 text-xs">
                        <h4 className="font-semibold text-red-700 mb-1">Rejection Feedback:</h4>
                        <p className="text-gray-700 whitespace-pre-wrap">{project.feedback}</p>
                      </div>
                    )}

                    {/* Review Scores */}
                    {project.overall_score && (
                      <div className="bg-purple-50 p-2 rounded text-xs">
                        <h4 className="font-semibold text-gray-700 mb-1">Review Scores:</h4>
                        <div className="grid grid-cols-2 gap-1">
                          {project.hook_strength && (
                            <div>
                              Hook: <span className="font-medium">{project.hook_strength}/10</span>
                            </div>
                          )}
                          {project.content_quality && (
                            <div>
                              Quality:{' '}
                              <span className="font-medium">{project.content_quality}/10</span>
                            </div>
                          )}
                          {project.viral_potential && (
                            <div>
                              Viral:{' '}
                              <span className="font-medium">{project.viral_potential}/10</span>
                            </div>
                          )}
                          {project.replication_clarity && (
                            <div>
                              Clarity:{' '}
                              <span className="font-medium">{project.replication_clarity}/10</span>
                            </div>
                          )}
                          <div className="col-span-2">
                            Overall:{' '}
                            <span className="font-bold text-primary-600">
                              {project.overall_score}/10
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Production Files */}
                    {project.production_files && project.production_files.length > 0 && (
                      <div className="bg-green-50 p-2 rounded border border-green-200 text-xs">
                        <h4 className="font-semibold text-gray-700 mb-2">
                          Files ({project.production_files.length})
                        </h4>
                        <div className="space-y-1">
                          {project.production_files.map((file: any) => (
                            <div
                              key={file.id}
                              className="bg-white p-2 rounded border border-gray-200 flex items-center justify-between"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                                      file.file_type === 'raw-footage'
                                        ? 'bg-blue-100 text-blue-800'
                                        : file.file_type === 'edited-video'
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-green-100 text-green-800'
                                    }`}
                                  >
                                    {file.file_type === 'raw-footage'
                                      ? 'Raw'
                                      : file.file_type === 'edited-video'
                                        ? 'Edited'
                                        : 'Final'}
                                  </span>
                                  <span className="truncate text-gray-600">{file.file_name}</span>
                                </div>
                              </div>
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 px-2 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Team Assignments */}
                {project.status === 'APPROVED' &&
                  (project.videographer || project.editor || project.posting_manager) && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                        {project.videographer && (
                          <div className="flex items-center">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1"></span>
                            Video: {project.videographer.full_name || project.videographer.email}
                          </div>
                        )}
                        {project.editor && (
                          <div className="flex items-center">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1"></span>
                            Edit: {project.editor.full_name || project.editor.email}
                          </div>
                        )}
                        {project.posting_manager && (
                          <div className="flex items-center">
                            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full mr-1"></span>
                            PM: {project.posting_manager.full_name || project.posting_manager.email}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
