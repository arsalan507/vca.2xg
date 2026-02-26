import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, FileText } from 'lucide-react';
import { analysesService } from '@/services/analysesService';
import { queryKeys } from '@/lib/queryKeys';
import QueryStateWrapper from '@/components/QueryStateWrapper';

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

export default function MyScriptsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: scripts = [], isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.writer.myScripts(),
    queryFn: () => analysesService.getMyAnalyses(),
  });

  const [filter, setFilter] = useState<FilterType>(
    (searchParams.get('filter') as FilterType) || 'all'
  );

  useEffect(() => {
    setSearchParams(filter === 'all' ? {} : { filter });
  }, [filter, setSearchParams]);

  const counts = useMemo(() => ({
    all: scripts.length,
    pending: scripts.filter((s) => s.status === 'PENDING').length,
    approved: scripts.filter((s) => s.status === 'APPROVED').length,
    rejected: scripts.filter((s) => s.status === 'REJECTED' && !s.is_dissolved).length,
  }), [scripts]);

  const filteredScripts = scripts.filter((script) => {
    switch (filter) {
      case 'pending':
        return script.status === 'PENDING';
      case 'approved':
        return script.status === 'APPROVED';
      case 'rejected':
        return script.status === 'REJECTED' && !script.is_dissolved;
      default:
        return !script.is_dissolved;
    }
  });

  // Group scripts by status for display
  const pendingScripts = filteredScripts.filter((s) => s.status === 'PENDING');
  const approvedScripts = filteredScripts.filter((s) => s.status === 'APPROVED');
  const rejectedScripts = filteredScripts.filter((s) => s.status === 'REJECTED');

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return date.toLocaleDateString();
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram_reel':
        return '📸';
      case 'youtube_shorts':
        return '🎬';
      case 'youtube_long':
        return '▶️';
      default:
        return '📹';
    }
  };

  const getPlatformLabel = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram_reel':
        return 'Instagram';
      case 'youtube_shorts':
        return 'YT Shorts';
      case 'youtube_long':
        return 'YouTube';
      default:
        return platform || 'Video';
    }
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'SHOOTING':
        return 'Shooting';
      case 'READY_FOR_EDIT':
      case 'EDITING':
        return 'Editing';
      case 'READY_TO_POST':
        return 'Ready to Post';
      case 'POSTED':
        return 'Posted';
      default:
        return 'In Production';
    }
  };

  const formatViewCount = (views?: number) => {
    if (!views) return null;
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <QueryStateWrapper
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      error={error}
      data={scripts}
      onRetry={refetch}
      accentColor="blue"
    >
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={() => navigate('/writer')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Scripts</h1>
          <p className="text-sm text-gray-500">{counts.all} total submissions</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 mb-6 overflow-x-auto pb-2 px-4"
      >
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all shadow-sm ${
              filter === f.id
                ? 'bg-blue-500 text-white shadow-blue-200'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {f.label}
            <span
              className={`min-w-[20px] px-1.5 py-0.5 rounded-full text-xs font-bold ${
                filter === f.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {counts[f.id]}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Empty State */}
      {filteredScripts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 px-4"
        >
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-gray-100">
            <FileText className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2 text-lg">No scripts found</h3>
          <p className="text-gray-500 text-sm mb-6">
            {filter === 'all'
              ? 'Start by submitting your first script'
              : `No ${filter} scripts yet`}
          </p>
          {filter === 'all' && (
            <Link
              to="/writer/new"
              className="inline-flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-xl font-medium shadow-sm active:scale-95 transition-transform"
            >
              ✍️ Create New Script
            </Link>
          )}
        </motion.div>
      )}

      {/* Pending Section */}
      {(filter === 'all' || filter === 'pending') && pendingScripts.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-4"
        >
          {filter === 'all' && (
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              ⏳ Pending
            </h2>
          )}

          <div className="space-y-3">
            {pendingScripts.map((script, index) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/writer/scripts/${script.id}`}
                  className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{script.title || 'Untitled'}</h3>
                      <p className="text-gray-500 text-sm">
                        Submitted {formatTimeAgo(script.created_at)}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full uppercase tracking-wide">
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-lg font-medium">
                      {getPlatformIcon(script.platform)} {getPlatformLabel(script.platform)}
                    </span>
                    <span className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-lg font-medium">
                      {script.shoot_type === 'outdoor' ? '🌳' : '🏠'} {script.shoot_type || 'Indoor'}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Approved Section */}
      {(filter === 'all' || filter === 'approved') && approvedScripts.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 px-4"
        >
          {filter === 'all' && (
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              ✅ Approved
            </h2>
          )}

          <div className="space-y-3">
            {approvedScripts.map((script, index) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/writer/scripts/${script.id}`}
                  className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{script.title || 'Untitled'}</h3>
                      <p className="text-gray-500 text-sm">
                        Approved {formatTimeAgo(script.reviewed_at || script.updated_at)}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${
                        script.production_stage === 'SHOOTING'
                          ? 'bg-green-50 text-green-600'
                          : script.production_stage === 'EDITING'
                          ? 'bg-blue-50 text-blue-600'
                          : script.production_stage === 'POSTED'
                          ? 'bg-cyan-50 text-cyan-600'
                          : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {getStageLabel(script.production_stage)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-lg font-medium">
                      {getPlatformIcon(script.platform)} {getPlatformLabel(script.platform)}
                    </span>
                    {script.production_stage === 'SHOOTING' && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1.5 rounded-lg font-medium">
                        🎥 In Production
                      </span>
                    )}
                    {script.production_stage === 'EDITING' && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1.5 rounded-lg font-medium">
                        ✂️ Being Edited
                      </span>
                    )}
                    {script.production_stage === 'POSTED' && (
                      <span className="text-xs bg-cyan-50 text-cyan-600 px-2.5 py-1.5 rounded-lg font-medium">
                        📤 Live
                      </span>
                    )}
                    {script.production_stage === 'POSTED' && script.total_views && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1.5 rounded-lg font-medium">
                        👁 {formatViewCount(script.total_views)} views
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Rejected Section */}
      {(filter === 'all' || filter === 'rejected') && rejectedScripts.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 px-4"
        >
          {filter === 'all' && (
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              ❌ Rejected
            </h2>
          )}

          <div className="space-y-3">
            {rejectedScripts.map((script, index) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/writer/scripts/${script.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 border-l-4 border-l-red-400"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{script.title || 'Untitled'}</h3>
                      <p className="text-gray-500 text-sm">
                        Rejected {formatTimeAgo(script.reviewed_at || script.updated_at)}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      Rejected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {getPlatformIcon(script.platform)} {getPlatformLabel(script.platform)}
                    </span>
                    {script.feedback && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                        💬 Has feedback
                      </span>
                    )}
                  </div>
                  <button className="mt-3 w-full py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 active:bg-gray-100">
                    View Feedback & Revise
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
    </QueryStateWrapper>
  );
}
