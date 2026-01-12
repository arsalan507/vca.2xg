import { useState } from 'react';
import { XMarkIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { ViralAnalysis } from '@/types';
import ReviewScoreInput from '@/components/ReviewScoreInput';

interface RejectScriptModalProps {
  script: ViralAnalysis;
  isOpen: boolean;
  onClose: () => void;
  onReject: (data: {
    status: 'REJECTED';
    feedback: string;
    feedbackVoiceNote?: Blob | null;
    hookStrength: number;
    contentQuality: number;
    viralPotential: number;
    replicationClarity: number;
  }) => void;
  isLoading?: boolean;
}

export default function RejectScriptModal({
  script,
  isOpen,
  onClose,
  onReject,
  isLoading = false,
}: RejectScriptModalProps) {
  const [feedback, setFeedback] = useState('');
  const [scores, setScores] = useState({
    hookStrength: 5,
    contentQuality: 5,
    viralPotential: 5,
    replicationClarity: 5,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) {
      alert('Please provide feedback for rejection');
      return;
    }

    onReject({
      status: 'REJECTED',
      feedback: feedback.trim(),
      ...scores,
    });
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
        <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-5 rounded-t-xl sticky top-0">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <XCircleIcon className="w-7 h-7 text-white mr-3" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Reject Script</h2>
                  <p className="text-red-100 text-sm mt-1">
                    Provide feedback and scores for improvement
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition"
                disabled={isLoading}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Script Info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                {script.content_id && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                    {script.content_id}
                  </span>
                )}
                {script.rejection_count !== undefined && script.rejection_count > 0 && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    script.rejection_count >= 4
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    🚨 Previously rejected {script.rejection_count}x
                    {script.rejection_count >= 4 && (
                      <span className="ml-1 font-bold">⚠️ FINAL CHANCE</span>
                    )}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {script.hook || 'No hook provided'}
              </h3>
              <p className="text-sm text-gray-600">
                By: <span className="font-medium">{script.full_name || script.email}</span>
              </p>
            </div>

            {/* Warning for 5th rejection */}
            {script.rejection_count !== undefined && script.rejection_count >= 4 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <XCircleIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-red-800">
                      FINAL REJECTION - PROJECT WILL BE DISSOLVED
                    </h3>
                    <p className="mt-2 text-sm text-red-700">
                      This script has already been rejected {script.rejection_count} times.
                      Rejecting it again will automatically dissolve this project and mark it as inactive.
                      The creator will not be able to resubmit this script.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Rejection Reason / Feedback <span className="text-red-600">*</span>
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                placeholder="Explain why you're rejecting this script and what needs to be improved..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This feedback will be sent to the creator to help them improve the script.
              </p>
            </div>

            {/* Review Scores */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Review Scores</h3>
              <p className="text-sm text-gray-600 -mt-2">
                Rate each aspect from 1-10 to help the creator understand what needs improvement
              </p>

              <ReviewScoreInput
                label="Hook Strength"
                description="How attention-grabbing is the opening?"
                value={scores.hookStrength}
                onChange={(value) => setScores({ ...scores, hookStrength: value })}
              />

              <ReviewScoreInput
                label="Content Quality"
                description="Overall quality and originality of the idea"
                value={scores.contentQuality}
                onChange={(value) => setScores({ ...scores, contentQuality: value })}
              />

              <ReviewScoreInput
                label="Viral Potential"
                description="Likelihood of going viral and getting engagement"
                value={scores.viralPotential}
                onChange={(value) => setScores({ ...scores, viralPotential: value })}
              />

              <ReviewScoreInput
                label="Replication Clarity"
                description="How clear and actionable is the execution plan?"
                value={scores.replicationClarity}
                onChange={(value) => setScores({ ...scores, replicationClarity: value })}
              />

              {/* Average Score */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Overall Average:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {(
                      (scores.hookStrength +
                        scores.contentQuality +
                        scores.viralPotential +
                        scores.replicationClarity) /
                      4
                    ).toFixed(1)}
                    /10
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !feedback.trim()}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center"
              >
                {isLoading ? (
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
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5 mr-2" />
                    Reject Script
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
