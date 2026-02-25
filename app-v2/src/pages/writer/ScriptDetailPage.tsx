import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock,
  CheckCircle,
  XCircle,
  Play,
  ExternalLink,
  MessageSquare,
  User,
} from 'lucide-react';
import { analysesService } from '@/services/analysesService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

export default function ScriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [script, setScript] = useState<ViralAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'feedback'>('details');

  useEffect(() => {
    if (id) {
      loadScript(id);
    }
  }, [id]);

  const loadScript = async (scriptId: string) => {
    try {
      setLoading(true);
      const data = await analysesService.getAnalysis(scriptId);
      setScript(data);
    } catch (error) {
      console.error('Failed to load script:', error);
      toast.error('Failed to load script');
      navigate('/writer/scripts');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'PLANNING':
        return 'Planning';
      case 'SHOOTING':
        return 'Shooting';
      case 'READY_FOR_EDIT':
        return 'Ready for Edit';
      case 'EDITING':
        return 'Editing';
      case 'READY_TO_POST':
        return 'Ready to Post';
      case 'POSTED':
        return 'Posted';
      default:
        return stage || 'N/A';
    }
  };

  const playAudio = (url?: string) => {
    if (url) {
      const audio = new Audio(url);
      audio.play();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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

  const hasFeedback = script.feedback || script.feedback_voice_note_url;

  return (
    <div className="pb-8">
      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-xl p-4 mb-4"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">{script.title || 'Untitled'}</h1>
            {script.content_id && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                {script.content_id}
              </span>
            )}
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(
              script.status
            )}`}
          >
            {script.status === 'PENDING' && <Clock className="w-3 h-3 inline mr-1" />}
            {script.status === 'APPROVED' && <CheckCircle className="w-3 h-3 inline mr-1" />}
            {script.status === 'REJECTED' && <XCircle className="w-3 h-3 inline mr-1" />}
            {script.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {getPlatformIcon(script.platform)} {script.platform?.replace('_', ' ')}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {script.shoot_type === 'outdoor' ? '🌳' : '🏠'} {script.shoot_type || 'Indoor'}
          </span>
        </div>

        {/* Reference URL */}
        <a
          href={script.reference_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-500 text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          View Reference Video
        </a>
      </motion.div>

      {/* Production Stage (if approved) */}
      {script.status === 'APPROVED' && script.production_stage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4"
        >
          <h3 className="text-sm font-medium text-green-800 mb-2">Production Status</h3>
          <div className="flex items-center justify-between">
            <span className="text-green-700">{getStageLabel(script.production_stage)}</span>
            {script.videographer && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <User className="w-3 h-3" />
                {script.videographer.full_name || script.videographer.email}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'details'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors relative ${
            activeTab === 'feedback'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Feedback
          {hasFeedback && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Why Viral */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Why Is It Viral?</h3>
            <p className="text-gray-900 text-sm whitespace-pre-wrap">
              {script.why_viral || 'Not specified'}
            </p>
            {script.why_viral_voice_note_url && (
              <button
                onClick={() => playAudio(script.why_viral_voice_note_url)}
                className="mt-2 flex items-center gap-2 text-blue-500 text-sm"
              >
                <Play className="w-4 h-4" />
                Play Voice Note
              </button>
            )}
          </div>

          {/* Target Emotion */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Target Emotion</h3>
            <p className="text-gray-900 text-sm capitalize">{script.target_emotion || 'Not specified'}</p>
          </div>

          {/* Hook Voice Note */}
          {script.hook_voice_note_url && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Hook Explanation</h3>
              <button
                onClick={() => playAudio(script.hook_voice_note_url)}
                className="flex items-center gap-2 text-blue-500 text-sm"
              >
                <Play className="w-4 h-4" />
                Play Voice Note
              </button>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Submitted</p>
                <p className="text-gray-900 font-medium">{formatDate(script.created_at)}</p>
              </div>
              {script.reviewed_at && (
                <div>
                  <p className="text-gray-500">Reviewed</p>
                  <p className="text-gray-900 font-medium">{formatDate(script.reviewed_at)}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Written Feedback */}
          {script.feedback && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Admin Feedback
              </h3>
              <p className="text-gray-900 text-sm whitespace-pre-wrap">{script.feedback}</p>
            </div>
          )}

          {/* Voice Feedback */}
          {script.feedback_voice_note_url && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Voice Feedback</h3>
              <button
                onClick={() => playAudio(script.feedback_voice_note_url)}
                className="flex items-center gap-2 text-blue-500 text-sm"
              >
                <Play className="w-4 h-4" />
                Play Feedback
              </button>
            </div>
          )}

          {/* Admin Remarks */}
          {script.admin_remarks && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">Admin Remarks</h3>
              <p className="text-yellow-900 text-sm whitespace-pre-wrap">{script.admin_remarks}</p>
            </div>
          )}

          {/* No Feedback */}
          {!hasFeedback &&
            !script.admin_remarks && (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No feedback yet</p>
                {script.status === 'PENDING' && (
                  <p className="text-gray-400 text-sm mt-1">
                    Your script is still being reviewed
                  </p>
                )}
              </div>
            )}
        </motion.div>
      )}

      {/* Action Buttons */}
      {script.status === 'REJECTED' && !script.is_dissolved && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-gray-50 pt-6"
        >
          <button
            onClick={() => navigate(`/writer/edit/${script.id}`)}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium active:bg-blue-600"
          >
            Revise & Resubmit
          </button>
        </motion.div>
      )}
    </div>
  );
}
