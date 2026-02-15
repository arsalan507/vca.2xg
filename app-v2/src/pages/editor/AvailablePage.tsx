import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Clock, ExternalLink, Loader2, MapPin, Search, X } from 'lucide-react';
import Header from '@/components/Header';
import { editorService } from '@/services/editorService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'shorts' | 'reels' | 'long';

export default function EditorAvailablePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ViralAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await editorService.getAvailableProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    // Filter by platform
    let matchesFilter = true;
    if (filter !== 'all') {
      if (filter === 'shorts') matchesFilter = p.platform === 'youtube_shorts';
      else if (filter === 'reels') matchesFilter = p.platform === 'instagram_reel';
      else if (filter === 'long') matchesFilter = p.platform === 'youtube_long';
    }
    if (!matchesFilter) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = p.title?.toLowerCase().includes(query);
      const matchesId = p.content_id?.toLowerCase().includes(query);
      const matchesProfile = p.profile?.name?.toLowerCase().includes(query);
      const matchesVideographer = p.videographer?.full_name?.toLowerCase().includes(query) || p.videographer?.email?.toLowerCase().includes(query);
      return matchesTitle || matchesId || matchesProfile || matchesVideographer;
    }

    return true;
  });

  const counts = {
    all: projects.length,
    shorts: projects.filter((p) => p.platform === 'youtube_shorts').length,
    reels: projects.filter((p) => p.platform === 'instagram_reel').length,
    long: projects.filter((p) => p.platform === 'youtube_long').length,
  };

  const handlePick = async (projectId: string) => {
    try {
      setPickingId(projectId);
      await editorService.pickProject({ analysisId: projectId });
      toast.success('Project picked successfully!');
      navigate(`/editor/project/${projectId}`);
    } catch (error: any) {
      console.error('Failed to pick project:', error);
      toast.error(error.message || 'Failed to pick project');
      setPickingId(null);
    }
  };

  const handleSkip = async (projectId: string) => {
    try {
      await editorService.rejectProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success('Project hidden from list');
    } catch {
      toast.error('Failed to skip project');
    }
  };

  const getFileCount = (project: ViralAnalysis) => {
    return project.production_files?.filter((f: any) => !f.is_deleted).length || 0;
  };

  const getTotalSize = (project: ViralAnalysis) => {
    const totalBytes = project.production_files
      ?.filter((f: any) => !f.is_deleted)
      .reduce((sum: number, f: any) => sum + (f.file_size || 0), 0) || 0;

    if (totalBytes > 1024 * 1024 * 1024) {
      return `${(totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
    return `${(totalBytes / 1024 / 1024).toFixed(0)} MB`;
  };

  const getPlatformLabel = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram_reel': return 'Reel';
      case 'youtube_shorts': return 'Shorts';
      case 'youtube_long': return 'YouTube';
      default: return 'Video';
    }
  };

  const getUploadedFiles = (project: ViralAnalysis) => {
    return project.production_files?.filter((f: any) => !f.is_deleted && f.file_url) || [];
  };

  const getFileTypeLabel = (fileType: string) => {
    const types: Record<string, string> = {
      'RAW_FOOTAGE': 'Raw', 'A_ROLL': 'A-Roll', 'B_ROLL': 'B-Roll',
      'HOOK': 'Hook', 'BODY': 'Body', 'CTA': 'CTA',
      'AUDIO_CLIP': 'Audio', 'OTHER': 'Other', 'raw-footage': 'Raw',
    };
    return types[fileType] || fileType;
  };

  if (loading) {
    return (
      <>
        <Header title="Available Projects" showBack />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Available Projects" subtitle={`${filteredProjects.length} ready for edit`} showBack />

      <div className="px-4 py-4">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, profile, ID, or videographer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            aria-label="Search projects"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 mb-4">
          {[
            { id: 'all' as FilterType, label: 'All' },
            { id: 'reels' as FilterType, label: 'Instagram' },
            { id: 'shorts' as FilterType, label: 'YT Shorts' },
            { id: 'long' as FilterType, label: 'YT Long' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                filter === tab.id ? 'bg-white/20' : 'bg-gray-200'
              }`}>
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Project Cards */}
        <div className="space-y-3">
          {filteredProjects.map((project, index) => {
            const fileCount = getFileCount(project);
            const uploadedFiles = getUploadedFiles(project);

            return (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="p-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{project.title || 'Untitled'}</h3>
                      {project.profile?.name && (
                        <p className="text-sm text-green-600 font-medium mb-1">
                          🎯 {project.profile.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 font-mono">{project.content_id || 'No ID'}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-full shrink-0 ml-2">
                      {getPlatformLabel(project.platform)}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-xs px-2 py-1 bg-green-50 rounded text-green-600 font-medium flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {fileCount} files
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {getTotalSize(project)}
                    </span>
                    {project.shoot_type && (
                      <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {project.shoot_type}
                      </span>
                    )}
                    {project.deadline && (
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(project.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Videographer info + Reference link row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mb-3">
                    {project.videographer && (
                      <>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                          {(project.videographer.full_name || project.videographer.email || '?')
                            .split(' ')
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-500">
                          Shot by {project.videographer.full_name || project.videographer.email}
                        </span>
                      </>
                    )}
                    {project.reference_url && (
                      <a
                        href={project.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-primary font-medium flex items-center gap-1"
                      >
                        View Reference <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Uploaded footage files with Drive links */}
                  {uploadedFiles.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Uploaded Footage</p>
                      <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                        {uploadedFiles.map((file: any) => (
                          <a
                            key={file.id}
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2.5"
                          >
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                              <Video className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-blue-600 truncate">{file.file_name}</p>
                              <div className="flex items-center gap-2">
                                {file.file_size && (
                                  <span className="text-[11px] text-gray-400">
                                    {(file.file_size / 1024 / 1024).toFixed(1)} MB
                                  </span>
                                )}
                                <span className="text-[11px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded">
                                  {getFileTypeLabel(file.file_type)}
                                </span>
                              </div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSkip(project.id)}
                      className="flex-1 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-medium text-gray-700 active:bg-gray-200"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handlePick(project.id)}
                      disabled={pickingId === project.id}
                      className="flex-[2] h-10 flex items-center justify-center gap-2 bg-editor rounded-lg text-sm font-semibold text-white active:opacity-90 disabled:opacity-50"
                    >
                      {pickingId === project.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Pick to Edit'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Projects Available</h3>
            <p className="text-gray-500 text-sm">Check back later for new projects to edit</p>
          </div>
        )}
      </div>
    </>
  );
}
