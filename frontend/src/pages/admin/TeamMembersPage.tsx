import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { UserGroupIcon, DocumentTextIcon, VideoCameraIcon, FilmIcon, MegaphoneIcon, TableCellsIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import TeamMemberProjectsModal from '@/components/admin/TeamMemberProjectsModal';

interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  avatar_url?: string;
  created_at: string;
}

interface TeamStats {
  total_submitted?: number;
  approved?: number;
  rejected?: number;
  pending?: number;
  approval_rate?: number;
  assigned?: number;
  shooting?: number;
  in_review?: number;
  completed?: number;
  editing?: number;
  ready_to_post?: number;
  posted?: number;
  posted_this_week?: number;
}

export default function TeamMembersPage() {
  const navigate = useNavigate();
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; role: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scriptWriterSearch, setScriptWriterSearch] = useState('');
  const [videographerSearch, setVideographerSearch] = useState('');
  const [editorSearch, setEditorSearch] = useState('');
  const [postingSearch, setPostingSearch] = useState('');

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember({
      id: member.id,
      name: member.full_name || member.email,
      role: member.role,
    });
    setIsModalOpen(true);
  };

  const handleViewAnalyses = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admin/analyses/by-user/${userId}`);
  };

  // Fetch all team members
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['admin', 'team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['SCRIPT_WRITER', 'VIDEOGRAPHER', 'EDITOR', 'POSTING_MANAGER'])
        .order('role')
        .order('full_name');

      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Fetch stats for script writers
  const { data: scriptWriterStats = {} } = useQuery({
    queryKey: ['admin', 'script-writer-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viral_analyses')
        .select('user_id, status');

      if (error) throw error;

      const stats: Record<string, TeamStats> = {};

      data.forEach((item: any) => {
        if (!stats[item.user_id]) {
          stats[item.user_id] = {
            total_submitted: 0,
            approved: 0,
            rejected: 0,
            pending: 0,
          };
        }
        stats[item.user_id].total_submitted!++;
        if (item.status === 'APPROVED') stats[item.user_id].approved!++;
        if (item.status === 'REJECTED') stats[item.user_id].rejected!++;
        if (item.status === 'PENDING') stats[item.user_id].pending!++;
      });

      // Calculate approval rates
      Object.keys(stats).forEach(userId => {
        const total = stats[userId].approved! + stats[userId].rejected!;
        stats[userId].approval_rate = total > 0 ? Math.round((stats[userId].approved! / total) * 100) : 0;
      });

      return stats;
    },
  });

  // Fetch stats for videographers
  const { data: videographerStats = {} } = useQuery({
    queryKey: ['admin', 'videographer-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          user_id,
          viral_analyses!inner (production_stage)
        `)
        .eq('role', 'VIDEOGRAPHER');

      if (error) throw error;

      const stats: Record<string, TeamStats> = {};

      data.forEach((item: any) => {
        if (!stats[item.user_id]) {
          stats[item.user_id] = {
            assigned: 0,
            shooting: 0,
            in_review: 0,
            completed: 0,
          };
        }
        stats[item.user_id].assigned!++;

        const stage = item.viral_analyses?.production_stage;
        if (stage === 'SHOOTING') stats[item.user_id].shooting!++;
        if (stage === 'SHOOT_REVIEW') stats[item.user_id].in_review!++;
        if (['EDITING', 'EDIT_REVIEW', 'FINAL_REVIEW', 'READY_TO_POST', 'POSTED'].includes(stage)) {
          stats[item.user_id].completed!++;
        }
      });

      return stats;
    },
  });

  // Fetch stats for editors
  const { data: editorStats = {} } = useQuery({
    queryKey: ['admin', 'editor-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          user_id,
          viral_analyses!inner (production_stage)
        `)
        .eq('role', 'EDITOR');

      if (error) throw error;

      const stats: Record<string, TeamStats> = {};

      data.forEach((item: any) => {
        if (!stats[item.user_id]) {
          stats[item.user_id] = {
            assigned: 0,
            editing: 0,
            in_review: 0,
            completed: 0,
          };
        }
        stats[item.user_id].assigned!++;

        const stage = item.viral_analyses?.production_stage;
        if (stage === 'EDITING') stats[item.user_id].editing!++;
        if (stage === 'EDIT_REVIEW') stats[item.user_id].in_review!++;
        if (['FINAL_REVIEW', 'READY_TO_POST', 'POSTED'].includes(stage)) {
          stats[item.user_id].completed!++;
        }
      });

      return stats;
    },
  });

  // Fetch stats for posting managers
  const { data: postingStats = {} } = useQuery({
    queryKey: ['admin', 'posting-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          user_id,
          viral_analyses!inner (production_stage, updated_at)
        `)
        .eq('role', 'POSTING_MANAGER');

      if (error) throw error;

      const stats: Record<string, TeamStats> = {};
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      data.forEach((item: any) => {
        if (!stats[item.user_id]) {
          stats[item.user_id] = {
            assigned: 0,
            ready_to_post: 0,
            posted: 0,
            posted_this_week: 0,
          };
        }
        stats[item.user_id].assigned!++;

        const stage = item.viral_analyses?.production_stage;
        if (stage === 'READY_TO_POST') stats[item.user_id].ready_to_post!++;
        if (stage === 'POSTED') {
          stats[item.user_id].posted!++;
          if (new Date(item.viral_analyses.updated_at) > oneWeekAgo) {
            stats[item.user_id].posted_this_week!++;
          }
        }
      });

      return stats;
    },
  });

  const groupedMembers = {
    SCRIPT_WRITER: teamMembers.filter(m => m.role === 'SCRIPT_WRITER'),
    VIDEOGRAPHER: teamMembers.filter(m => m.role === 'VIDEOGRAPHER'),
    EDITOR: teamMembers.filter(m => m.role === 'EDITOR'),
    POSTING_MANAGER: teamMembers.filter(m => m.role === 'POSTING_MANAGER'),
  };

  // Filtered lists based on search
  const filteredScriptWriters = useMemo(() => {
    if (!scriptWriterSearch.trim()) return groupedMembers.SCRIPT_WRITER;
    const search = scriptWriterSearch.toLowerCase();
    return groupedMembers.SCRIPT_WRITER.filter(member =>
      (member.full_name?.toLowerCase().includes(search)) ||
      member.email.toLowerCase().includes(search)
    );
  }, [groupedMembers.SCRIPT_WRITER, scriptWriterSearch]);

  const filteredVideographers = useMemo(() => {
    if (!videographerSearch.trim()) return groupedMembers.VIDEOGRAPHER;
    const search = videographerSearch.toLowerCase();
    return groupedMembers.VIDEOGRAPHER.filter(member =>
      (member.full_name?.toLowerCase().includes(search)) ||
      member.email.toLowerCase().includes(search)
    );
  }, [groupedMembers.VIDEOGRAPHER, videographerSearch]);

  const filteredEditors = useMemo(() => {
    if (!editorSearch.trim()) return groupedMembers.EDITOR;
    const search = editorSearch.toLowerCase();
    return groupedMembers.EDITOR.filter(member =>
      (member.full_name?.toLowerCase().includes(search)) ||
      member.email.toLowerCase().includes(search)
    );
  }, [groupedMembers.EDITOR, editorSearch]);

  const filteredPostingManagers = useMemo(() => {
    if (!postingSearch.trim()) return groupedMembers.POSTING_MANAGER;
    const search = postingSearch.toLowerCase();
    return groupedMembers.POSTING_MANAGER.filter(member =>
      (member.full_name?.toLowerCase().includes(search)) ||
      member.email.toLowerCase().includes(search)
    );
  }, [groupedMembers.POSTING_MANAGER, postingSearch]);

  // const getRoleIcon = (role: string) => {
  //   switch (role) {
  //     case 'SCRIPT_WRITER': return <DocumentTextIcon className="w-5 h-5" />;
  //     case 'VIDEOGRAPHER': return <VideoCameraIcon className="w-5 h-5" />;
  //     case 'EDITOR': return <FilmIcon className="w-5 h-5" />;
  //     case 'POSTING_MANAGER': return <MegaphoneIcon className="w-5 h-5" />;
  //     default: return <UserGroupIcon className="w-5 h-5" />;
  //   }
  // };

  // const getRoleColor = (role: string) => {
  //   switch (role) {
  //     case 'SCRIPT_WRITER': return 'text-blue-600';
  //     case 'VIDEOGRAPHER': return 'text-indigo-600';
  //     case 'EDITOR': return 'text-purple-600';
  //     case 'POSTING_MANAGER': return 'text-pink-600';
  //     default: return 'text-gray-600';
  //   }
  // };

  // const getRoleName = (role: string) => {
  //   return role.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') + 's';
  // };

  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <UserGroupIcon className="w-7 h-7 mr-3 text-primary-600" />
          Team Members
        </h1>
        <p className="text-gray-600 mt-1">
          {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''} across all roles
        </p>
      </div>

      {/* Content */}
      <div className="p-8 space-y-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Script Writers */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <DocumentTextIcon className="w-5 h-5 mr-2 text-blue-600" />
                  Script Writers
                  <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {filteredScriptWriters.length} {scriptWriterSearch ? 'found' : 'active'}
                  </span>
                </h2>
                <div className="relative w-full md:w-64">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={scriptWriterSearch}
                    onChange={(e) => setScriptWriterSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Total Scripts
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Approved
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Rejected
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Pending
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Approval Rate
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredScriptWriters.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                            No script writers found matching "{scriptWriterSearch}"
                          </td>
                        </tr>
                      ) : (
                        filteredScriptWriters.map((member) => {
                          const stats = scriptWriterStats[member.id] || {};
                          return (
                            <tr key={member.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleMemberClick(member)}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline text-left"
                                >
                                  {member.full_name || member.email}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stats.total_submitted || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                {stats.approved || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                                {stats.rejected || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                                {stats.pending || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  (stats.approval_rate || 0) >= 75 ? 'bg-green-100 text-green-800' :
                                  (stats.approval_rate || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {stats.approval_rate || 0}%
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={(e) => handleViewAnalyses(member.id, e)}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition"
                                >
                                  <TableCellsIcon className="w-4 h-4 mr-1.5" />
                                  View Table
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Videographers */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <VideoCameraIcon className="w-5 h-5 mr-2 text-indigo-600" />
                  Videographers
                  <span className="ml-3 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                    {filteredVideographers.length} {videographerSearch ? 'found' : 'active'}
                  </span>
                </h2>
                <div className="relative w-full md:w-64">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={videographerSearch}
                    onChange={(e) => setVideographerSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Assigned
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Shooting
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          In Review
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Completed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredVideographers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                            {videographerSearch ? `No videographers found matching "${videographerSearch}"` : 'No videographers yet'}
                          </td>
                        </tr>
                      ) : (
                        filteredVideographers.map((member) => {
                          const stats = videographerStats[member.id] || {};
                          return (
                            <tr key={member.id} className="hover:bg-gray-50 cursor-pointer">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleMemberClick(member)}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline text-left"
                                >
                                  {member.full_name || member.email}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stats.assigned || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                {stats.shooting || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                                {stats.in_review || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                {stats.completed || 0}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Editors */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FilmIcon className="w-5 h-5 mr-2 text-purple-600" />
                  Editors
                  <span className="ml-3 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    {filteredEditors.length} {editorSearch ? 'found' : 'active'}
                  </span>
                </h2>
                <div className="relative w-full md:w-64">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={editorSearch}
                    onChange={(e) => setEditorSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Assigned
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Editing
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          In Review
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Completed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredEditors.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                            {editorSearch ? `No editors found matching "${editorSearch}"` : 'No editors yet'}
                          </td>
                        </tr>
                      ) : (
                        filteredEditors.map((member) => {
                          const stats = editorStats[member.id] || {};
                          return (
                            <tr key={member.id} className="hover:bg-gray-50 cursor-pointer">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleMemberClick(member)}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline text-left"
                                >
                                  {member.full_name || member.email}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stats.assigned || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">
                                {stats.editing || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                                {stats.in_review || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                {stats.completed || 0}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Posting Managers */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MegaphoneIcon className="w-5 h-5 mr-2 text-pink-600" />
                  Posting Managers
                  <span className="ml-3 px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-medium">
                    {filteredPostingManagers.length} {postingSearch ? 'found' : 'active'}
                  </span>
                </h2>
                <div className="relative w-full md:w-64">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={postingSearch}
                    onChange={(e) => setPostingSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Assigned
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Ready to Post
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Posted (Total)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          This Week
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPostingManagers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                            {postingSearch ? `No posting managers found matching "${postingSearch}"` : 'No posting managers yet'}
                          </td>
                        </tr>
                      ) : (
                        filteredPostingManagers.map((member) => {
                          const stats = postingStats[member.id] || {};
                          return (
                            <tr key={member.id} className="hover:bg-gray-50 cursor-pointer">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleMemberClick(member)}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline text-left"
                                >
                                  {member.full_name || member.email}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stats.assigned || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                                {stats.ready_to_post || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                {stats.posted || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                {stats.posted_this_week || 0}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Team Member Projects Modal */}
      {selectedMember && (
        <TeamMemberProjectsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMember(null);
          }}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          memberRole={selectedMember.role}
        />
      )}
    </div>
  );
}
