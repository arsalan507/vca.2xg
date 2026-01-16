/**
 * Analysis Side Drawer - Slide-over Detail View
 *
 * A right-side drawer that shows all details from all 3 levels:
 * - Level 1: Basic Info (Reference, Hook, Why Viral)
 * - Level 2: Advanced (Industry, Tags, Shoot Details)
 * - Level 3: Hook Study (Text Hook, Replication)
 *
 * Includes approve/reject functionality at the bottom
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  LinkIcon,
  FireIcon,
  SparklesIcon,
  TagIcon,
  MapPinIcon,
  UsersIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HeartIcon,
  BoltIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
  FaceSmileIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import type { ViralAnalysis, ReviewAnalysisData } from '@/types';

interface AnalysisSideDrawerProps {
  analysis: ViralAnalysis | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (data: ReviewAnalysisData) => void;
  onReject?: (data: ReviewAnalysisData) => void;
  onDisapprove?: (reason: string) => void;
  isSubmitting?: boolean;
}

// Status badge helper
const getStatusStyles = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }
};

// Section component for organization
const Section = ({ title, icon: Icon, children, color = 'gray' }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
}) => {
  const colorClasses = {
    gray: 'from-gray-50 to-gray-100 border-gray-200',
    blue: 'from-blue-50 to-indigo-50 border-blue-200',
    green: 'from-green-50 to-emerald-50 border-green-200',
    purple: 'from-purple-50 to-pink-50 border-purple-200',
    orange: 'from-orange-50 to-amber-50 border-orange-200',
    yellow: 'from-yellow-50 to-amber-50 border-yellow-200',
  };

  const iconColors = {
    gray: 'text-gray-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
  };

  return (
    <div className={`bg-gradient-to-r ${colorClasses[color]} rounded-lg p-4 border`}>
      <h4 className="text-sm font-semibold text-gray-900 flex items-center mb-3">
        <Icon className={`w-4 h-4 mr-2 ${iconColors[color]}`} />
        {title}
      </h4>
      {children}
    </div>
  );
};

// Audio player component
const AudioPlayer = ({ url, label }: { url?: string; label: string }) => {
  if (!url) return null;

  return (
    <div className="mt-2 bg-white rounded-lg p-2 border border-gray-200">
      <div className="flex items-center space-x-2 mb-1">
        <PlayIcon className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <audio controls className="w-full h-8">
        <source src={url} type="audio/webm" />
        <source src={url} type="audio/mpeg" />
      </audio>
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection = ({
  title,
  icon: Icon,
  children,
  color = 'gray',
  defaultOpen = true
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses = {
    gray: 'from-gray-50 to-gray-100 border-gray-200 text-gray-900',
    blue: 'from-blue-50 to-indigo-50 border-blue-200 text-blue-900',
    green: 'from-green-50 to-emerald-50 border-green-200 text-green-900',
    purple: 'from-purple-50 to-pink-50 border-purple-200 text-purple-900',
    orange: 'from-orange-50 to-amber-50 border-orange-200 text-orange-900',
    yellow: 'from-yellow-50 to-amber-50 border-yellow-200 text-yellow-900',
  };

  const iconColors = {
    gray: 'text-gray-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
  };

  return (
    <div className={`bg-gradient-to-r ${colorClasses[color]} rounded-lg border overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition"
      >
        <div className="flex items-center">
          <Icon className={`w-5 h-5 mr-2 ${iconColors[color]}`} />
          <h4 className="text-sm font-bold">{title}</h4>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};

// Question with Audio component for Level 3
const QuestionWithAudio = ({
  question,
  selection,
  explanation,
  audioUrl,
}: {
  question: string;
  selection?: string;
  explanation?: string;
  audioUrl?: string;
}) => {
  if (!selection && !explanation && !audioUrl) return null;

  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <p className="text-xs font-medium text-gray-500 mb-2">{question}</p>
      {selection && (
        <p className="text-sm font-semibold text-gray-900 mb-1">{selection}</p>
      )}
      {explanation && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{explanation}</p>
      )}
      {audioUrl && <AudioPlayer url={audioUrl} label="Voice Explanation" />}
    </div>
  );
};

export default function AnalysisSideDrawer({
  analysis,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onDisapprove,
  isSubmitting = false,
}: AnalysisSideDrawerProps) {
  const [showRejectFeedback, setShowRejectFeedback] = useState(false);
  const [showDisapproveFeedback, setShowDisapproveFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [disapprovalReason, setDisapprovalReason] = useState('');
  const [scores] = useState({
    hookStrength: 7,
    contentQuality: 7,
    viralPotential: 7,
    replicationClarity: 7,
  });

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleApprove = () => {
    if (onApprove) {
      onApprove({
        status: 'APPROVED',
        feedback: feedback || undefined,
        ...scores,
      });
    }
  };

  const handleReject = () => {
    if (!feedback.trim()) {
      return; // Feedback required for rejection
    }
    if (onReject) {
      onReject({
        status: 'REJECTED',
        feedback,
        ...scores,
      });
    }
  };

  const handleDisapprove = () => {
    if (!disapprovalReason.trim()) {
      return; // Reason required for disapproval
    }
    if (onDisapprove) {
      onDisapprove(disapprovalReason.trim());
    }
  };

  const resetState = () => {
    setShowRejectFeedback(false);
    setShowDisapproveFeedback(false);
    setFeedback('');
    setDisapprovalReason('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-40 z-40"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Analysis Details
                  </h2>
                  {analysis && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm font-mono font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        {analysis.content_id || 'N/A'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(analysis.status)}`}>
                        {analysis.status}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            {analysis && (
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Submitter Info */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-semibold">
                      {(analysis.full_name || analysis.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {analysis.full_name || 'Unknown User'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Submitted {new Date(analysis.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* LEVEL 1: Basic Info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Level 1 - Basic Info
                  </h3>

                  {/* Reference URL */}
                  <Section title="Reference Video" icon={LinkIcon} color="gray">
                    {analysis.reference_url ? (
                      <a
                        href={analysis.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 break-all underline"
                      >
                        {analysis.reference_url}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">No reference provided</p>
                    )}
                  </Section>

                  {/* Hook */}
                  <Section title="Hook (First 6 Seconds)" icon={FireIcon} color="orange">
                    {analysis.hook ? (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{analysis.hook}</p>
                    ) : (
                      <p className="text-sm text-gray-400">No text hook provided</p>
                    )}
                    <AudioPlayer url={analysis.hook_voice_note_url} label="Voice Note" />
                  </Section>

                  {/* Why Viral */}
                  <Section title="Why Did It Go Viral?" icon={SparklesIcon} color="blue">
                    {analysis.why_viral ? (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{analysis.why_viral}</p>
                    ) : (
                      <p className="text-sm text-gray-400">No analysis provided</p>
                    )}
                    <AudioPlayer url={analysis.why_viral_voice_note_url} label="Voice Note" />
                  </Section>

                  {/* Target Emotion & Expected Outcome */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="text-xs font-medium text-purple-600 mb-1">Target Emotion</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {analysis.target_emotion || '-'}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-xs font-medium text-blue-600 mb-1">Expected Outcome</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {analysis.expected_outcome || '-'}
                      </p>
                    </div>
                  </div>

                  {/* NEW LEVEL 1 FIELDS - Collapsible */}
                  <CollapsibleSection
                    title="Content Details & Metadata"
                    icon={DocumentTextIcon}
                    color="blue"
                    defaultOpen={true}
                  >
                    {/* Platform, Content Type, Shoot Type */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Platform</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.platform || '-'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Content Type</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.content_type || '-'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Shoot Type</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.shoot_type || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Creator & Characters */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Creator Name</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.creator_name || '-'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Characters Involved</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.characters_involved || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Unusual Element & Works Without Audio */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Unusual Element</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.unusual_element || '-'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Works Without Audio</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.works_without_audio || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Content Rating & Replication Strength */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs font-medium text-yellow-700 mb-1 flex items-center">
                          <StarIcon className="w-3 h-3 mr-1" />
                          Content Rating
                        </p>
                        <p className="text-2xl font-bold text-yellow-900">
                          {analysis.content_rating ? `${analysis.content_rating}/10` : '-'}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                        <p className="text-xs font-medium text-green-700 mb-1 flex items-center">
                          <BoltIcon className="w-3 h-3 mr-1" />
                          Replication Strength
                        </p>
                        <p className="text-2xl font-bold text-green-900">
                          {analysis.replication_strength ? `${analysis.replication_strength}/10` : '-'}
                        </p>
                      </div>
                    </div>
                  </CollapsibleSection>
                </div>

                {/* LEVEL 2: Advanced Details */}
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Level 2 - Advanced Details
                  </h3>

                  {/* Industry & Profile */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1">Industry</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {analysis.industry?.name || '-'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1">Profile</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {analysis.profile?.name || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Hook Tags */}
                  {analysis.hook_tags && analysis.hook_tags.length > 0 && (
                    <Section title="Hook Tags" icon={TagIcon} color="orange">
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.hook_tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Character Tags */}
                  {analysis.character_tags && analysis.character_tags.length > 0 && (
                    <Section title="Character Tags" icon={UsersIcon} color="purple">
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.character_tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Shoot Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <p className="text-xs font-medium text-green-600 mb-1">Shoot Possibility</p>
                      <p className="text-lg font-bold text-green-800">
                        {analysis.shoot_possibility ? `${analysis.shoot_possibility}%` : '-'}
                      </p>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                      <p className="text-xs font-medium text-teal-600 mb-1">People Involved</p>
                      <p className="text-lg font-bold text-teal-800">
                        {analysis.total_people_involved || '-'}
                      </p>
                    </div>
                  </div>

                  {/* NEW LEVEL 2 FIELDS - Emotional & Physical Reactions */}
                  <CollapsibleSection
                    title="Emotional & Physical Reactions"
                    icon={HeartIcon}
                    color="purple"
                    defaultOpen={true}
                  >
                    {/* Body Reactions (array) */}
                    {analysis.body_reactions && analysis.body_reactions.length > 0 && (
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-2">Body Reactions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.body_reactions.map((reaction, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200"
                            >
                              {reaction}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Emotion First 6 Seconds */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1 flex items-center">
                          <FaceSmileIcon className="w-3 h-3 mr-1" />
                          Emotion in First 6 Sec
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.emotion_first_6_sec || '-'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Challenged Belief</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.challenged_belief || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Emotional Identity Impact (array) */}
                    {analysis.emotional_identity_impact && analysis.emotional_identity_impact.length > 0 && (
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-2">Emotional Identity Impact</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.emotional_identity_impact.map((impact, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                            >
                              {impact}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* If He Can Why Can't You & Feel Like Commenting */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">If He Can, Why Can't You?</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.if_he_can_why_cant_you || '-'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1 flex items-center">
                          <ChatBubbleLeftIcon className="w-3 h-3 mr-1" />
                          Feel Like Commenting
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.feel_like_commenting || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Read Comments & Video Action */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1 flex items-center">
                          <EyeIcon className="w-3 h-3 mr-1" />
                          Read Comments
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.read_comments || '-'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Video Action</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysis.video_action || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Sharing Number */}
                    {analysis.sharing_number !== undefined && analysis.sharing_number !== null && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                        <p className="text-xs font-medium text-blue-700 mb-1 flex items-center">
                          <ShareIcon className="w-3 h-3 mr-1" />
                          Sharing Number (How many people would share this?)
                        </p>
                        <p className="text-2xl font-bold text-blue-900">
                          {analysis.sharing_number}
                        </p>
                      </div>
                    )}
                  </CollapsibleSection>
                </div>

                {/* LEVEL 3: Hook Study */}
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Level 3 - Hook Study
                  </h3>

                  {/* On-Screen Text Hook */}
                  {analysis.on_screen_text_hook && (
                    <Section title="On-Screen Text Hook" icon={DocumentTextIcon} color="yellow">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {analysis.on_screen_text_hook}
                      </p>
                    </Section>
                  )}

                  {/* Our Idea Audio */}
                  {analysis.our_idea_audio_url && (
                    <Section title="Our Idea Audio" icon={SparklesIcon} color="purple">
                      <AudioPlayer url={analysis.our_idea_audio_url} label="Creative Idea" />
                    </Section>
                  )}

                  {/* NEW LEVEL 3 FIELDS - Hook Study Analysis (7 Questions) */}
                  <CollapsibleSection
                    title="Hook Study Analysis (7 Deep Questions)"
                    icon={FireIcon}
                    color="orange"
                    defaultOpen={true}
                  >
                    {/* Question 1: Stop Feel */}
                    <QuestionWithAudio
                      question="1. Did the stop feel: Reflexive (automatic) / Conscious (deliberate) / Weak pause?"
                      selection={analysis.stop_feel}
                      explanation={analysis.stop_feel_explanation}
                      audioUrl={analysis.stop_feel_audio_url}
                    />

                    {/* Question 2: Immediate Understanding */}
                    <QuestionWithAudio
                      question="2. Did you immediately understand what was going on?"
                      selection={analysis.immediate_understanding}
                      audioUrl={analysis.immediate_understanding_audio_url}
                    />

                    {/* Question 3: Hook Carrier */}
                    <QuestionWithAudio
                      question="3. What was the hook carrier? (Audio / Visual / Text / Combination)"
                      selection={analysis.hook_carrier}
                      audioUrl={analysis.hook_carrier_audio_url}
                    />

                    {/* Question 4: Hook Without Audio */}
                    <QuestionWithAudio
                      question="4. Would the hook work without audio?"
                      selection={analysis.hook_without_audio}
                      audioUrl={analysis.hook_without_audio_recording_url}
                    />

                    {/* Question 5: Audio Alone Stops Scroll */}
                    <QuestionWithAudio
                      question="5. Would the audio alone stop the scroll?"
                      selection={analysis.audio_alone_stops_scroll}
                      audioUrl={analysis.audio_alone_stops_scroll_recording_url}
                    />

                    {/* Question 6: Dominant Emotion First 6 */}
                    <QuestionWithAudio
                      question="6. What was the dominant emotion in the first 6 seconds?"
                      selection={analysis.dominant_emotion_first_6}
                      audioUrl={analysis.dominant_emotion_first_6_audio_url}
                    />

                    {/* Question 7: Understanding By Second 6 */}
                    <QuestionWithAudio
                      question="7. By the 6th second, did you understand what the content was about?"
                      selection={analysis.understanding_by_second_6}
                      audioUrl={analysis.understanding_by_second_6_audio_url}
                    />

                    {/* Content Rating Level 3 */}
                    {analysis.content_rating_level_3 && (
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-3 border border-orange-200">
                        <p className="text-xs font-medium text-orange-700 mb-1 flex items-center">
                          <StarIcon className="w-3 h-3 mr-1" />
                          Final Content Rating (After Hook Study)
                        </p>
                        <p className="text-2xl font-bold text-orange-900">
                          {analysis.content_rating_level_3}/10
                        </p>
                      </div>
                    )}
                  </CollapsibleSection>

                  {/* How to Replicate */}
                  <Section title="How to Replicate" icon={ChartBarIcon} color="green">
                    {analysis.how_to_replicate ? (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {analysis.how_to_replicate}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No replication strategy provided</p>
                    )}
                    <AudioPlayer url={analysis.how_to_replicate_voice_note_url} label="Voice Note" />
                  </Section>

                  {/* Shoot Location & Planning Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1 flex items-center">
                        <MapPinIcon className="w-3 h-3 mr-1" />
                        Shoot Location
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {analysis.shoot_location || '-'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1 flex items-center">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        Planning Date
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {analysis.planning_date
                          ? new Date(analysis.planning_date).toLocaleDateString()
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Additional Requirements */}
                  {analysis.additional_requirements && (
                    <Section title="Additional Requirements" icon={DocumentTextIcon} color="gray">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {analysis.additional_requirements}
                      </p>
                    </Section>
                  )}
                </div>

                {/* Review Scores (if already reviewed) */}
                {analysis.overall_score && (
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                      <StarIcon className="w-3 h-3 mr-1 text-yellow-500" />
                      Review Scores
                    </h3>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label: 'Hook', value: analysis.hook_strength },
                        { label: 'Quality', value: analysis.content_quality },
                        { label: 'Viral', value: analysis.viral_potential },
                        { label: 'Clarity', value: analysis.replication_clarity },
                        { label: 'Overall', value: analysis.overall_score, highlight: true },
                      ].map((score) => (
                        <div
                          key={score.label}
                          className={`text-center p-2 rounded-lg ${
                            score.highlight
                              ? 'bg-primary-100 border-2 border-primary-300'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <p className="text-lg font-bold text-gray-900">{score.value}</p>
                          <p className="text-xs text-gray-500">{score.label}</p>
                        </div>
                      ))}
                    </div>
                    {analysis.feedback && (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Feedback</p>
                        <p className="text-sm text-gray-800">{analysis.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Footer with Actions - PENDING Scripts */}
            {analysis && analysis.status === 'PENDING' && (onApprove || onReject) && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
                {!showRejectFeedback ? (
                  <div className="flex space-x-3">
                    {onReject && (
                      <button
                        onClick={() => setShowRejectFeedback(true)}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2.5 border border-red-300 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 font-medium transition"
                      >
                        <XCircleIcon className="w-5 h-5 mr-2" />
                        Reject
                      </button>
                    )}
                    {onApprove && (
                      <button
                        onClick={handleApprove}
                        disabled={isSubmitting}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                        ) : (
                          <CheckCircleIcon className="w-5 h-5 mr-2" />
                        )}
                        Approve
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Provide feedback for rejection (required)..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    />
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setShowRejectFeedback(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={isSubmitting || !feedback.trim()}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 mr-2" />
                        )}
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer with Actions - APPROVED Scripts (Disapprove) */}
            {analysis && analysis.status === 'APPROVED' && onDisapprove && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
                {!showDisapproveFeedback ? (
                  <div className="space-y-3">
                    {/* Info message */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        ℹ️ This script is already approved. You can disapprove it to send it back for revision.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDisapproveFeedback(true)}
                      className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-orange-300 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 font-medium transition"
                    >
                      <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                      Disapprove Script
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-800 font-medium mb-1">
                        ⚠️ Disapproving will:
                      </p>
                      <ul className="text-xs text-orange-700 list-disc list-inside space-y-0.5 ml-1">
                        <li>Change status to PENDING</li>
                        <li>Reset production stage to NOT_STARTED</li>
                        <li>Allow script writer to revise</li>
                      </ul>
                    </div>
                    <textarea
                      value={disapprovalReason}
                      onChange={(e) => setDisapprovalReason(e.target.value)}
                      placeholder="Explain why you're disapproving this approved script (required)..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    />
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setShowDisapproveFeedback(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDisapprove}
                        disabled={isSubmitting || !disapprovalReason.trim()}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                        ) : (
                          <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                        )}
                        Confirm Disapprove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
