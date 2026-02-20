import { useState, useEffect } from 'react';
import { Video, Play, Download, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Loader2, CheckSquare, Square } from 'lucide-react';
import { adminService } from '@/services/adminService';
import { getDriveDownloadUrl } from '@/services/googleDriveOAuthService';
import toast from 'react-hot-toast';
import type { ViralAnalysis } from '@/types';
import { motion } from 'framer-motion';

export default function EditedReviewPage() {
  const [projects, setProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const editReviewProjects = await adminService.getEditReviewProjects();
      setProjects(editReviewProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load edited videos');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) {
      toast.error('Please select at least one video');
      return;
    }

    try {
      setBulkApproving(true);

      const approvals = Array.from(selected).map(id =>
        adminService.approveEditedVideo(id)
      );
      await Promise.all(approvals);

      toast.success(`Approved ${selected.size} video${selected.size !== 1 ? 's' : ''}!`);
      setSelected(new Set());
      setBulkMode(false);
      loadProjects();
    } catch (error) {
      console.error('Bulk approve failed:', error);
      toast.error('Some approvals failed. Check console for details.');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleApproveVideo = async (id: string) => {
    try {
      await adminService.approveEditedVideo(id);
      toast.success('Video approved!');
      loadProjects();
    } catch (error) {
      console.error('Failed to approve video:', error);
      toast.error('Failed to approve video');
    }
  };

  const handleRejectVideo = async (id: string) => {
    const reason = window.prompt('Rejection reason (required):');
    if (!reason?.trim()) return;
    try {
      await adminService.rejectEditedVideo(id, reason.trim());
      toast.success('Video rejected');
      loadProjects();
    } catch (error) {
      console.error('Failed to reject video:', error);
      toast.error('Failed to reject video');
    }
  };

  const toggleProject = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleExpand = (id: string) => {
    setExpandedProject(expandedProject === id ? null : id);
  };

  const selectAll = () => {
    const allIds = new Set(projects.map(p => p.id));
    setSelected(allIds);
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const getEditedFiles = (project: ViralAnalysis) => {
    return project.production_files?.filter(
      (f: any) => ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'].includes(f.file_type) && !f.is_deleted
    ) || [];
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Edited Videos
          <span className="text-sm text-gray-500 font-normal ml-2">
            {projects.length} pending review
          </span>
        </h1>
        <button
          onClick={() => setBulkMode(!bulkMode)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
            bulkMode ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {bulkMode ? (
            <>
              <CheckSquare className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <Square className="w-4 h-4" />
              Bulk Select
            </>
          )}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {bulkMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
          <div className="max-w-mobile mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">
                {selected.size} selected
              </span>
              {selected.size < projects.length ? (
                <button
                  onClick={selectAll}
                  className="text-xs text-purple-600 font-medium hover:underline"
                >
                  Select All ({projects.length})
                </button>
              ) : (
                <button
                  onClick={deselectAll}
                  className="text-xs text-gray-500 font-medium hover:underline"
                >
                  Deselect All
                </button>
              )}
            </div>

            <button
              onClick={handleBulkApprove}
              disabled={selected.size === 0 || bulkApproving}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {bulkApproving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Approve ({selected.size})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No videos to review</h3>
          <p className="text-gray-500 text-sm">All edited videos have been reviewed</p>
        </motion.div>
      )}

      {/* Project List */}
      <div className={`space-y-3 ${bulkMode ? 'mt-16' : ''}`}>
        {projects.map((project, index) => {
          const editedFiles = getEditedFiles(project);
          const isExpanded = expandedProject === project.id;
          const isSelected = selected.has(project.id);

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                className={`relative bg-white border-2 rounded-xl transition-all ${
                  isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                }`}
              >
                {/* Checkbox (bulk mode only) */}
                {bulkMode && (
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center bg-white rounded-lg border-2 border-gray-300 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                )}

                {/* Header */}
                <div className={`p-4 ${bulkMode ? 'pl-14' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                      <p className="text-xs text-gray-500">{project.content_id}</p>
                    </div>

                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
                      {editedFiles.length} file{editedFiles.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(project.updated_at || project.created_at)}
                    </span>
                  </div>

                  {/* Quick Actions (not in bulk mode) */}
                  {!bulkMode && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveVideo(project.id)}
                        className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 active:bg-green-600"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectVideo(project.id)}
                        className="flex-1 py-2 border-2 border-red-300 text-red-600 rounded-lg text-sm font-medium flex items-center justify-center gap-1 active:bg-red-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Section - Video Files */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      Edited Videos
                    </h4>
                    <div className="space-y-2">
                      {editedFiles.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No edited videos found</p>
                      ) : (
                        editedFiles.map((file: any) => (
                          <div key={file.id} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                                  <Video className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {file.file_name || 'Untitled Video'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <a
                                  href={file.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                  <Eye className="w-4 h-4 text-gray-600" />
                                </a>
                                <a
                                  href={getDriveDownloadUrl(file.file_url)}
                                  download
                                  className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                  <Download className="w-4 h-4 text-gray-600" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
