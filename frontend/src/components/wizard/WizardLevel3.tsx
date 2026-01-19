/**
 * Wizard Level 3 - Hook Study (Final Details)
 *
 * Fields with text + audio explanations:
 * 1. Did the stop feel: Reflexive/Conscious/Weak pause - explain
 * 2. Did you immediately understand what was happening? - explain
 * 3. What carried the hook most? - explain
 * 4. Turn off audio — does the hook survive? - explain
 * 5. Turn off visuals — does audio alone stop scroll? - explain
 * 6. Dominant emotion in first 6s - explain
 * 7. By second 6, did you understand - explain
 * 8. From 1 to 10 rate this content
 * 9. On-Screen Text Hook
 * 10. Our Idea Audio
 * 11. Shoot Location
 * 12. How to Replicate (text + voice)
 * 13. Additional Requirements
 * 14. Planning Date
 */

import {
  DocumentTextIcon,
  MapPinIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  LightBulbIcon,
  SpeakerWaveIcon,
  EyeIcon,
  EyeSlashIcon,
  HeartIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import VoiceRecorder from '@/components/VoiceRecorder';
import type { AnalysisFormData } from '@/types';

interface WizardLevel3Props {
  formData: AnalysisFormData;
  onChange: (updates: Partial<AnalysisFormData>) => void;
}

const STOP_FEEL_OPTIONS = ['Reflexive (automatic)', 'Conscious (decision)', 'Weak pause'];

export default function WizardLevel3({ formData, onChange }: WizardLevel3Props) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
        <h3 className="text-base font-semibold text-gray-900 flex items-center">
          <LightBulbIcon className="w-4 h-4 mr-2 text-green-600" />
          Hook Study & Deep Analysis
        </h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Analyze the hook mechanics and provide detailed explanations
        </p>
      </div>

      {/* 1. Did the stop feel - Dropdown + Explanation */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Did the stop feel: Reflexive / Conscious / Weak pause?
        </label>
        <select
          value={formData.stopFeel || ''}
          onChange={(e) => onChange({ stopFeel: e.target.value })}
          className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white text-sm"
        >
          <option value="">Select stop type...</option>
          {STOP_FEEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <textarea
          value={formData.stopFeelExplanation || ''}
          onChange={(e) => onChange({ stopFeelExplanation: e.target.value })}
          rows={3}
          placeholder="Explain why you felt this way..."
          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your explanation"
            existingAudioUrl={formData.stopFeelAudioUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ stopFeelAudio: blob });
            }}
            onClear={() => {
              onChange({ stopFeelAudio: null, stopFeelAudioUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 2. Did you immediately understand what was happening? */}
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Did you immediately understand what was happening?
        </label>
        <textarea
          value={formData.immediateUnderstanding || ''}
          onChange={(e) => onChange({ immediateUnderstanding: e.target.value })}
          rows={3}
          placeholder="Explain what you understood and when..."
          className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your explanation"
            existingAudioUrl={formData.immediateUnderstandingAudioUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ immediateUnderstandingAudio: blob });
            }}
            onClear={() => {
              onChange({ immediateUnderstandingAudio: null, immediateUnderstandingAudioUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 3. What carried the hook most? */}
      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <HeartIcon className="w-4 h-4 inline mr-1 text-orange-500" />
          What carried the hook most?
        </label>
        <textarea
          value={formData.hookCarrier || ''}
          onChange={(e) => onChange({ hookCarrier: e.target.value })}
          rows={3}
          placeholder="Was it the visuals, audio, text, emotion, or something else? Explain..."
          className="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your explanation"
            existingAudioUrl={formData.hookCarrierAudioUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ hookCarrierAudio: blob });
            }}
            onClear={() => {
              onChange({ hookCarrierAudio: null, hookCarrierAudioUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 4. Turn off audio — does the hook survive? */}
      <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <SpeakerWaveIcon className="w-4 h-4 inline mr-1 text-pink-500" />
          Turn off audio — does the hook survive?
        </label>
        <textarea
          value={formData.hookWithoutAudio || ''}
          onChange={(e) => onChange({ hookWithoutAudio: e.target.value })}
          rows={3}
          placeholder="Explain if the hook still works without sound and why..."
          className="w-full px-3 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your explanation"
            existingAudioUrl={formData.hookWithoutAudioRecordingUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ hookWithoutAudioRecording: blob });
            }}
            onClear={() => {
              onChange({ hookWithoutAudioRecording: null, hookWithoutAudioRecordingUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 5. Turn off visuals — does audio alone stop scroll? */}
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <EyeSlashIcon className="w-4 h-4 inline mr-1 text-indigo-500" />
          Turn off visuals — does audio alone stop scroll?
        </label>
        <textarea
          value={formData.audioAloneStopsScroll || ''}
          onChange={(e) => onChange({ audioAloneStopsScroll: e.target.value })}
          rows={3}
          placeholder="Explain if audio by itself would make you stop scrolling..."
          className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your explanation"
            existingAudioUrl={formData.audioAloneStopsScrollRecordingUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ audioAloneStopsScrollRecording: blob });
            }}
            onClear={() => {
              onChange({ audioAloneStopsScrollRecording: null, audioAloneStopsScrollRecordingUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 6. Dominant emotion in first 6s */}
      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <HeartIcon className="w-4 h-4 inline mr-1 text-yellow-600" />
          Dominant emotion in first 6 seconds
        </label>
        <textarea
          value={formData.dominantEmotionFirst6 || ''}
          onChange={(e) => onChange({ dominantEmotionFirst6: e.target.value })}
          rows={3}
          placeholder="What was the strongest emotion and why did you feel it?"
          className="w-full px-3 py-2 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your explanation"
            existingAudioUrl={formData.dominantEmotionFirst6AudioUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ dominantEmotionFirst6Audio: blob });
            }}
            onClear={() => {
              onChange({ dominantEmotionFirst6Audio: null, dominantEmotionFirst6AudioUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 7. By second 6, did you understand */}
      <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <EyeIcon className="w-4 h-4 inline mr-1 text-teal-500" />
          By second 6, did you understand?
        </label>
        <textarea
          value={formData.understandingBySecond6 || ''}
          onChange={(e) => onChange({ understandingBySecond6: e.target.value })}
          rows={3}
          placeholder="What did you understand by the 6-second mark? Was it clear or confusing?"
          className="w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your explanation"
            existingAudioUrl={formData.understandingBySecond6AudioUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ understandingBySecond6Audio: blob });
            }}
            onClear={() => {
              onChange({ understandingBySecond6Audio: null, understandingBySecond6AudioUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 8. Rate this content */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <StarIcon className="w-4 h-4 inline mr-1 text-yellow-500" />
          From 1 to 10 rate this content
        </label>
        <input
          type="number"
          min="1"
          max="10"
          value={formData.contentRatingLevel3 || ''}
          onChange={(e) => onChange({ contentRatingLevel3: parseInt(e.target.value) || 0 })}
          placeholder="1-10"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-4"></div>

      {/* Section Header - Production Details */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-100">
        <h3 className="text-base font-semibold text-gray-900 flex items-center">
          <ClipboardDocumentListIcon className="w-4 h-4 mr-2 text-blue-600" />
          Production Planning
        </h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Final production details and replication strategy
        </p>
      </div>

      {/* 9. On-Screen Text Hook */}
      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <DocumentTextIcon className="w-4 h-4 inline mr-1 text-yellow-600" />
          On-Screen Text Hook
        </label>
        <p className="text-xs text-gray-500 mb-2">
          What text should appear on screen in the first few seconds?
        </p>
        <textarea
          value={formData.onScreenTextHook || ''}
          onChange={(e) => onChange({ onScreenTextHook: e.target.value })}
          rows={3}
          placeholder="e.g., 'POV: You just discovered the best hack for...'"
          className="w-full px-3 py-2 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
      </div>

      {/* 10. Our Idea Audio */}
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <SpeakerWaveIcon className="w-4 h-4 inline mr-1 text-indigo-600" />
          Our Idea Audio
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Record your creative idea or concept for this video
        </p>
        <VoiceRecorder
          label=""
          placeholder="Record your creative idea"
          existingAudioUrl={formData.ourIdeaAudioUrl || ''}
          onRecordingComplete={(blob, _url) => {
            onChange({ ourIdeaAudio: blob });
          }}
          onClear={() => {
            onChange({ ourIdeaAudio: null, ourIdeaAudioUrl: '' });
          }}
        />
      </div>

      {/* 11. Shoot Location & 14. Planning Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <MapPinIcon className="w-4 h-4 inline mr-1 text-gray-500" />
            Shoot Location
          </label>
          <input
            type="text"
            value={formData.shootLocation || ''}
            onChange={(e) => onChange({ shootLocation: e.target.value })}
            placeholder="e.g., Office, Studio, Outdoor location..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <CalendarIcon className="w-4 h-4 inline mr-1 text-gray-500" />
            Planning Date
          </label>
          <input
            type="date"
            value={formData.planningDate || ''}
            onChange={(e) => onChange({ planningDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
          />
        </div>
      </div>

      {/* 12. How to Replicate */}
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <ClipboardDocumentListIcon className="w-4 h-4 inline mr-1 text-green-600" />
          How to Replicate for Our Brand
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Provide step-by-step instructions on how to recreate this content
        </p>
        <textarea
          value={formData.howToReplicate || ''}
          onChange={(e) => onChange({ howToReplicate: e.target.value })}
          rows={5}
          placeholder="Step 1: Start with...&#10;Step 2: Then...&#10;Step 3: Finally..."
          className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none bg-white text-sm"
        />
        <div className="mt-2">
          <VoiceRecorder
            label=""
            placeholder="Or record your replication strategy"
            existingAudioUrl={formData.howToReplicateVoiceNoteUrl || ''}
            onRecordingComplete={(blob, _url) => {
              onChange({ howToReplicateVoiceNote: blob });
            }}
            onClear={() => {
              onChange({ howToReplicateVoiceNote: null, howToReplicateVoiceNoteUrl: '' });
            }}
          />
        </div>
      </div>

      {/* 13. Additional Requirements */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <ClipboardDocumentListIcon className="w-4 h-4 inline mr-1 text-gray-500" />
          Additional Requirements
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Any special props, equipment, or requirements for the shoot?
        </p>
        <textarea
          value={formData.additionalRequirements || ''}
          onChange={(e) => onChange({ additionalRequirements: e.target.value })}
          rows={3}
          placeholder="List any special requirements..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none text-sm"
        />
      </div>

      {/* Summary Preview */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Quick Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Reference:</span>{' '}
            <span className="font-medium text-gray-900">
              {formData.referenceUrl ? 'Provided' : 'Not provided'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Hook:</span>{' '}
            <span className="font-medium text-gray-900">
              {formData.hook ? 'Provided' : 'Not provided'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Stop Feel:</span>{' '}
            <span className="font-medium text-gray-900">
              {formData.stopFeel || 'Not selected'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Rating:</span>{' '}
            <span className="font-medium text-gray-900">
              {formData.contentRatingLevel3 || 'Not rated'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Location:</span>{' '}
            <span className="font-medium text-gray-900">
              {formData.shootLocation || 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Planning:</span>{' '}
            <span className="font-medium text-gray-900">
              {formData.planningDate || 'Not set'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
