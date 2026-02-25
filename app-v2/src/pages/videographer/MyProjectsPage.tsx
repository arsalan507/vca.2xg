import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Check, Search, X } from 'lucide-react';
import Header from '@/components/Header';
import { videographerService } from '@/services/videographerService';
import { smartSearch } from '@/lib/smartSearch';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

type TabType = 'active' | 'completed';

export default function MyProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await videographerService.getMyProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Apply smart search, then split by tab
  const searched = searchQuery.trim()
    ? smartSearch(searchQuery, projects)
    : projects;

  const shootingProjects = searched.filter((p) => p.production_stage === 'SHOOTING');
  const completedProjects = searched.filter((p) =>
    ['READY_FOR_EDIT', 'EDITING', 'READY_TO_POST', 'POSTED'].includes(p.production_stage || '')
  );

  const activeCount = shootingProjects.length;
  const completedCount = completedProjects.length;

  const getFileCount = (project: ViralAnalysis) => {
    return project.production_files?.filter((f: any) => !f.is_deleted).length || 0;
  };

  // Get category emoji based on title
  const getCategoryEmoji = (project: ViralAnalysis) => {
    const title = (project.title || '').toLowerCase();
    if (title.includes('fitness') || title.includes('gym') || title.includes('workout')) return '🏋️';
    if (title.includes('food') || title.includes('recipe') || title.includes('cook')) return '🍳';
    if (title.includes('coffee') || title.includes('cafe')) return '☕';
    if (title.includes('office') || title.includes('work')) return '👨‍💼';
    if (title.includes('home') || title.includes('decor') || title.includes('diy') || title.includes('routine') || title.includes('morning')) return '🏠';
    if (title.includes('travel') || title.includes('outdoor') || title.includes('street') || title.includes('food')) return '🌳';
    if (title.includes('tech') || title.includes('gadget')) return '📱';
    if (title.includes('fashion') || title.includes('style')) return '👗';
    if (title.includes('music') || title.includes('dance')) return '💃';
    if (title.includes('tutorial')) return '📚';
    return '🎬';
  };

  // Get shoot type info
  const getShootTypeInfo = (shootType?: string) => {
    const type = (shootType || 'indoor').toLowerCase();
    if (type.includes('outdoor')) return { emoji: '🌳', label: 'Outdoor', bg: 'rgba(34, 197, 94, 0.1)' };
    if (type.includes('studio')) return { emoji: '🎬', label: 'Studio', bg: 'rgba(147, 51, 234, 0.1)' };
    if (type.includes('store') || type.includes('shop')) return { emoji: '🏪', label: 'In Store', bg: 'rgba(99, 102, 241, 0.1)' };
    return { emoji: '🏠', label: 'Indoor', bg: 'rgba(249, 115, 22, 0.1)' };
  };

  // Get platform info
  const getPlatformInfo = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('youtube') && p.includes('short')) return { emoji: '🎬', label: 'YouTube Shorts' };
    if (p.includes('youtube')) return { emoji: '▶️', label: 'YouTube Long' };
    if (p.includes('tiktok')) return { emoji: '🎵', label: 'TikTok' };
    return { emoji: '📸', label: 'Instagram' };
  };

  // Get stage info for completed projects
  const getStageInfo = (stage?: string) => {
    switch (stage) {
      case 'READY_FOR_EDIT': return { label: 'Ready for Edit', color: 'bg-purple-100 text-purple-700' };
      case 'EDITING': return { label: 'Editing', color: 'bg-pink-100 text-pink-700' };
      case 'EDIT_REVIEW': return { label: 'Edit Review', color: 'bg-amber-100 text-amber-700' };
      case 'READY_TO_POST': return { label: 'Ready to Post', color: 'bg-green-100 text-green-700' };
      case 'POSTED': return { label: 'Posted', color: 'bg-emerald-100 text-emerald-700' };
      default: return { label: stage || 'Unknown', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const handleMarkComplete = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setMarkingComplete(projectId);
      await videographerService.markShootingComplete(projectId);
      toast.success('Shooting marked as complete!');
      loadProjects();
    } catch (error: any) {
      console.error('Failed to mark complete:', error);
      toast.error(error.message || 'Failed to mark complete');
    } finally {
      setMarkingComplete(null);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="My Shoots" showBack />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="My Shoots" subtitle={`${activeCount} active, ${completedCount} completed`} showBack />

      <div className="px-4 py-4">
        {/* Smart Search Bar */}
        <div className="relative mb-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search shoots — title, characters, shoot type…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mb-3 px-1">
          💡 Try: "outdoor" · "zubair" · "no audio"
        </p>
        {searchQuery.trim() && (
          <p className="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-1.5 mb-3">
            🔍 {activeCount + completedCount} result{activeCount + completedCount !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        )}

        {/* Tab Switcher - Pill Style */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Active
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'active' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {activeCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'completed'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Completed
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'completed' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {completedCount}
            </span>
          </button>
        </div>

        {activeTab === 'active' && (
          <div className="space-y-3 animate-fade-in">
            {shootingProjects.map((project, index) => {
              const categoryEmoji = getCategoryEmoji(project);
              const shootType = getShootTypeInfo(project.shoot_type);
              const platform = getPlatformInfo(project.platform);
              const fileCount = getFileCount(project);
              const hasFiles = fileCount > 0;

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="p-4">
                    {/* Project Header with Thumbnail */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                        style={{ background: shootType.bg }}
                      >
                        {categoryEmoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
                        <p className="text-sm text-gray-400 font-mono">{project.content_id || 'No ID'}</p>
                        {project.character_tags && project.character_tags.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            👤 {project.character_tags.map((t: any) => t.name).join(' · ')}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {platform.emoji} {platform.label}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {shootType.emoji} {shootType.label}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            📁 {fileCount} files
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[11px] font-semibold rounded-full uppercase shrink-0">
                        Shooting
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {hasFiles ? (
                        <>
                          <button
                            onClick={() => navigate(`/videographer/upload/${project.id}`)}
                            className="flex-1 h-11 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 active:bg-gray-50"
                          >
                            Add More
                          </button>
                          <button
                            onClick={(e) => handleMarkComplete(project.id, e)}
                            disabled={markingComplete === project.id}
                            className="flex-[2] h-11 flex items-center justify-center gap-2 bg-green-500 rounded-lg text-sm font-semibold text-white active:bg-green-600 disabled:opacity-50"
                          >
                            {markingComplete === project.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                Mark Complete
                                <Check className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <Link
                          to={`/videographer/upload/${project.id}`}
                          className="flex-1 h-11 flex items-center justify-center gap-2 bg-orange-500 rounded-lg text-sm font-semibold text-white active:bg-orange-600"
                        >
                          Upload Footage
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {activeCount === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎬</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Active Shoots</h3>
                <p className="text-gray-500 text-sm mb-4">Pick a project to get started</p>
                <Link
                  to="/videographer/available"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-videographer text-white rounded-lg text-sm font-medium"
                >
                  Browse Available Projects
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-4 animate-fade-in">
            {/* Section Header */}
            {completedProjects.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">✅</span>
                <h2 className="text-base font-semibold text-gray-800">Recently Completed</h2>
              </div>
            )}

            {completedProjects.map((project, index) => {
              const categoryEmoji = getCategoryEmoji(project);
              const shootType = getShootTypeInfo(project.shoot_type);
              const platform = getPlatformInfo(project.platform);
              const fileCount = getFileCount(project);
              const stageInfo = getStageInfo(project.production_stage);

              return (
                <Link
                  key={project.id}
                  to={`/videographer/project/${project.id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden card-press animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="p-4">
                    {/* Project Header with Thumbnail */}
                    <div className="flex items-start gap-3">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                        style={{ background: shootType.bg }}
                      >
                        {categoryEmoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title || 'Untitled'}</h3>
                        <p className="text-sm text-gray-400 font-mono">{project.content_id || 'No ID'}</p>
                        {project.character_tags && project.character_tags.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            👤 {project.character_tags.map((t: any) => t.name).join(' · ')}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {platform.emoji} {platform.label}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {shootType.emoji} {shootType.label}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            📁 {fileCount} files
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-[11px] font-semibold rounded-full uppercase shrink-0 ${stageInfo.color}`}>
                        {stageInfo.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}

            {completedCount === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📁</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Completed Shoots</h3>
                <p className="text-gray-500 text-sm">Your completed shoots will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
