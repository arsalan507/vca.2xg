/**
 * Disapprove Modal
 *
 * Modal for disapproving an already-approved script and sending it back to pending status
 * Requires a reason for disapproval
 */

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { ViralAnalysis } from '@/types';

interface DisapproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ViralAnalysis | null;
  onDisapprove: (reason: string) => void;
  isSubmitting?: boolean;
}

export default function DisapproveModal({
  isOpen,
  onClose,
  analysis,
  onDisapprove,
  isSubmitting = false,
}: DisapproveModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) {
      return;
    }
    onDisapprove(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  if (!analysis) return null;

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-semibold text-gray-900">
                  Disapprove Script
                </Dialog.Title>
                <p className="mt-1 text-sm text-gray-500">
                  This will send the approved script back to pending status
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 transition"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Script Info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                {analysis.content_id && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                    {analysis.content_id}
                  </span>
                )}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✅ APPROVED
                </span>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {analysis.hook || 'Untitled'}
              </h3>
              <p className="text-sm text-gray-600">
                By: <span className="font-medium">{analysis.full_name || analysis.email}</span>
              </p>
            </div>

            {/* Warning Box */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">What happens when you disapprove:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>Script status changes to PENDING</li>
                    <li>Production stage resets to NOT_STARTED (if in progress)</li>
                    <li>Script writer can revise and resubmit</li>
                    <li>Disapproval counter increments</li>
                    <li>Team assignments remain (optional: can be cleared)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Disapproval Count Display */}
            {analysis.disapproval_count !== undefined && analysis.disapproval_count > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ This script has been disapproved <strong>{analysis.disapproval_count} time(s)</strong> before
                </p>
              </div>
            )}

            {/* Reason Input */}
            <div>
              <label htmlFor="disapproval-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Disapproval <span className="text-red-600">*</span>
              </label>
              <textarea
                id="disapproval-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're disapproving this approved script (e.g., 'Found issue with hook alignment', 'Client requested changes', etc.)"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be visible to the script writer
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition disabled:opacity-50 inline-flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Disapproving...
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                  Disapprove Script
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
