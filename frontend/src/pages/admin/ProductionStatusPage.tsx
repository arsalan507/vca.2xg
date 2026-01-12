import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { ProductionStage } from '@/types';
import type { ViralAnalysis } from '@/types';

export default function ProductionStatusPage() {
  // Fetch all approved analyses in production
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['admin', 'production-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (email, full_name, avatar_url),
          assignments:project_assignments (
            *,
            user:profiles!project_assignments_user_id_fkey (id, email, full_name, avatar_url, role)
          )
        `)
        .eq('status', 'APPROVED')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map((item: any) => ({
        ...item,
        email: item.profiles?.email,
        full_name: item.profiles?.full_name,
        avatar_url: item.profiles?.avatar_url,
        videographer: item.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
        editor: item.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
        posting_manager: item.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
      })) as ViralAnalysis[];
    },
  });

  // Calculate pipeline stats (no double-counting)
  const pipelineStats = {
    scriptDone: analyses.filter(a => a.production_stage === ProductionStage.PRE_PRODUCTION || a.production_stage === ProductionStage.NOT_STARTED).length,
    shootActive: analyses.filter(a => a.production_stage === ProductionStage.SHOOTING).length,
    shootDone: analyses.filter(a => a.production_stage === ProductionStage.SHOOT_REVIEW).length,
    editActive: analyses.filter(a => a.production_stage === ProductionStage.EDITING).length,
    editDone: analyses.filter(a => a.production_stage === ProductionStage.EDIT_REVIEW || a.production_stage === ProductionStage.FINAL_REVIEW || a.production_stage === ProductionStage.READY_TO_POST).length,
    readyToPost: analyses.filter(a => a.production_stage === ProductionStage.READY_TO_POST).length,
    posted: analyses.filter(a => a.production_stage === ProductionStage.POSTED).length,
  };

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case ProductionStage.NOT_STARTED: return 'bg-gray-100 text-gray-800';
      case ProductionStage.PRE_PRODUCTION: return 'bg-blue-100 text-blue-800';
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

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'NORMAL': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'LOW': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const groupByStage = (stage: ProductionStage) => {
    return analyses.filter(a => a.production_stage === stage);
  };

  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <ChartBarIcon className="w-7 h-7 mr-3 text-primary-600" />
          Production Status
        </h1>
        <p className="text-gray-600 mt-1">
          {analyses.length} project{analyses.length !== 1 ? 's' : ''} in production pipeline
        </p>
      </div>

      {/* Content */}
      <div className="p-8 space-y-8">
        {/* Pipeline Overview */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Pipeline Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{pipelineStats.scriptDone}</div>
              <div className="text-xs text-gray-600 mt-1">Script Done</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="text-2xl font-bold text-indigo-600">{pipelineStats.shootActive}</div>
              <div className="text-xs text-gray-600 mt-1">Shoot Active</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{pipelineStats.shootDone}</div>
              <div className="text-xs text-gray-600 mt-1">Shoot Done</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">{pipelineStats.editActive}</div>
              <div className="text-xs text-gray-600 mt-1">Edit Active</div>
            </div>
            <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-200">
              <div className="text-2xl font-bold text-pink-600">{pipelineStats.editDone}</div>
              <div className="text-xs text-gray-600 mt-1">Edit Done</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{pipelineStats.readyToPost}</div>
              <div className="text-xs text-gray-600 mt-1">Ready to Post</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">{pipelineStats.posted}</div>
              <div className="text-xs text-gray-600 mt-1">Posted</div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Script Done (Pre-Production) */}
            {pipelineStats.scriptDone > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    ✅ Script Done (Approved, in production)
                  </h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {pipelineStats.scriptDone} projects
                  </span>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Videographer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Priority
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deadline
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...groupByStage(ProductionStage.NOT_STARTED), ...groupByStage(ProductionStage.PRE_PRODUCTION)].map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs">
                              {project.hook || 'No hook provided'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(project.production_stage)}`}>
                              {project.production_stage?.replace(/_/g, ' ') || 'NOT STARTED'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.videographer?.full_name || project.videographer?.email || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(project.priority)}`}>
                              {project.priority || 'NORMAL'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Shoot Done */}
            {pipelineStats.shootDone > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    🎬 Shoot Done (Approved, in editing)
                  </h2>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {pipelineStats.shootDone} projects
                  </span>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Editor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Priority
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deadline
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...groupByStage(ProductionStage.EDITING)].map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs">
                              {project.hook || 'No hook provided'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(project.production_stage)}`}>
                              {project.production_stage?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.editor?.full_name || project.editor?.email || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(project.priority)}`}>
                              {project.priority || 'NORMAL'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Edit Done */}
            {pipelineStats.editDone > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    ✂️ Edit Done (Finalized, ready to post)
                  </h2>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    {pipelineStats.editDone} projects
                  </span>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Posting Manager
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Priority
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Post Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...groupByStage(ProductionStage.FINAL_REVIEW), ...groupByStage(ProductionStage.READY_TO_POST)].map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs">
                              {project.hook || 'No hook provided'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(project.production_stage)}`}>
                              {project.production_stage?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.posting_manager?.full_name || project.posting_manager?.email || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(project.priority)}`}>
                              {project.priority || 'NORMAL'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'TBD'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Posted */}
            {pipelineStats.posted > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    📱 Posted (Live on social media)
                  </h2>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                    {pipelineStats.posted} projects
                  </span>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Posted By
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Posted Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {groupByStage(ProductionStage.POSTED).slice(0, 20).map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs">
                              {project.hook || 'No hook provided'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.posting_manager?.full_name || project.posting_manager?.email || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(project.updated_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pipelineStats.posted > 20 && (
                    <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500 text-center border-t border-gray-200">
                      Showing 20 of {pipelineStats.posted} posted projects
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
