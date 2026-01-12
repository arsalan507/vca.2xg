import { XMarkIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { ViralAnalysis } from '@/types';

interface ScriptViewModalProps {
  script: ViralAnalysis;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function ScriptViewModal({ script, isOpen, onClose, onApprove, onReject }: ScriptViewModalProps) {
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Script Details</h2>
              <p className="text-sm text-gray-500 mt-1">
                {script.content_id || 'No ID'} • Submitted {new Date(script.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Reference Video */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📹 Reference Video
              </label>
              <a
                href={script.reference_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 underline break-all"
              >
                {script.reference_url}
              </a>
            </div>

            {/* Hook */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🎣 Hook (First 6 Seconds)
              </label>
              {script.hook && (
                <p className="text-gray-900 whitespace-pre-wrap mb-3">{script.hook}</p>
              )}
              {script.hook_voice_note_url && (
                <div className="mt-3">
                  <audio controls className="w-full">
                    <source src={script.hook_voice_note_url} type="audio/webm" />
                  </audio>
                </div>
              )}
            </div>

            {/* Why Viral */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔥 Why Did It Go Viral?
              </label>
              {script.why_viral && (
                <p className="text-gray-900 whitespace-pre-wrap mb-3">{script.why_viral}</p>
              )}
              {script.why_viral_voice_note_url && (
                <div className="mt-3">
                  <audio controls className="w-full">
                    <source src={script.why_viral_voice_note_url} type="audio/webm" />
                  </audio>
                </div>
              )}
            </div>

            {/* How to Replicate */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🎬 How to Replicate
              </label>
              {script.how_to_replicate && (
                <p className="text-gray-900 whitespace-pre-wrap mb-3">{script.how_to_replicate}</p>
              )}
              {script.how_to_replicate_voice_note_url && (
                <div className="mt-3">
                  <audio controls className="w-full">
                    <source src={script.how_to_replicate_voice_note_url} type="audio/webm" />
                  </audio>
                </div>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Target Emotion</label>
                <p className="text-sm font-medium text-gray-900">{script.target_emotion}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Expected Outcome</label>
                <p className="text-sm font-medium text-gray-900">{script.expected_outcome}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Submitted By</label>
                <p className="text-sm font-medium text-gray-900">{script.full_name || script.email}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  script.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                  script.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {script.status}
                </span>
              </div>
              {script.total_people_involved && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">People Involved</label>
                  <p className="text-sm font-medium text-gray-900">{script.total_people_involved}</p>
                </div>
              )}
              {script.planning_date && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Planning Date</label>
                  <p className="text-sm font-medium text-gray-900">{new Date(script.planning_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {/* Additional Requirements */}
            {script.additional_requirements && (
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Additional Requirements
                </label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                  {script.additional_requirements}
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {(onApprove || onReject) && script.status === 'PENDING' && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
              {onReject && (
                <button
                  onClick={() => {
                    onReject();
                    onClose();
                  }}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center"
                >
                  <XCircleIcon className="w-5 h-5 mr-2" />
                  Reject
                </button>
              )}
              {onApprove && (
                <button
                  onClick={() => {
                    onApprove();
                    onClose();
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center"
                >
                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                  Approve
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
