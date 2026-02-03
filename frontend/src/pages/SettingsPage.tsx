import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Cog6ToothIcon,
  UserPlusIcon,
  CloudIcon,
  TrashIcon,
  UserCircleIcon,
  DocumentTextIcon,
  Bars3Icon,
  PlusIcon,
  WrenchScrewdriverIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PencilIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { UserRole } from '@/types';
import { supabase } from '@/lib/supabase';
import { adminUserService } from '@/services/adminUserService';
import BottomNavigation from '@/components/BottomNavigation';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'team' | 'drive' | 'fields' | 'formBuilder'>('team');

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:px-6">
        <div className="flex items-center">
          <Cog6ToothIcon className="w-6 h-6 md:w-8 md:h-8 text-primary-600 mr-2 md:mr-3" />
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-900">Settings</h1>
            <p className="hidden md:block mt-1 text-gray-600">
              Manage team members and configure Google Drive integration
            </p>
          </div>
        </div>
      </div>

      {/* Tabs - Horizontal Scrollable on Mobile */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max px-2 md:px-6">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'team'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlusIcon className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2" />
            <span className="hidden md:inline">Team Management</span>
            <span className="md:hidden">Team</span>
          </button>
          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'drive'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CloudIcon className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2" />
            <span className="hidden md:inline">Google Drive</span>
            <span className="md:hidden">Drive</span>
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex items-center px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'fields'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2" />
            <span className="hidden md:inline">Dropdown Options</span>
            <span className="md:hidden">Dropdowns</span>
          </button>
          <button
            onClick={() => setActiveTab('formBuilder')}
            className={`flex items-center px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'formBuilder'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <WrenchScrewdriverIcon className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2" />
            <span className="hidden md:inline">Form Builder</span>
            <span className="md:hidden">Form</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white md:mx-4 md:mt-4 md:rounded-lg md:shadow-sm">
        {activeTab === 'team' && <TeamManagement />}
        {activeTab === 'drive' && <GoogleDriveSettings />}
        {activeTab === 'fields' && <ScriptIdeaFieldsManagement />}
        {activeTab === 'formBuilder' && <FormBuilderManagement />}
      </div>

      {/* Bottom Navigation (Mobile) */}
      <BottomNavigation role={UserRole.SUPER_ADMIN} />
    </div>
  );
}

// Team Management Component
function TeamManagement() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.VIDEOGRAPHER);

  // Fetch all active team members (exclude deactivated users with null role)
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .not('role', 'is', null) // Exclude deactivated users (role = null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create user mutation - uses backend API with service role
  const createUserMutation = useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      fullName: string;
      role: UserRole;
    }) => {
      return await adminUserService.createUser(userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member added successfully!');
      setShowAddForm(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole(UserRole.VIDEOGRAPHER);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add team member');
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Role updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role');
    },
  });

  // Delete user mutation - uses backend API with service role
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await adminUserService.deleteUser(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member removed successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove team member');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate({ email, password, fullName, role });
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateUserRoleMutation.mutate({ userId, newRole });
  };

  const handleDelete = (userId: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the team?`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-100 text-red-800';
      case 'CREATOR':
        return 'bg-purple-100 text-purple-800';
      case 'VIDEOGRAPHER':
        return 'bg-blue-100 text-blue-800';
      case 'EDITOR':
        return 'bg-green-100 text-green-800';
      case 'POSTING_MANAGER':
        return 'bg-pink-100 text-pink-800';
      case 'SCRIPT_WRITER':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Team Members</h2>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            Manage user accounts and roles
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
        >
          <UserPlusIcon className="w-5 h-5 mr-2" />
          Add Member
        </button>
      </div>

      {/* Add Team Member Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Team Member</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={UserRole.VIDEOGRAPHER}>Videographer</option>
                  <option value={UserRole.EDITOR}>Editor</option>
                  <option value={UserRole.POSTING_MANAGER}>Posting Manager</option>
                  <option value={UserRole.SCRIPT_WRITER}>Script Writer</option>
                  <option value={UserRole.CREATOR}>Creator</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {createUserMutation.isPending ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Team Members List */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : teamMembers && teamMembers.length > 0 ? (
          <>
            {/* Desktop Table */}
            <table className="hidden md:table min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamMembers.map((member: any) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.full_name || member.email}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <UserCircleIcon className="w-6 h-6 text-primary-600" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {member.full_name || 'No name'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.role === 'SUPER_ADMIN' ? (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(
                            member.role
                          )}`}
                        >
                          {member.role.replace('_', ' ')}
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                          disabled={updateUserRoleMutation.isPending}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                        >
                          <option value={UserRole.VIDEOGRAPHER}>Videographer</option>
                          <option value={UserRole.EDITOR}>Editor</option>
                          <option value={UserRole.POSTING_MANAGER}>Posting Manager</option>
                          <option value={UserRole.SCRIPT_WRITER}>Script Writer</option>
                          <option value={UserRole.CREATOR}>Creator</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {member.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => handleDelete(member.id, member.full_name || member.email)}
                          disabled={deleteUserMutation.isPending}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-gray-200">
              {teamMembers.map((member: any) => (
                <div key={member.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.full_name || member.email}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <UserCircleIcon className="w-6 h-6 text-primary-600" />
                        )}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {member.full_name || 'No name'}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[180px]">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    {member.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={() => handleDelete(member.id, member.full_name || member.email)}
                        disabled={deleteUserMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {member.role === 'SUPER_ADMIN' ? (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(
                          member.role
                        )}`}
                      >
                        {member.role.replace('_', ' ')}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                        disabled={updateUserRoleMutation.isPending}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                      >
                        <option value={UserRole.VIDEOGRAPHER}>Videographer</option>
                        <option value={UserRole.EDITOR}>Editor</option>
                        <option value={UserRole.POSTING_MANAGER}>Posting Manager</option>
                        <option value={UserRole.SCRIPT_WRITER}>Script Writer</option>
                        <option value={UserRole.CREATOR}>Creator</option>
                      </select>
                    )}
                    <span className="text-xs text-gray-500">
                      Joined {new Date(member.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <UserCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No team members yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Google Drive Settings Component
function GoogleDriveSettings() {
  const [driveUrl, setDriveUrl] = useState(localStorage.getItem('default_drive_folder') || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem('google_api_key') || '');
  const [clientId, setClientId] = useState(localStorage.getItem('google_client_id') || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Save Google Drive settings to localStorage
      localStorage.setItem('default_drive_folder', driveUrl);
      localStorage.setItem('google_api_key', apiKey);
      localStorage.setItem('google_client_id', clientId);
      toast.success('Google Drive settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Google Drive Integration</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure the default Google Drive folder for video production workflow
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Set up Google Drive API credentials from Google Cloud Console</li>
          <li>Create a Google Drive folder for your projects</li>
          <li>Set sharing permissions to allow team members to access</li>
          <li>Videographers can upload files directly through the app</li>
          <li>Files are automatically uploaded to your Google Drive folder</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Google API Credentials */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Google API Credentials</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                placeholder="AIzaSy..."
              />
              <p className="mt-2 text-xs text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                placeholder="123456789-abc.apps.googleusercontent.com"
              />
              <p className="mt-2 text-xs text-gray-500">
                OAuth 2.0 Client ID from Google Cloud Console
              </p>
            </div>
          </div>
        </div>

        {/* Google Drive Folder */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Upload Folder</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Drive Folder URL
            </label>
            <input
              type="url"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <p className="mt-2 text-xs text-gray-500">
              Files will be uploaded to this folder by default
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Best Practices:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            <li>Create a main folder with subfolders for each project</li>
            <li>Use clear naming: "ProjectName_RawFootage" and "ProjectName_Edited"</li>
            <li>Ensure all team members have edit access to the folders</li>
            <li>Consider using Google Shared Drives for better organization</li>
            <li>Set up automatic backup for important files</li>
          </ul>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Script Idea Fields Management Component
interface DropdownOption {
  id: string;
  label: string;
}

interface DropdownFieldConfig {
  id: string;
  name: string;
  key: string; // localStorage key
  options: DropdownOption[];
  isActive: boolean;
}

function ScriptIdeaFieldsManagement() {
  // Initialize dropdown configurations from localStorage
  const [dropdownFields, setDropdownFields] = useState<DropdownFieldConfig[]>(() => {
    const saved = localStorage.getItem('script_dropdown_configs');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default configurations matching current database data
    return [
      {
        id: 'target-emotions',
        name: 'Target Emotions',
        key: 'target_emotions',
        isActive: true,
        options: [
          { id: '1', label: 'Curiosity' },
          { id: '2', label: 'Fear' },
          { id: '3', label: 'Loss aversion' },
          { id: '4', label: 'Surprise' },
          { id: '5', label: 'Shock' },
          { id: '6', label: 'Identity recognition' },
          { id: '7', label: 'Relatability' },
          { id: '8', label: 'Frustration validation' },
          { id: '9', label: 'Doubt' },
          { id: '10', label: 'Cognitive dissonance' },
          { id: '11', label: 'Urgency' },
          { id: '12', label: 'FOMO' },
          { id: '13', label: 'Desire' },
          { id: '14', label: 'Aspiration' },
          { id: '15', label: 'Status threat' },
          { id: '16', label: 'Ego challenge' },
          { id: '17', label: 'Anxiety' },
          { id: '18', label: 'Confusion (intentional)' },
          { id: '19', label: 'Validation ("It\'s not just me")' },
          { id: '20', label: 'Intrigue' },
        ],
      },
      {
        id: 'expected-outcomes',
        name: 'Expected Outcomes',
        key: 'expected_outcomes',
        isActive: true,
        options: [
          { id: '1', label: 'Sales' },
          { id: '2', label: 'Qualified leads' },
          { id: '3', label: 'Inbound DMs / WhatsApp inquiries' },
          { id: '4', label: 'Store walk-ins / bookings' },
          { id: '5', label: 'Trust creation' },
          { id: '6', label: 'Brand authority' },
          { id: '7', label: 'Consideration building' },
          { id: '8', label: 'Decision acceleration' },
          { id: '9', label: 'Objection handling' },
          { id: '10', label: 'Shares (DMs)' },
          { id: '11', label: 'Saves' },
          { id: '12', label: 'Rewatches' },
          { id: '13', label: 'Profile visits' },
          { id: '14', label: 'Follower growth' },
          { id: '15', label: 'Brand recall' },
        ],
      },
    ];
  });

  const [selectedDropdownId, setSelectedDropdownId] = useState<string>(dropdownFields[0]?.id || '');
  const [newOptionLabel, setNewOptionLabel] = useState('');

  // Save dropdown configs to localStorage whenever they change
  const saveDropdownConfigs = (updatedConfigs: DropdownFieldConfig[]) => {
    setDropdownFields(updatedConfigs);
    localStorage.setItem('script_dropdown_configs', JSON.stringify(updatedConfigs));
    toast.success('Dropdown options updated successfully!');
  };

  const handleAddOption = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!newOptionLabel.trim()) {
      toast.error('Please enter an option label');
      return;
    }

    const updatedConfigs = dropdownFields.map(config => {
      if (config.id === selectedDropdownId) {
        return {
          ...config,
          options: [
            ...config.options,
            {
              id: Date.now().toString(),
              label: newOptionLabel.trim(),
            },
          ],
        };
      }
      return config;
    });

    saveDropdownConfigs(updatedConfigs);
    setNewOptionLabel('');
  };

  const handleDeleteOption = (dropdownId: string, optionId: string) => {
    const dropdown = dropdownFields.find(d => d.id === dropdownId);
    const option = dropdown?.options.find(o => o.id === optionId);

    if (confirm(`Are you sure you want to delete "${option?.label}"?`)) {
      const updatedConfigs = dropdownFields.map(config => {
        if (config.id === dropdownId) {
          return {
            ...config,
            options: config.options.filter(o => o.id !== optionId),
          };
        }
        return config;
      });
      saveDropdownConfigs(updatedConfigs);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  const selectedDropdown = dropdownFields.find(d => d.id === selectedDropdownId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Dropdown Options Management</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage dropdown options for script submission form (like Notion database properties)
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">📊 How it works:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
          <li>Select a dropdown field to manage its options</li>
          <li>Add new options that script writers can choose from</li>
          <li>Delete options you no longer need</li>
          <li>Changes are saved automatically and applied immediately to the script submission form</li>
        </ul>
      </div>

      {/* Dropdown Selector */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-primary-50 to-purple-50">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Select Dropdown Field to Manage:
        </label>
        <select
          value={selectedDropdownId}
          onChange={(e) => setSelectedDropdownId(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium"
        >
          {dropdownFields.map(dropdown => (
            <option key={dropdown.id} value={dropdown.id}>
              {dropdown.name} ({dropdown.options.length} options)
            </option>
          ))}
        </select>
      </div>

      {/* Add New Option Form */}
      {selectedDropdown && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Add New Option to "{selectedDropdown.name}"
          </h3>
          <form onSubmit={handleAddOption} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Option Label
              </label>
              <input
                type="text"
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                placeholder={selectedDropdown.name === 'Target Emotions' ? 'e.g., Excitement, Joy' : 'e.g., Newsletter signups'}
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Option
            </button>
          </form>
        </div>
      )}

      {/* Current Options List */}
      {selectedDropdown && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-white">
              {selectedDropdown.name} Options ({selectedDropdown.options.length})
            </h3>
          </div>

          {selectedDropdown.options.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No options configured yet</p>
              <p className="text-xs text-gray-400">Add your first option above to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {selectedDropdown.options.map((option, index) => (
                <div
                  key={option.id}
                  className="px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {/* Drag Handle (for future drag-and-drop) */}
                      <div className="text-gray-400">
                        <Bars3Icon className="w-4 h-4" />
                      </div>

                      {/* Option Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {option.label}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700">
                            #{index + 1}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => handleDeleteOption(selectedDropdown.id, option.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete option"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dropdownFields.map(dropdown => (
          <div
            key={dropdown.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedDropdownId(dropdown.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{dropdown.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{dropdown.options.length} options available</p>
              </div>
              <div className="text-2xl font-bold text-primary-600">
                {dropdown.options.length}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Best Practices */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">💡 Best Practices:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>Keep option labels clear and concise</li>
          <li>Avoid duplicate or very similar options</li>
          <li>Order options logically (most common first, alphabetically, etc.)</li>
          <li>Review and clean up unused options regularly</li>
          <li>Test the script submission form after making changes</li>
        </ul>
      </div>

      {/* Save Note */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <p className="text-sm text-green-800">
          <strong>✅ Auto-save enabled:</strong> Changes are saved automatically and will be immediately available in the script submission form.
        </p>
      </div>
    </div>
  );
}

// ============================================
// FORM BUILDER MANAGEMENT COMPONENT
// ============================================

import { formBuilderService } from '@/services/formBuilderService';
import type { ScriptFormFieldConfig, FieldType } from '@/types/formBuilder';
import FieldEditModal from '@/components/FieldEditModal';
import AddFieldModal from '@/components/AddFieldModal';

function FormBuilderManagement() {
  const [fields, setFields] = useState<ScriptFormFieldConfig[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Get editing field
  const editingField = editingFieldId ? fields.find(f => f.id === editingFieldId) : null;

  // Load fields on mount
  useEffect(() => {
    reloadFields();
  }, []);

  // Reload fields
  const reloadFields = async () => {
    try {
      const allFields = await formBuilderService.getAllFields();
      setFields(allFields);
    } catch (error) {
      console.error('Failed to load fields:', error);
      toast.error('Failed to load form fields');
    }
  };

  // Handle field enable/disable
  const handleToggleEnabled = async (id: string) => {
    const field = fields.find(f => f.id === id);
    if (!field) return;

    try {
      await formBuilderService.updateField(id, { enabled: !field.enabled });
      await reloadFields();
      toast.success(`Field "${field.label}" ${!field.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle field:', error);
      toast.error('Failed to update field');
    }
  };

  // Handle field reorder
  const handleMoveUp = async (id: string) => {
    const index = fields.findIndex(f => f.id === id);
    if (index <= 0) return;

    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];

    try {
      await formBuilderService.reorderFields(newFields.map(f => f.id));
      await reloadFields();
      toast.success('Field order updated');
    } catch (error) {
      console.error('Failed to reorder fields:', error);
      toast.error('Failed to update field order');
    }
  };

  const handleMoveDown = async (id: string) => {
    const index = fields.findIndex(f => f.id === id);
    if (index === -1 || index >= fields.length - 1) return;

    const newFields = [...fields];
    [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];

    try {
      await formBuilderService.reorderFields(newFields.map(f => f.id));
      await reloadFields();
      toast.success('Field order updated');
    } catch (error) {
      console.error('Failed to reorder fields:', error);
      toast.error('Failed to update field order');
    }
  };

  // Handle field edit
  const handleEditField = (id: string) => {
    setEditingFieldId(id);
  };

  const handleSaveEdit = async (updates: Partial<ScriptFormFieldConfig>) => {
    if (!editingFieldId) return;

    try {
      await formBuilderService.updateField(editingFieldId, updates);
      await reloadFields();
      setEditingFieldId(null);
      toast.success('Field updated successfully');
    } catch (error) {
      console.error('Failed to update field:', error);
      toast.error('Failed to update field');
    }
  };

  const handleCloseEdit = () => {
    setEditingFieldId(null);
  };

  // Handle add field
  const handleAddField = async (field: ScriptFormFieldConfig) => {
    try {
      // Set order to be last
      field.order = fields.length;
      await formBuilderService.addField(field);
      await reloadFields();
      setIsAddModalOpen(false);
      toast.success(`Field "${field.label}" added successfully`);
    } catch (error: any) {
      console.error('Failed to add field:', error);
      toast.error(error.message || 'Failed to add field');
    }
  };

  // Handle field delete
  const handleDeleteField = async (id: string) => {
    const field = fields.find(f => f.id === id);
    if (!field) return;

    if (confirm(`Are you sure you want to delete the "${field.label}" field?\n\nThis will permanently remove it from the form.`)) {
      try {
        await formBuilderService.deleteField(id);
        await reloadFields();
        toast.success(`Field "${field.label}" deleted`);
      } catch (error) {
        console.error('Failed to delete field:', error);
        toast.error('Failed to delete field');
      }
    }
  };

  // Handle reset to default
  const handleResetToDefault = async () => {
    if (confirm('Are you sure you want to reset the form to default configuration?\n\nThis will delete all your custom fields and restore the original form structure.')) {
      try {
        await formBuilderService.resetToDefault();
        await reloadFields();
        toast.success('Form reset to default configuration');
      } catch (error) {
        console.error('Failed to reset form:', error);
        toast.error('Failed to reset form');
      }
    }
  };

  // Get field type badge color
  const getFieldTypeBadge = (type: FieldType) => {
    const badges: Record<FieldType, string> = {
      'text': 'bg-blue-100 text-blue-800',
      'textarea': 'bg-indigo-100 text-indigo-800',
      'url': 'bg-cyan-100 text-cyan-800',
      'number': 'bg-purple-100 text-purple-800',
      'dropdown': 'bg-green-100 text-green-800',
      'db-dropdown': 'bg-emerald-100 text-emerald-800',
      'multi-select': 'bg-teal-100 text-teal-800',
      'voice': 'bg-pink-100 text-pink-800',
      'textarea-voice': 'bg-rose-100 text-rose-800',
      'divider': 'bg-gray-100 text-gray-800',
    };
    return badges[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Script Form Builder</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure what fields Script Writers see when submitting new ideas (Notion-style)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition inline-flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Field
          </button>
          <button
            onClick={handleResetToDefault}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Reset to Default
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-lg p-4">
        <h3 className="font-medium text-primary-900 mb-2">🎨 How it works:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-primary-800">
          <li><strong>Add custom fields</strong> to collect additional information from Script Writers</li>
          <li>Reorder fields using up/down arrows to change the form layout</li>
          <li>Enable/disable fields to show/hide them from Script Writers</li>
          <li>Edit fields to change labels, placeholders, and validation rules</li>
          <li>All changes apply immediately to the "New Analysis" form</li>
        </ul>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-primary-600">{fields.length}</div>
          <div className="text-sm text-gray-600">Total Fields</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {fields.filter(f => f.enabled).length}
          </div>
          <div className="text-sm text-gray-600">Enabled</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">
            {fields.filter(f => f.required).length}
          </div>
          <div className="text-sm text-gray-600">Required</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-600">
            {fields.filter(f => !f.enabled).length}
          </div>
          <div className="text-sm text-gray-600">Disabled</div>
        </div>
      </div>

      {/* Fields List */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3">
          <h3 className="text-sm font-semibold text-white">Form Fields ({fields.length})</h3>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                !field.enabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Drag Handle + Order */}
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleMoveUp(field.id)}
                      disabled={index === 0}
                      className={`p-0.5 rounded hover:bg-gray-200 transition ${
                        index === 0 ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                      title="Move up"
                    >
                      <ArrowUpIcon className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(field.id)}
                      disabled={index === fields.length - 1}
                      className={`p-0.5 rounded hover:bg-gray-200 transition ${
                        index === fields.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                      title="Move down"
                    >
                      <ArrowDownIcon className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                  <div className="text-gray-400">
                    <Bars3Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-gray-500 w-8">#{index + 1}</span>
                </div>

                {/* Field Info */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{field.label}</span>
                    {field.required && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Required
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getFieldTypeBadge(field.type)}`}>
                      {field.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono">{field.fieldKey}</span>
                    {field.placeholder && (
                      <span className="ml-2">• {field.placeholder}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleEnabled(field.id)}
                    className={`p-2 rounded-lg transition ${
                      field.enabled
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={field.enabled ? 'Disable field' : 'Enable field'}
                  >
                    {field.enabled ? (
                      <EyeIcon className="w-4 h-4" />
                    ) : (
                      <EyeSlashIcon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEditField(field.id)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition"
                    title="Edit field"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteField(field.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete field"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">💡 Pro Tips:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>Group related fields together (e.g., all content fields, then production fields)</li>
          <li>Use dividers to separate sections visually</li>
          <li>Only mark truly essential fields as "Required"</li>
          <li>Test the form as a Script Writer after making changes</li>
          <li>Disable fields temporarily instead of deleting them</li>
        </ul>
      </div>

      {/* Auto-save Note */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <p className="text-sm text-green-800">
          <strong>✅ Auto-save enabled:</strong> All changes are saved automatically and will be immediately reflected in the Script Writer form.
        </p>
      </div>

      {/* Edit Modal */}
      {editingField && (
        <FieldEditModal
          field={editingField}
          onSave={handleSaveEdit}
          onClose={handleCloseEdit}
        />
      )}

      {/* Add Field Modal */}
      {isAddModalOpen && (
        <AddFieldModal
          onAdd={handleAddField}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}
    </div>
  );
}
