import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';
import type { ViralAnalysis } from '@/types';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  // Fetch projects based on role
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['team-member-projects', memberId, memberRole],
    queryFn: async () => {
      let query = supabase.from('viral_analyses').select(`
        *,
        videographer:profiles!viral_analyses_videographer_id_fkey(id, full_name, email),
        editor:profiles!viral_analyses_editor_id_fkey(id, full_name, email),
        posting_manager:profiles!viral_analyses_posting_manager_id_fkey(id, full_name, email)
      `);

      // Filter based on role
      if (memberRole === 'SCRIPT_WRITER') {
        query = query.eq('user_id', memberId);
      } else if (memberRole === 'VIDEOGRAPHER') {
        query = query.eq('videographer_id', memberId);
      } else if (memberRole === 'EDITOR') {
        query = query.eq('editor_id', memberId);
      } else if (memberRole === 'POSTING_MANAGER') {
        query = query.eq('posting_manager_id', memberId);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
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
                        onClick={() => {
                          onClose();
                          if (memberRole === 'SCRIPT_WRITER') {
                            navigate('/analyses');
                          } else if (memberRole === 'VIDEOGRAPHER') {
                            navigate('/videographer');
                          } else if (memberRole === 'EDITOR') {
                            navigate('/editor');
                          } else if (memberRole === 'POSTING_MANAGER') {
                            navigate('/posting-manager');
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition flex items-center"
                      >
                        <EyeIcon className="w-4 h-4 mr-1" />
                        View
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
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
