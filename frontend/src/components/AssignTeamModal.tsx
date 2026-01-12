import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { assignmentService } from '@/services/assignmentService';
import type { ViralAnalysis, AssignTeamData } from '@/types';
import {
  UserGroupIcon,
  VideoCameraIcon,
  FilmIcon,
  MegaphoneIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface AssignTeamModalProps {
  analysis: ViralAnalysis;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignTeamModal({
  analysis,
  isOpen,
  onClose,
}: AssignTeamModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<AssignTeamData>({
    videographerId: analysis.videographer?.id,
    editorId: analysis.editor?.id,
    postingManagerId: analysis.posting_manager?.id,
    autoAssignVideographer: false,
    autoAssignEditor: false,
    autoAssignPostingManager: false,
  });

  // Update form data when modal opens or analysis changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        videographerId: analysis.videographer?.id,
        editorId: analysis.editor?.id,
        postingManagerId: analysis.posting_manager?.id,
        autoAssignVideographer: false,
        autoAssignEditor: false,
        autoAssignPostingManager: false,
      });
    }
  }, [isOpen, analysis]);

  // Fetch users by role
  const { data: videographers } = useQuery({
    queryKey: ['users', 'VIDEOGRAPHER'],
    queryFn: () => assignmentService.getUsersByRole('VIDEOGRAPHER'),
    enabled: isOpen,
  });

  const { data: editors } = useQuery({
    queryKey: ['users', 'EDITOR'],
    queryFn: () => assignmentService.getUsersByRole('EDITOR'),
    enabled: isOpen,
  });

  const { data: postingManagers } = useQuery({
    queryKey: ['users', 'POSTING_MANAGER'],
    queryFn: () => assignmentService.getUsersByRole('POSTING_MANAGER'),
    enabled: isOpen,
  });

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: (data: AssignTeamData) =>
      assignmentService.assignTeam(analysis.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['analysis', analysis.id] });
      toast.success('Team assigned successfully!');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign team');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one team member is assigned
    if (
      !formData.videographerId &&
      !formData.editorId &&
      !formData.postingManagerId &&
      !formData.autoAssignVideographer &&
      !formData.autoAssignEditor &&
      !formData.autoAssignPostingManager
    ) {
      toast.error('Please assign at least one team member');
      return;
    }

    assignMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-5 rounded-t-xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <UserGroupIcon className="w-7 h-7 text-white mr-3" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Assign Production Team</h2>
                  <p className="text-primary-100 text-sm mt-1">
                    Assign team members to start production
                  </p>
                </div>
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
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Analysis Info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Analysis Details</h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-700">
                  <span className="font-medium">Hook:</span>{' '}
                  {analysis.hook?.substring(0, 80)}
                  {(analysis.hook?.length || 0) > 80 ? '...' : ''}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Score:</span>{' '}
                  {analysis.overall_score?.toFixed(1) || 'N/A'}/10
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {analysis.status}
                  </span>
                </p>
              </div>
            </div>

            {/* Videographer Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-900">
                  <VideoCameraIcon className="w-5 h-5 text-primary-600 mr-2" />
                  Videographer
                </label>
                <label className="flex items-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.autoAssignVideographer}
                    onChange={(e) =>
                      setFormData({ ...formData, autoAssignVideographer: e.target.checked })
                    }
                    className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <SparklesIcon className="w-4 h-4 mr-1" />
                  Auto-assign
                </label>
              </div>

              {!formData.autoAssignVideographer && (
                <select
                  value={formData.videographerId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, videographerId: e.target.value || undefined })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">-- Select Videographer --</option>
                  {videographers?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name || v.email}
                    </option>
                  ))}
                </select>
              )}

              {formData.autoAssignVideographer && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-700">
                  <SparklesIcon className="w-4 h-4 inline mr-1" />
                  Will auto-assign videographer with lowest workload
                </div>
              )}
            </div>

            {/* Editor Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-900">
                  <FilmIcon className="w-5 h-5 text-purple-600 mr-2" />
                  Editor (Optional)
                </label>
                <label className="flex items-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.autoAssignEditor}
                    onChange={(e) =>
                      setFormData({ ...formData, autoAssignEditor: e.target.checked })
                    }
                    className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <SparklesIcon className="w-4 h-4 mr-1" />
                  Auto-assign
                </label>
              </div>

              {!formData.autoAssignEditor && (
                <select
                  value={formData.editorId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, editorId: e.target.value || undefined })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">-- Select Editor --</option>
                  {editors?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name || e.email}
                    </option>
                  ))}
                </select>
              )}

              {formData.autoAssignEditor && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                  <SparklesIcon className="w-4 h-4 inline mr-1" />
                  Will auto-assign editor with lowest workload
                </div>
              )}
            </div>

            {/* Posting Manager Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-900">
                  <MegaphoneIcon className="w-5 h-5 text-pink-600 mr-2" />
                  Posting Manager (Optional)
                </label>
                <label className="flex items-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.autoAssignPostingManager}
                    onChange={(e) =>
                      setFormData({ ...formData, autoAssignPostingManager: e.target.checked })
                    }
                    className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <SparklesIcon className="w-4 h-4 mr-1" />
                  Auto-assign
                </label>
              </div>

              {!formData.autoAssignPostingManager && (
                <select
                  value={formData.postingManagerId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, postingManagerId: e.target.value || undefined })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">-- Select Posting Manager --</option>
                  {postingManagers?.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.full_name || pm.email}
                    </option>
                  ))}
                </select>
              )}

              {formData.autoAssignPostingManager && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-sm text-pink-700">
                  <SparklesIcon className="w-4 h-4 inline mr-1" />
                  Will auto-assign posting manager with lowest workload
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assignMutation.isPending}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center"
              >
                {assignMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserGroupIcon className="w-5 h-5 mr-2" />
                    Assign Team
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
