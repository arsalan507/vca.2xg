import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { assignmentService } from '@/services/assignmentService';
import { contentConfigService } from '@/services/contentConfigService';
import MultiSelectTags from '@/components/MultiSelectTags';
import type { ViralAnalysis, AssignTeamData } from '@/types';
import {
  UserGroupIcon,
  VideoCameraIcon,
  FilmIcon,
  MegaphoneIcon,
  SparklesIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';

interface AssignTeamModalProps {
  analysis: ViralAnalysis;
  isOpen: boolean;
  onClose: () => void;
}

const SHOOT_POSSIBILITIES = [
  { value: 25, label: '25%', description: 'Low', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 50, label: '50%', description: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 75, label: '75%', description: 'Good', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 100, label: '100%', description: 'Ready', color: 'bg-green-100 text-green-800 border-green-300' },
];

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
    // Auto-assign all roles by default
    autoAssignVideographer: !analysis.videographer?.id,
    autoAssignEditor: !analysis.editor?.id,
    autoAssignPostingManager: !analysis.posting_manager?.id,
    // Production Details
    industryId: analysis.industry_id || '',
    profileId: analysis.profile_id || '',
    hookTagIds: analysis.hook_tags?.map(t => t.id) || [],
    characterTagIds: analysis.character_tags?.map(t => t.id) || [],
    totalPeopleInvolved: analysis.total_people_involved || 1,
    shootPossibility: analysis.shoot_possibility || undefined,
    // Admin remarks
    adminRemarks: analysis.admin_remarks || '',
  });

  // Update form data when modal opens or analysis changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        videographerId: analysis.videographer?.id,
        editorId: analysis.editor?.id,
        postingManagerId: analysis.posting_manager?.id,
        // Auto-assign all roles by default
        autoAssignVideographer: !analysis.videographer?.id,
        autoAssignEditor: !analysis.editor?.id,
        autoAssignPostingManager: !analysis.posting_manager?.id,
        // Production Details
        industryId: analysis.industry_id || '',
        profileId: analysis.profile_id || '',
        hookTagIds: analysis.hook_tags?.map(t => t.id) || [],
        characterTagIds: analysis.character_tags?.map(t => t.id) || [],
        totalPeopleInvolved: analysis.total_people_involved || 1,
        shootPossibility: analysis.shoot_possibility || undefined,
        // Admin remarks
        adminRemarks: analysis.admin_remarks || '',
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

  // Fetch production details options
  const { data: industries = [] } = useQuery({
    queryKey: ['industries'],
    queryFn: contentConfigService.getAllIndustries,
    enabled: isOpen,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profile-list'],
    queryFn: contentConfigService.getAllProfiles,
    enabled: isOpen,
  });

  const { data: hookTags = [] } = useQuery({
    queryKey: ['hook-tags'],
    queryFn: contentConfigService.getAllHookTags,
    enabled: isOpen,
  });

  const { data: characterTags = [] } = useQuery({
    queryKey: ['character-tags'],
    queryFn: contentConfigService.getAllCharacterTags,
    enabled: isOpen,
  });

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: (data: AssignTeamData) =>
      assignmentService.assignTeam(analysis.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['analysis', analysis.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'production-status'] });
      toast.success('Team assigned and production details saved!');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign team');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all mandatory production details
    const missingFields: string[] = [];

    if (!formData.industryId) missingFields.push('Industry');
    if (!formData.profileId) missingFields.push('Profile');
    if (!formData.hookTagIds || formData.hookTagIds.length === 0) missingFields.push('Hook Tags');
    if (!formData.characterTagIds || formData.characterTagIds.length === 0) missingFields.push('Character Tags');
    if (!formData.totalPeopleInvolved || formData.totalPeopleInvolved < 1) missingFields.push('Total People Involved');
    if (!formData.shootPossibility) missingFields.push('Shoot Possibility');

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

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
        <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-5 rounded-t-xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <UserGroupIcon className="w-7 h-7 text-white mr-3" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Assign Team & Production Details</h2>
                  <p className="text-primary-100 text-sm mt-1">
                    Complete production setup for this script
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
              <h3 className="font-semibold text-gray-900 mb-2">Script Details</h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-700">
                  <span className="font-medium">Content ID:</span>{' '}
                  <span className="font-mono text-primary-600">{analysis.content_id || 'N/A'}</span>
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Hook:</span>{' '}
                  {analysis.hook?.substring(0, 80)}
                  {(analysis.hook?.length || 0) > 80 ? '...' : ''}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Score:</span>{' '}
                  {analysis.overall_score?.toFixed(1) || 'N/A'}/10
                </p>
              </div>
            </div>

            {/* Production Details Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100 mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center">
                  <BuildingOfficeIcon className="w-4 h-4 mr-2 text-blue-600" />
                  Production Details
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Categorization and production requirements
                </p>
              </div>

              {/* Industry & Profile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <BuildingOfficeIcon className="w-4 h-4 inline mr-1 text-gray-500" />
                    Industry <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.industryId || ''}
                    onChange={(e) => setFormData({ ...formData, industryId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm ${
                      !formData.industryId ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select industry...</option>
                    {industries
                      .filter((i: any) => i.is_active)
                      .map((industry: any) => (
                        <option key={industry.id} value={industry.id}>
                          {industry.name} ({industry.short_code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <UserGroupIcon className="w-4 h-4 inline mr-1 text-gray-500" />
                    Profile / Admin <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.profileId || ''}
                    onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm ${
                      !formData.profileId ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select profile...</option>
                    {profiles
                      .filter((p: any) => p.is_active)
                      .map((profile: any) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Hook Tags */}
              <div className={`rounded-lg p-4 border mb-4 ${
                (!formData.hookTagIds || formData.hookTagIds.length === 0)
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <MultiSelectTags
                  label={<>Hook Tags <span className="text-red-500">*</span></>}
                  options={hookTags.filter((t: any) => t.is_active).map((t: any) => ({ id: t.id, name: t.name }))}
                  selectedIds={formData.hookTagIds || []}
                  onChange={(ids) => setFormData({ ...formData, hookTagIds: ids })}
                  placeholder="Select hook types..."
                  allowCreate={true}
                  onAddCustomTag={(tagName) => {
                    console.log('Custom hook tag added:', tagName);
                  }}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Select hook types or type and press Enter to create custom tags
                </p>
              </div>

              {/* Character Tags */}
              <div className={`rounded-lg p-4 border mb-4 ${
                (!formData.characterTagIds || formData.characterTagIds.length === 0)
                  ? 'bg-red-50 border-red-200'
                  : 'bg-teal-50 border-teal-200'
              }`}>
                <MultiSelectTags
                  label={<>Character Tags <span className="text-red-500">*</span></>}
                  options={characterTags.filter((t: any) => t.is_active).map((t: any) => ({ id: t.id, name: t.name }))}
                  selectedIds={formData.characterTagIds || []}
                  onChange={(ids) => setFormData({ ...formData, characterTagIds: ids })}
                  placeholder="Select characters..."
                  allowCreate={true}
                  onAddCustomTag={(tagName) => {
                    console.log('Custom character tag added:', tagName);
                  }}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Who will appear in the video? Type and press Enter to add custom characters
                </p>
              </div>

              {/* Total People & Shoot Possibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <UsersIcon className="w-4 h-4 inline mr-1 text-gray-500" />
                    Total People Involved <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.totalPeopleInvolved || 1}
                    onChange={(e) => setFormData({ ...formData, totalPeopleInvolved: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    How many people will be needed for the shoot?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <ChartBarIcon className="w-4 h-4 inline mr-1 text-gray-500" />
                    Shoot Possibility <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SHOOT_POSSIBILITIES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, shootPossibility: option.value as 25 | 50 | 75 | 100 })}
                        className={`px-2 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                          formData.shootPossibility === option.value
                            ? `${option.color} ring-2 ring-offset-1 ring-primary-400`
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold">{option.label}</div>
                        <div className="text-xs mt-0.5 opacity-75">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Admin Remarks */}
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <ChatBubbleBottomCenterTextIcon className="w-4 h-4 inline mr-1 text-amber-600" />
                  Admin Remarks
                </label>
                <textarea
                  value={formData.adminRemarks || ''}
                  onChange={(e) => setFormData({ ...formData, adminRemarks: e.target.value })}
                  placeholder="Add any notes or instructions for the team..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm resize-none"
                />
                <p className="mt-1.5 text-xs text-amber-700">
                  These remarks will be highlighted and visible to all assigned team members
                </p>
              </div>
            </div>

            {/* Team Assignment Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-100 mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center">
                  <UserGroupIcon className="w-4 h-4 mr-2 text-purple-600" />
                  Team Assignment
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Assign team members to start production
                </p>
              </div>

              {/* Videographer Assignment */}
              <div className="space-y-3 mb-4">
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
              <div className="space-y-3 mb-4">
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
                    Saving...
                  </>
                ) : (
                  <>
                    <UserGroupIcon className="w-5 h-5 mr-2" />
                    Save & Assign Team
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
