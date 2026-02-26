import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, FileText, CheckSquare, Square, CheckCircle, Loader2, Search, X } from 'lucide-react';
import { adminService } from '@/services/adminService';
import { smartSearch } from '@/lib/smartSearch';
import { queryKeys } from '@/lib/queryKeys';
import QueryStateWrapper from '@/components/QueryStateWrapper';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'instagram' | 'youtube_shorts' | 'youtube_long';

export default function PendingPage() {
  const { data: scripts = [], isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.pendingAnalyses(),
    queryFn: () => adminService.getPendingAnalyses(),
  });

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  // Toggle bulk mode
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedScripts(new Set()); // Clear selections when toggling
  };

  // Select/deselect individual script
  const toggleScript = (scriptId: string) => {
    const newSelection = new Set(selectedScripts);
    if (newSelection.has(scriptId)) {
      newSelection.delete(scriptId);
    } else {
      newSelection.add(scriptId);
    }
    setSelectedScripts(newSelection);
  };

  // Select all visible scripts
  const selectAll = () => {
    const allIds = new Set(filteredScripts.map(s => s.id));
    setSelectedScripts(allIds);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedScripts(new Set());
  };

  // Bulk approve handler
  const handleBulkApprove = async () => {
    if (selectedScripts.size === 0) {
      toast.error('Please select at least one script');
      return;
    }

    // TODO: Implement bulk approve method in adminService
    toast.error('Bulk approve feature coming soon');
    return;

    // try {
    //   setBulkApproving(true);
    //   // Approve all selected scripts in parallel
    //   const approvalPromises = Array.from(selectedScripts).map(scriptId =>
    //     adminService.approveScript({ analysisId: scriptId })
    //   );
    //   await Promise.all(approvalPromises);
    //   toast.success(`Successfully approved ${selectedScripts.size} scripts!`);
    //   // Refresh list
    //   await loadScripts();
    //   // Clear selections
    //   setSelectedScripts(new Set());
    //   setBulkMode(false);
    // } catch (error) {
    //   console.error('Bulk approve failed:', error);
    //   toast.error('Some approvals failed. Check console for details.');
    // } finally {
    //   setBulkApproving(false);
    // }
  };

  const platformFiltered = scripts.filter((script) => {
    if (filter === 'all') return true;
    if (filter === 'instagram') return script.platform === 'instagram_reel';
    if (filter === 'youtube_shorts') return script.platform === 'youtube_shorts';
    if (filter === 'youtube_long') return script.platform === 'youtube_long';
    return true;
  });

  const filteredScripts = searchQuery.trim()
    ? smartSearch(searchQuery, platformFiltered)
    : platformFiltered;

  const counts = {
    all: scripts.length,
    instagram: scripts.filter((s) => s.platform === 'instagram_reel').length,
    youtube_shorts: scripts.filter((s) => s.platform === 'youtube_shorts').length,
    youtube_long: scripts.filter((s) => s.platform === 'youtube_long').length,
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
        return 'Video';
    }
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'youtube_shorts', label: 'YT Shorts' },
    { id: 'youtube_long', label: 'YouTube' },
  ];

  return (
    <QueryStateWrapper
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      error={error}
      data={scripts}
      onRetry={refetch}
      accentColor="purple"
    >
    <div className="pb-4">
      {/* Header with Bulk Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Pending Scripts
          <span className="text-sm text-gray-500 font-normal ml-2">
            {scripts.length} total
          </span>
        </h1>
        <button
          onClick={toggleBulkMode}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
            bulkMode
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

      {/* Bulk Action Bar - Fixed when in bulk mode */}
      {bulkMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
          <div className="max-w-mobile mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">
                {selectedScripts.size} selected
              </span>
              {selectedScripts.size < filteredScripts.length ? (
                <button
                  onClick={selectAll}
                  className="text-xs text-purple-600 font-medium hover:underline"
                >
                  Select All ({filteredScripts.length})
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
              disabled={selectedScripts.size === 0 || bulkApproving}
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
                  Approve ({selectedScripts.size})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Smart Search Bar */}
      {!bulkMode && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Smart search — title, notes, crew, shoot type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1 px-1">
            💡 Try: "father son night" · "outdoor cafe" · "no audio"
          </p>
          {searchQuery.trim() && (
            <p className="text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-1.5 mt-2">
              🔍 {filteredScripts.length} result{filteredScripts.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 ${bulkMode ? 'mt-16' : ''}`}
      >
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs ${
                filter === f.id ? 'bg-white/20' : 'bg-gray-200'
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
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-purple-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No pending scripts</h3>
          <p className="text-gray-500 text-sm">All scripts have been reviewed</p>
        </motion.div>
      )}

      {/* Script Cards */}
      <div className="space-y-3">
        {filteredScripts.map((script, index) => {
          const isSelected = selectedScripts.has(script.id);

          return (
            <motion.div
              key={script.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={`relative bg-white border-2 rounded-xl p-4 transition-all ${
                isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
              }`}>
                {/* Selection Checkbox - Only visible in bulk mode */}
                {bulkMode && (
                  <button
                    onClick={() => toggleScript(script.id)}
                    className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center bg-white rounded-lg border-2 border-gray-300 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                )}

                <div className={`${bulkMode ? 'pl-10' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{script.title || 'Untitled'}</h3>
                      <p className="text-gray-500 text-sm">
                        {script.full_name || script.email} • {formatTimeAgo(script.created_at)}
                      </p>
                    </div>
                    {!bulkMode && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {getPlatformIcon(script.platform)} {getPlatformLabel(script.platform)}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {script.shoot_type === 'outdoor' ? '🌳' : '🏠'} {script.shoot_type || 'Indoor'}
                    </span>
                  </div>

                  {!bulkMode && (
                    <Link
                      to={`/admin/review/${script.id}`}
                      className="block w-full py-2 bg-purple-500 text-white text-center rounded-lg text-sm font-medium active:bg-purple-600"
                    >
                      Review
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
    </QueryStateWrapper>
  );
}
