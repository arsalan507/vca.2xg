import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import VoiceRecorder from '@/components/VoiceRecorder';
import { adminService, type ReviewData } from '@/services/adminService';
import { supabase } from '@/lib/api';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

const RATING_OPTIONS = [
  { label: '1-2', value: 2 },
  { label: '3-4', value: 4 },
  { label: '5-6', value: 6 },
  { label: '7-8', value: 8 },
  { label: '9-10', value: 10 },
];

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [script, setScript] = useState<ViralAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review form state
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [hookStrength, setHookStrength] = useState(8);
  const [contentQuality, setContentQuality] = useState(8);
  const [viralPotential, setViralPotential] = useState(8);
  const [replicationClarity, setReplicationClarity] = useState(8);
  const [feedback, setFeedback] = useState('');
  const [feedbackVoiceNote, setFeedbackVoiceNote] = useState<Blob | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; name: string; platform?: string }[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  useEffect(() => {
    if (id) {
      loadScript(id);
    }
    loadProfiles();
  }, [id]);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_list')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setProfiles((data as { id: string; name: string; platform?: string }[]) || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const loadScript = async (scriptId: string) => {
    try {
      setLoading(true);
      const data = await adminService.getAnalysis(scriptId);
      setScript(data);
    } catch (error) {
      console.error('Failed to load script:', error);
      toast.error('Failed to load script');
      navigate('/admin/pending');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (url?: string) => {
    if (url) {
      const audio = new Audio(url);
      audio.play();
    }
  };

  const handleSubmit = async () => {
    if (!decision) {
      toast.error('Please select a decision (approve or reject)');
      return;
    }

    if (decision === 'reject' && !feedback.trim()) {
      toast.error('Please provide feedback for rejection');
      return;
    }

    if (!id) return;

    try {
      setSubmitting(true);

      const reviewData: ReviewData = {
        status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
        hookStrength,
        contentQuality,
        viralPotential,
        replicationClarity,
        feedback: feedback.trim() || undefined,
        feedbackVoiceNote,
        profileId: selectedProfileId || undefined,
      };

      await adminService.reviewAnalysis(id, reviewData);

      toast.success(
        decision === 'approve'
          ? 'Script approved successfully!'
          : 'Script rejected with feedback'
      );
      navigate('/admin/pending');
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Script not found</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Script Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-50 rounded-xl p-4 mb-6"
      >
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          {script.title || 'Untitled'}
        </h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full">
            {getPlatformIcon(script.platform)} {script.platform?.replace('_', ' ')}
          </span>
          <span className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full">
            {script.shoot_type === 'outdoor' ? '🌳' : '🏠'} {script.shoot_type || 'Indoor'}
          </span>
          <span className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full">
            👤 {script.full_name || script.email}
          </span>
        </div>

        {/* Reference */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reference</p>
          <a
            href={script.reference_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-purple-500 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            View Original Video
          </a>
        </div>

        {/* Why Viral */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Why It's Viral</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {script.why_viral || 'Not specified'}
          </p>
        </div>

        {/* How to Replicate */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">How to Replicate</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {script.how_to_replicate || 'Not specified'}
          </p>
        </div>

        {/* Voice Note */}
        {script.hook_voice_note_url && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Voice Explanation</p>
            <button
              onClick={() => playAudio(script.hook_voice_note_url)}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg w-full"
            >
              <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center">
                <Play className="w-4 h-4 ml-0.5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Hook Description</p>
                <p className="text-xs text-gray-500">Tap to play</p>
              </div>
            </button>
          </div>
        )}
      </motion.div>

      <div className="h-px bg-gray-200 my-6" />

      {/* Scoring Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="font-semibold text-gray-900 mb-4">Score This Script</h2>

        <div className="space-y-4">
          <RatingField
            label="Hook Strength"
            value={hookStrength}
            onChange={setHookStrength}
          />
          <RatingField
            label="Content Quality"
            value={contentQuality}
            onChange={setContentQuality}
          />
          <RatingField
            label="Viral Potential"
            value={viralPotential}
            onChange={setViralPotential}
          />
          <RatingField
            label="Replication Clarity"
            value={replicationClarity}
            onChange={setReplicationClarity}
          />
        </div>

        {/* Overall Score */}
        <div className="mt-4 p-4 bg-purple-50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="font-medium text-purple-900">Overall Score</span>
            <span className="text-2xl font-bold text-purple-600">
              {((hookStrength + contentQuality + viralPotential + replicationClarity) / 4).toFixed(1)}
            </span>
          </div>
        </div>
      </motion.section>

      <div className="h-px bg-gray-200 my-6" />

      {/* Decision Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h2 className="font-semibold text-gray-900 mb-4">Your Decision</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setDecision('approve')}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
              decision === 'approve'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <CheckCircle
              className={`w-8 h-8 ${
                decision === 'approve' ? 'text-green-500' : 'text-gray-400'
              }`}
            />
            <span className="font-medium text-gray-900">Approve</span>
            <span className="text-xs text-gray-500">Ready for production</span>
          </button>

          <button
            type="button"
            onClick={() => setDecision('reject')}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
              decision === 'reject'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <XCircle
              className={`w-8 h-8 ${
                decision === 'reject' ? 'text-red-500' : 'text-gray-400'
              }`}
            />
            <span className="font-medium text-gray-900">Reject</span>
            <span className="text-xs text-gray-500">Needs revision</span>
          </button>
        </div>

        {/* Profile selector (shown on approve) */}
        {decision === 'approve' && profiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4"
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to Profile (Optional)
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
            >
              <option value="">Select later</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}{profile.platform ? ` (${profile.platform})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Videographer can also select this later
            </p>
          </motion.div>
        )}

        {/* Feedback (shown on reject) */}
        {decision === 'reject' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback for Writer *
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Explain why this needs revision..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            <VoiceRecorder
              label="Voice Feedback (Optional)"
              hint="Record additional feedback"
              value={feedbackVoiceNote}
              onChange={setFeedbackVoiceNote}
            />
          </motion.div>
        )}
      </motion.section>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handleSubmit}
          disabled={submitting || !decision}
          className="w-full py-3 bg-purple-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 active:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Review'
          )}
        </button>
      </motion.div>
    </div>
  );
}

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex gap-2">
        {RATING_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
              value === option.value
                ? 'border-purple-500 bg-purple-500 text-white'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
