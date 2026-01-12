import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { ViralAnalysis } from '@/types';

interface TeamMemberProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberRole: string;
}

export default function TeamMemberProjectsModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  memberRole,
}: TeamMemberProjectsModalProps) {
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Fetch projects based on role
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['team-member-projects', memberId, memberRole],
    queryFn: async () => {
      let data: any[] = [];

      // Filter based on role
      if (memberRole === 'SCRIPT_WRITER') {
        // Script writers: direct query on viral_analyses.user_id
        const { data: analyses, error } = await supabase
          .from('viral_analyses')
          .select('*')
          .eq('user_id', memberId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = analyses || [];
      } else {
        // Videographers, Editors, Posting Managers: query through project_assignments
        const { data: assignments, error: assignmentsError } = await supabase
          .from('project_assignments')
          .select('analysis_id')
          .eq('user_id', memberId)
          .eq('role', memberRole);

        if (assignmentsError) throw assignmentsError;

        if (assignments && assignments.length > 0) {
          const analysisIds = assignments.map(a => a.analysis_id);

          const { data: analyses, error } = await supabase
            .from('viral_analyses')
            .select('*')
            .in('id', analysisIds)
            .order('created_at', { ascending: false });

          if (error) throw error;
          data = analyses || [];
        }
      }

      // Fetch related profile data separately if needed
      if (data && data.length > 0) {
        // Collect all user IDs from assignments
        const analysisIds = data.map(d => d.id);
        const { data: allAssignments } = await supabase
          .from('project_assignments')
          .select('analysis_id, user_id, role')
          .in('analysis_id', analysisIds);

        // Collect unique user IDs
        const userIds = new Set<string>();
        data.forEach(project => {
          if (project.user_id) userIds.add(project.user_id);
        });
        allAssignments?.forEach(assignment => {
          if (assignment.user_id) userIds.add(assignment.user_id);
        });

        // Fetch all profiles in one query
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', Array.from(userIds));

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

          // Attach profile data to projects
          data.forEach(project => {
            // Attach script writer info
            if (project.user_id) {
              const creator = profileMap.get(project.user_id);
              if (creator) {
                project.full_name = creator.full_name;
                project.email = creator.email;
              }
            }

            // Attach team member assignments
            const projectAssignments = allAssignments?.filter(a => a.analysis_id === project.id) || [];
            projectAssignments.forEach(assignment => {
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
          });
        }
      }

      return data as ViralAnalysis[];
    },
    enabled: isOpen && !!memberId,
  });

  if (!isOpen) return null;

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
    return stage.split('_').map(word =>
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-5 rounded-t-xl sticky top-0 z-10">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white">{memberName}'s Projects</h2>
                <p className="text-white text-sm mt-1 opacity-90">
                  {memberRole.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')} • {projects.length} project{projects.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No projects found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {project.content_id && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                              {project.content_id}
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                            {project.status}
                          </span>
                          {project.production_stage && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getProductionStageColor(project.production_stage)}`}>
                              {formatStageName(project.production_stage)}
                            </span>
                          )}
                          {project.rejection_count !== undefined && project.rejection_count > 0 && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              project.rejection_count >= 4
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              🔄 Rejected {project.rejection_count}x
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {project.hook || 'Untitled Project'}
                        </h3>
                        {project.reference_url && (
                          <a
                            href={project.reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            View Reference →
                          </a>
                        )}
                      </div>

                      <button
                        onClick={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                        className="px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition flex items-center"
                      >
                        {expandedProjectId === project.id ? (
                          <>
                            <ChevronUpIcon className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDownIcon className="w-4 h-4 mr-1" />
                            View Details
                          </>
                        )}
                      </button>
                    </div>

                    {/* Basic Info - Always Visible */}
                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      {project.target_emotion && (
                        <div>
                          <span className="text-gray-500">Emotion:</span>
                          <span className="ml-2 text-gray-900">{project.target_emotion}</span>
                        </div>
                      )}
                      {project.expected_outcome && (
                        <div>
                          <span className="text-gray-500">Outcome:</span>
                          <span className="ml-2 text-gray-900">{project.expected_outcome}</span>
                        </div>
                      )}
                      {memberRole !== 'SCRIPT_WRITER' && (
                        <div>
                          <span className="text-gray-500">Created by:</span>
                          <span className="ml-2 text-gray-900">{project.full_name || project.email}</span>
                        </div>
                      )}
                      {project.created_at && (
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <span className="ml-2 text-gray-900">
                            {new Date(project.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {expandedProjectId === project.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                        {/* Script Content */}
                        {project.why_viral && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">Why It's Viral:</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.why_viral}</p>
                          </div>
                        )}
                        {project.how_to_replicate && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">How to Replicate:</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.how_to_replicate}</p>
                          </div>
                        )}

                        {/* Production Details */}
                        {(project.priority || project.deadline || project.production_notes) && (
                          <div className="bg-blue-50 p-3 rounded">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Production Info:</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {project.priority && (
                                <div>
                                  <span className="text-gray-600">Priority:</span>
                                  <span className="ml-2 font-medium">{project.priority}</span>
                                </div>
                              )}
                              {project.deadline && (
                                <div>
                                  <span className="text-gray-600">Deadline:</span>
                                  <span className="ml-2 font-medium">
                                    {new Date(project.deadline).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                            {project.production_notes && (
                              <p className="text-sm text-gray-600 mt-2">{project.production_notes}</p>
                            )}
                          </div>
                        )}

                        {/* Feedback (if rejected) */}
                        {project.status === 'REJECTED' && project.feedback && (
                          <div className="bg-red-50 p-3 rounded border border-red-200">
                            <h4 className="text-sm font-semibold text-red-700 mb-1">Rejection Feedback:</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.feedback}</p>
                          </div>
                        )}

                        {/* Review Scores */}
                        {project.overall_score && (
                          <div className="bg-purple-50 p-3 rounded">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Review Scores:</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {project.hook_strength && (
                                <div>
                                  <span className="text-gray-600">Hook:</span>
                                  <span className="ml-2 font-medium">{project.hook_strength}/10</span>
                                </div>
                              )}
                              {project.content_quality && (
                                <div>
                                  <span className="text-gray-600">Quality:</span>
                                  <span className="ml-2 font-medium">{project.content_quality}/10</span>
                                </div>
                              )}
                              {project.viral_potential && (
                                <div>
                                  <span className="text-gray-600">Viral Potential:</span>
                                  <span className="ml-2 font-medium">{project.viral_potential}/10</span>
                                </div>
                              )}
                              {project.replication_clarity && (
                                <div>
                                  <span className="text-gray-600">Clarity:</span>
                                  <span className="ml-2 font-medium">{project.replication_clarity}/10</span>
                                </div>
                              )}
                              <div className="col-span-2">
                                <span className="text-gray-600">Overall:</span>
                                <span className="ml-2 font-bold text-primary-600">{project.overall_score}/10</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Team Assignments */}
                    {project.status === 'APPROVED' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center space-x-4 text-xs text-gray-600">
                          {project.videographer && (
                            <div className="flex items-center">
                              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-1.5"></span>
                              Videographer: {project.videographer.full_name || project.videographer.email}
                            </div>
                          )}
                          {project.editor && (
                            <div className="flex items-center">
                              <span className="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>
                              Editor: {project.editor.full_name || project.editor.email}
                            </div>
                          )}
                          {project.posting_manager && (
                            <div className="flex items-center">
                              <span className="w-2 h-2 bg-pink-500 rounded-full mr-1.5"></span>
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

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
