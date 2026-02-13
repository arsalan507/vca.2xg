import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, CheckCircle, Loader2, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import { editorService } from '@/services/editorService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

type TabType = 'active' | 'completed';

// Edited file types that indicate editing is complete
const EDITED_FILE_TYPES = ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'];

// Helper to check if project is "new" (assigned within last 24 hours)
const isNewAssignment = (project: ViralAnalysis) => {
  const assignedAt = (project as any).editor_assigned_at || project.created_at;
  const hoursSinceAssigned = (Date.now() - new Date(assignedAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceAssigned < 24;
};

// Helper to get editing progress estimate
const getEditingProgress = (project: ViralAnalysis): number => {
  if ((project as any).editing_progress !== undefined) return (project as any).editing_progress;
  const hasEditedFiles = project.production_files?.some(
    (f: any) => EDITED_FILE_TYPES.includes(f.file_type) && !f.is_deleted
  );
  return hasEditedFiles ? 80 : 30;
};

// Helper to format due date
const formatDueDate = (deadline: string) => {
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0) return { text: 'Overdue', isUrgent: true };
  if (diffDays === 0) return { text: 'Due today', isUrgent: true };
  if (diffDays === 1) return { text: 'Due tomorrow', isUrgent: true };
  if (diffDays <= 3) return { text: `Due in ${diffDays} days`, isUrgent: false };
  return { text: `Due ${date.toLocaleDateString()}`, isUrgent: false };
};

export default function EditorMyProjectsPage() {
  const [projects, setProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await editorService.getMyProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Group projects by status
  const editingProjects = projects.filter((p) => p.production_stage === 'EDITING');
  const reviewProjects = projects.filter((p) => p.production_stage === 'EDIT_REVIEW');
  const completedProjects = projects.filter((p) =>
    ['READY_TO_POST', 'POSTED'].includes(p.production_stage || '')
  );

  // Projects that have edited files ready (can mark complete)
  const hasEditedFiles = (project: ViralAnalysis) => {
    return project.production_files?.some(
      (f: any) => EDITED_FILE_TYPES.includes(f.file_type) && !f.is_deleted
    );
  };

  // Rejected projects (have disapproval_reason) need special treatment
  const rejectedProjects = editingProjects.filter((p) => !!(p as any).disapproval_reason);
  const nonRejectedEditing = editingProjects.filter((p) => !(p as any).disapproval_reason);

  const readyToUploadProjects = nonRejectedEditing.filter((p) => !hasEditedFiles(p));
  const inEditingProjects = nonRejectedEditing.filter((p) => hasEditedFiles(p));

  const activeCount = editingProjects.length + reviewProjects.length;
  const completedCount = completedProjects.length;

  const getFileCount = (project: ViralAnalysis) => {
    return project.production_files?.filter((f: any) => !f.is_deleted).length || 0;
  };

  const getRawFileCount = (project: ViralAnalysis) => {
    const rawTypes = ['RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER', 'raw-footage'];
    return project.production_files?.filter(
      (f: any) => rawTypes.includes(f.file_type) && !f.is_deleted
    ).length || 0;
  };

  if (loading) {
    return (
      <>
        <Header title="My Queue" showBack />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="My Queue" subtitle={`${activeCount} active, ${completedCount} completed`} showBack />

      <div className="px-4 py-4">
        {/* Tab Switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {activeTab === 'active' && (
          <div className="space-y-6">
            {/* Rejected by Admin - Needs Re-edit */}
            {rejectedProjects.length > 0 && (
              <section className="animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide">
                    Rejected - Needs Re-edit ({rejectedProjects.length})
                  </h2>
                </div>

                <div className="space-y-3">
                  {rejectedProjects.map((project) => {
                    const progress = getEditingProgress(project);

                    return (
                      <Link
                        key={project.id}
                        to={`/editor/project/${project.id}`}
                        className="block bg-red-50 rounded-xl p-4 border-2 border-red-300 card-press"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                              <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                                REJECTED
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 font-mono">{project.content_id || 'No ID'}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          </div>
                        </div>

                        {/* Rejection reason preview */}
                        <p className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2 mb-3 line-clamp-2">
                          {(project as any).disapproval_reason}
                        </p>

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-red-100 rounded-full overflow-hidden mb-3">
                          <div
                            className="h-full bg-red-400 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-white rounded text-gray-600">
                            {project.profile?.name || 'No profile'}
                          </span>
                          <span className="text-xs px-2 py-1 bg-white rounded text-gray-600">
                            {getFileCount(project)} files
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Ready to Upload (no edited files yet) */}
            {readyToUploadProjects.length > 0 && (
              <section className="animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wide">
                    Needs Edited Video ({readyToUploadProjects.length})
                  </h2>
                </div>

                <div className="space-y-3">
                  {readyToUploadProjects.map((project) => {
                    const isNew = isNewAssignment(project);
                    const progress = getEditingProgress(project);
                    const dueInfo = project.deadline ? formatDueDate(project.deadline) : null;
                    const isUrgent = project.priority === 'URGENT' || dueInfo?.isUrgent;

                    return (
                      <Link
                        key={project.id}
                        to={`/editor/project/${project.id}`}
                        className={`block rounded-xl p-4 border-2 card-press ${
                          isNew ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                              {isNew && (
                                <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                                  NEW
                                </span>
                              )}
                              {isUrgent && !isNew && (
                                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  URGENT
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 font-mono">{project.content_id || 'No ID'}</p>
                          </div>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isNew ? 'bg-purple-100' : 'bg-gray-100'
                          }`}>
                            {isNew ? (
                              <Sparkles className="w-5 h-5 text-purple-600" />
                            ) : (
                              <Upload className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all ${isNew ? 'bg-purple-500' : 'bg-editor'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                              {project.profile?.name || 'No profile'}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                              {getRawFileCount(project)} raw files
                            </span>
                          </div>
                          {dueInfo && (
                            <span className={`text-xs font-medium flex items-center gap-1 ${
                              dueInfo.isUrgent ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {dueInfo.text}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* In Editing (has edited files, can mark complete) */}
            {inEditingProjects.length > 0 && (
              <section className="animate-slide-up delay-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <h2 className="text-sm font-semibold text-green-600 uppercase tracking-wide">
                    Ready to Complete ({inEditingProjects.length})
                  </h2>
                </div>

                <div className="space-y-3">
                  {inEditingProjects.map((project) => {
                    const progress = getEditingProgress(project);
                    const dueInfo = project.deadline ? formatDueDate(project.deadline) : null;

                    return (
                      <Link
                        key={project.id}
                        to={`/editor/project/${project.id}`}
                        className="block bg-green-50 rounded-xl p-4 border-2 border-green-200 card-press"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                            <p className="text-sm text-gray-500 font-mono">{project.content_id || 'No ID'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-green-600">{progress}%</span>
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-green-100 rounded-full overflow-hidden mb-3">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-white rounded text-gray-600">
                              {project.profile?.name || 'No profile'}
                            </span>
                            <span className="text-xs px-2 py-1 bg-white rounded text-gray-600">
                              {getFileCount(project)} files
                            </span>
                          </div>
                          {dueInfo ? (
                            <span className={`text-xs font-medium flex items-center gap-1 ${
                              dueInfo.isUrgent ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {dueInfo.text}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">
                              Ready to submit
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Under Review */}
            {reviewProjects.length > 0 && (
              <section className="animate-slide-up delay-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide">
                    Under Review ({reviewProjects.length})
                  </h2>
                </div>

                <div className="space-y-3">
                  {reviewProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/editor/project/${project.id}`}
                      className="block bg-amber-50 rounded-xl p-4 border-2 border-amber-200 card-press"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                          <p className="text-sm text-gray-500 font-mono">{project.content_id || 'No ID'}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-white rounded text-gray-600">
                          {project.profile?.name || 'No profile'}
                        </span>
                        <span className="text-xs text-amber-600 font-medium">
                          Waiting for admin review
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {activeCount === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎬</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Active Projects</h3>
                <p className="text-gray-500 text-sm mb-4">Pick a project to get started</p>
                <Link
                  to="/editor/available"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-editor text-white rounded-lg text-sm font-medium"
                >
                  Browse Available Projects
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-3 animate-fade-in">
            {completedProjects.map((project) => (
              <Link
                key={project.id}
                to={`/editor/project/${project.id}`}
                className="block bg-white rounded-xl p-4 border border-gray-100 shadow-sm card-press"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                    <p className="text-sm text-gray-500 font-mono">{project.content_id || 'No ID'}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-success" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {project.profile?.name || 'No profile'}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {getFileCount(project)} files
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}

            {completedCount === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📁</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Completed Projects</h3>
                <p className="text-gray-500 text-sm">Your completed edits will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
