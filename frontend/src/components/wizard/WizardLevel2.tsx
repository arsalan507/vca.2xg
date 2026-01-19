/**
 * Wizard Level 2 - Advanced Form (9 fields)
 *
 * Fields:
 * 1. In the first 6 seconds, what did your body do? - Multi-select
 * 2. Emotion in first 6 seconds - Dropdown
 * 3. Did this challenge a belief you had? - Dropdown (Yes/No)
 * 4. Emotional identity impact - Multi-select
 * 5. Did it suggest "if he can, why can't you?" - Dropdown (Yes/No)
 * 6. Did you feel like commenting? - Dropdown (Yes/No)
 * 7. Did you read the comments? - Dropdown (Yes/No)
 * 8. Sharing number on platform - Numeric field
 * 9. What action did the video want you to take? - Dropdown
 *
 * Note: Production Details (Industry, Profile, Hook Tags, Character Tags,
 * Total People Involved, Shoot Possibility) are now filled by Admin after approval.
 */

import {
  HeartIcon,
  FaceSmileIcon,
  ChatBubbleLeftRightIcon,
  ShareIcon,
  CursorArrowRaysIcon,
} from '@heroicons/react/24/outline';
import type { AnalysisFormData } from '@/types';

interface WizardLevel2Props {
  formData: AnalysisFormData;
  onChange: (updates: Partial<AnalysisFormData>) => void;
}

// New dropdown/multi-select options
const BODY_REACTIONS = [
  'Breath held',
  'Leaned closer',
  'Eyebrows raised',
  'Smile',
  'Physical tension',
  'No reaction',
];

const EMOTIONS_FIRST_6_SEC = [
  'Shock',
  'Curiosity',
  'Fear',
  'Disbelief',
  'Amusement',
  'Neutral',
];

const YES_NO = ['Yes', 'No'];

const EMOTIONAL_IDENTITY_IMPACT = [
  'Inspired',
  'Inferior',
  'Motivated',
  'Embarrassed',
  'Neutral',
];

const VIDEO_ACTIONS = [
  'None',
  'Follow',
  'Learn more',
  'Buy',
  'Try it',
];

export default function WizardLevel2({ formData, onChange }: WizardLevel2Props) {
  // Helper to toggle multi-select values
  const toggleMultiSelect = (field: keyof AnalysisFormData, value: string) => {
    const currentValues = (formData[field] as string[]) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v: string) => v !== value)
      : [...currentValues, value];
    onChange({ [field]: newValues });
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-100">
        <h3 className="text-base font-semibold text-gray-900 flex items-center">
          <HeartIcon className="w-4 h-4 mr-2 text-purple-600" />
          Advanced Analysis
        </h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Analyze your emotional and physical reactions to the content
        </p>
      </div>

      {/* 1. Body Reactions (Multi-select) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FaceSmileIcon className="w-4 h-4 inline mr-1 text-gray-500" />
          In the first 6 seconds, what did your body do?
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {BODY_REACTIONS.map((reaction) => {
            const isSelected = (formData.bodyReactions || []).includes(reaction);
            return (
              <button
                key={reaction}
                type="button"
                onClick={() => toggleMultiSelect('bodyReactions', reaction)}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-100 border-purple-600 text-purple-800'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {reaction}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Emotion in first 6 seconds */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Emotion in first 6 seconds
        </label>
        <select
          value={formData.emotionFirst6Sec || ''}
          onChange={(e) => onChange({ emotionFirst6Sec: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm"
        >
          <option value="">Select emotion...</option>
          {EMOTIONS_FIRST_6_SEC.map((emotion) => (
            <option key={emotion} value={emotion}>
              {emotion}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Did this challenge a belief? & 4. If he can, why can't you? */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Did this challenge a belief you had?
          </label>
          <select
            value={formData.challengedBelief || ''}
            onChange={(e) => onChange({ challengedBelief: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm"
          >
            <option value="">Select...</option>
            {YES_NO.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Did it suggest "if he can, why can't you?"
          </label>
          <select
            value={formData.ifHeCanWhyCantYou || ''}
            onChange={(e) => onChange({ ifHeCanWhyCantYou: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm"
          >
            <option value="">Select...</option>
            {YES_NO.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Emotional Identity Impact (Multi-select) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Emotional identity impact
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {EMOTIONAL_IDENTITY_IMPACT.map((impact) => {
            const isSelected = (formData.emotionalIdentityImpact || []).includes(impact);
            return (
              <button
                key={impact}
                type="button"
                onClick={() => toggleMultiSelect('emotionalIdentityImpact', impact)}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-pink-100 border-pink-600 text-pink-800'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {impact}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Feel like commenting & 7. Read the comments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <ChatBubbleLeftRightIcon className="w-4 h-4 inline mr-1 text-gray-500" />
            Did you feel like commenting?
          </label>
          <select
            value={formData.feelLikeCommenting || ''}
            onChange={(e) => onChange({ feelLikeCommenting: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm"
          >
            <option value="">Select...</option>
            {YES_NO.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Did you read the comments?
          </label>
          <select
            value={formData.readComments || ''}
            onChange={(e) => onChange({ readComments: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm"
          >
            <option value="">Select...</option>
            {YES_NO.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 8. Sharing number & 9. Video action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <ShareIcon className="w-4 h-4 inline mr-1 text-gray-500" />
            Sharing number on platform
          </label>
          <input
            type="number"
            min="0"
            value={formData.sharingNumber || ''}
            onChange={(e) => onChange({ sharingNumber: parseInt(e.target.value) || 0 })}
            placeholder="Enter number of shares"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <CursorArrowRaysIcon className="w-4 h-4 inline mr-1 text-gray-500" />
            What action did the video want you to take?
          </label>
          <select
            value={formData.videoAction || ''}
            onChange={(e) => onChange({ videoAction: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm"
          >
            <option value="">Select action...</option>
            {VIDEO_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
