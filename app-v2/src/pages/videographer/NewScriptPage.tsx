import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Check, Loader2, X, PlusCircle } from 'lucide-react';
import { analysesService } from '@/services/analysesService';
import { videographerService } from '@/services/videographerService';
import { useAuth } from '@/hooks/useAuth';
import type { AnalysisFormData } from '@/types';
import toast from 'react-hot-toast';

const SHOOT_TYPES = ['Indoor', 'Outdoor', 'Both'];

const YES_NO_MAYBE = ['Yes', 'No', 'Maybe'];

const INITIAL_FORM_DATA: AnalysisFormData = {
  referenceUrl: '',
  title: '',
  shootType: '',
  creatorName: '',
  worksWithoutAudio: '',
};

export default function VideographerNewScriptPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState<AnalysisFormData>(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [isTrustedWriter, setIsTrustedWriter] = useState(false);

  // Post-submit workflow
  const [createdScriptId, setCreatedScriptId] = useState<string | null>(null);
  const [showShootQuestion, setShowShootQuestion] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; name: string; code: string | null; platform?: string }[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pickingProject, setPickingProject] = useState(false);

  // Inline profile creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileCode, setNewProfileCode] = useState('');
  const [newProfilePlatform, setNewProfilePlatform] = useState('INSTAGRAM');
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Check if user has auto-approve permission
  useEffect(() => {
    const checkTrustedStatus = async () => {
      if (!user) return;
      try {
        const { supabase } = await import('@/lib/api');
        const { data } = await supabase
          .from('profiles')
          .select('is_trusted_writer')
          .eq('id', user.id)
          .single();
        setIsTrustedWriter((data as any)?.is_trusted_writer || false);
      } catch (error) {
        console.error('Failed to check trusted status:', error);
      }
    };
    checkTrustedStatus();
  }, [user]);

  const updateField = <K extends keyof AnalysisFormData>(
    field: K,
    value: AnalysisFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const created = await analysesService.createAnalysis(formData);

      if (isTrustedWriter) {
        // Auto-approved! Show "Want to shoot this?" modal
        toast.success('Script auto-approved! ✓');
        setCreatedScriptId(created.id);
        setShowShootQuestion(true);
      } else {
        // Needs manual approval
        toast.success('Script submitted! Waiting for admin approval.');
        navigate('/videographer/my-scripts');
      }
    } catch (error) {
      console.error('Failed to submit script:', error);
      toast.error('Failed to submit script');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWantToShoot = async () => {
    setShowShootQuestion(false);
    setShowProfileModal(true);
    setProfilesLoading(true);
    try {
      const data = await videographerService.getProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleSkipShooting = () => {
    setShowShootQuestion(false);
    navigate('/videographer/my-projects');
  };

  const handlePickWithProfile = async () => {
    if (!selectedProfileId || !createdScriptId) return;

    try {
      setPickingProject(true);
      await videographerService.pickProject({
        analysisId: createdScriptId,
        profileId: selectedProfileId,
      });
      toast.success('Project picked! Ready to upload.');
      setShowProfileModal(false);
      navigate(`/videographer/upload/${createdScriptId}`);
    } catch (error: any) {
      console.error('Failed to pick project:', error);

      // If script not approved yet, show helpful message
      if (error.message?.includes('not available') || error.message?.includes('approved')) {
        toast.error('Script needs admin approval first. Check My Scripts later!');
        setShowProfileModal(false);
        navigate('/videographer/my-scripts');
      } else {
        toast.error(error.message || 'Failed to pick project');
        setPickingProject(false);
      }
    } finally {
      if (pickingProject) setPickingProject(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim() || !newProfileCode.trim()) {
      toast.error('Name and Code are required');
      return;
    }

    if (newProfileCode.length < 2 || newProfileCode.length > 4) {
      toast.error('Code must be 2-4 characters');
      return;
    }

    try {
      setCreatingProfile(true);
      const created = await videographerService.createProfile(
        newProfileName.trim(),
        newProfileCode.trim(),
        newProfilePlatform
      );
      toast.success(`Profile "${created.name}" created!`);

      const updatedProfiles = await videographerService.getProfiles();
      setProfiles(updatedProfiles);
      setSelectedProfileId(created.id);

      setNewProfileName('');
      setNewProfileCode('');
      setNewProfilePlatform('INSTAGRAM');
      setShowCreateForm(false);
    } catch (error: any) {
      console.error('Failed to create profile:', error);
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setCreatingProfile(false);
    }
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={() => navigate('/videographer')}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900">Submit Script</h1>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 px-4"
      >
        {/* Reference URL */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Reference Link
          </label>
          <input
            type="url"
            value={formData.referenceUrl}
            onChange={(e) => updateField('referenceUrl', e.target.value)}
            placeholder="Paste video link..."
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-videographer focus:border-videographer"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Give this content a title"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-videographer focus:border-videographer"
          />
        </div>

        {/* Shoot Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
            Shoot Type
          </label>
          <div className="flex gap-2">
            {SHOOT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => updateField('shootType', type)}
                className={`px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95 ${
                  formData.shootType === type
                    ? 'bg-videographer text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {type === 'Indoor' ? '🏠' : type === 'Outdoor' ? '🌳' : '🏠🌳'} {type}
              </button>
            ))}
          </div>
        </div>

        {/* Creator Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Creator Name
          </label>
          <input
            type="text"
            value={formData.creatorName}
            onChange={(e) => updateField('creatorName', e.target.value)}
            placeholder="@username or channel name"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-videographer focus:border-videographer"
          />
        </div>

        {/* Works Without Audio */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
            Works Without Audio?
          </label>
          <div className="flex gap-2">
            {YES_NO_MAYBE.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('worksWithoutAudio', option)}
                className={`px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95 ${
                  formData.worksWithoutAudio === option
                    ? 'bg-videographer text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Notes for Team */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Notes for Team
          </label>
          <p className="text-[11px] text-gray-500 mb-1.5">
            Instructions for the editor & team
          </p>
          <textarea
            value={formData.productionNotes || ''}
            onChange={(e) => updateField('productionNotes', e.target.value)}
            placeholder="E.g. shoot close-up first, use warm lighting, add subtitles..."
            rows={3}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-videographer focus:border-videographer resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-videographer text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:bg-orange-600 disabled:opacity-50 mt-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Submit Script
            </>
          )}
        </button>
      </motion.div>

      {/* Want to Shoot This? Modal */}
      {showShootQuestion && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center px-4" onClick={() => setShowShootQuestion(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-sm w-full"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">🎬 Want to shoot this?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Your script has been submitted! Do you want to pick this project and start shooting now?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSkipShooting}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold active:bg-gray-200"
              >
                Not Now
              </button>
              <button
                onClick={handleWantToShoot}
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-semibold active:bg-orange-600"
              >
                Yes, Let's Go!
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Profile Selection Modal */}
      {showProfileModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-end sm:items-center justify-center" onClick={() => setShowProfileModal(false)}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Profile</h3>
                <p className="text-sm text-gray-500">Which account will you post to?</p>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {profilesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              ) : profiles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No profiles available</p>
                </div>
              ) : (
                profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileId(selectedProfileId === profile.id ? null : profile.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                      selectedProfileId === profile.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-100 bg-white active:bg-gray-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                      selectedProfileId === profile.id ? 'bg-orange-500 text-white' : 'bg-gray-100'
                    }`}>
                      {selectedProfileId === profile.id ? <Check className="w-5 h-5" /> : profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${selectedProfileId === profile.id ? 'text-orange-700' : 'text-gray-800'}`}>
                          {profile.name}
                        </span>
                        {profile.code && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded font-mono">
                            {profile.code}
                          </span>
                        )}
                      </div>
                      {profile.platform && <span className="text-xs text-gray-400">{profile.platform}</span>}
                    </div>
                  </button>
                ))
              )}

              {!showCreateForm && !profilesLoading && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span className="font-medium text-sm">Create New Profile</span>
                </button>
              )}

              {showCreateForm && (
                <div className="p-4 border-2 border-orange-200 rounded-xl bg-orange-50 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-900">New Profile</h4>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewProfileName('');
                        setNewProfileCode('');
                        setNewProfilePlatform('INSTAGRAM');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Profile Name</label>
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="e.g., BCH Main, Next.blr"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Code (2-4 letters)</label>
                    <input
                      type="text"
                      value={newProfileCode}
                      onChange={(e) => setNewProfileCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="e.g., BCH, NEXT, 2nd"
                      maxLength={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                    <select
                      value={newProfilePlatform}
                      onChange={(e) => setNewProfilePlatform(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="INSTAGRAM">Instagram</option>
                      <option value="YOUTUBE">YouTube</option>
                      <option value="TIKTOK">TikTok</option>
                      <option value="FACEBOOK">Facebook</option>
                    </select>
                  </div>

                  <button
                    onClick={handleCreateProfile}
                    disabled={creatingProfile || !newProfileName.trim() || !newProfileCode.trim()}
                    className="w-full h-10 flex items-center justify-center gap-2 bg-orange-500 rounded-lg text-white text-sm font-semibold active:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {creatingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        Create Profile
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={handlePickWithProfile}
                disabled={!selectedProfileId || pickingProject}
                className="w-full h-12 flex items-center justify-center gap-2 bg-green-500 rounded-xl text-white font-semibold active:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pickingProject ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Picking...
                  </>
                ) : (
                  'Pick & Start Shooting'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
