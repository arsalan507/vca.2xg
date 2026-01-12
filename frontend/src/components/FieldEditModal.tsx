/**
 * Field Edit Modal
 *
 * Modal dialog for editing form field properties:
 * - Label, placeholder, help text
 * - Required status
 * - Field type
 * - Container styling (background color)
 * - Validation rules (for number fields)
 */

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ScriptFormFieldConfig } from '@/types/formBuilder';

interface FieldEditModalProps {
  field: ScriptFormFieldConfig;
  onSave: (updates: Partial<ScriptFormFieldConfig>) => void;
  onClose: () => void;
}

export default function FieldEditModal({ field, onSave, onClose }: FieldEditModalProps) {
  const [formData, setFormData] = useState({
    label: field.label,
    placeholder: field.placeholder || '',
    helpText: field.helpText || '',
    required: field.required,
    containerClass: field.containerClass || '',
    rows: field.rows || 3,
    min: field.min,
    max: field.max,
    step: field.step,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required';
    }

    // Number field validations
    if (field.type === 'number') {
      if (formData.min !== undefined && formData.max !== undefined) {
        if (formData.min > formData.max) {
          newErrors.min = 'Min must be less than max';
          newErrors.max = 'Max must be greater than min';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Build updates object
    const updates: Partial<ScriptFormFieldConfig> = {
      label: formData.label.trim(),
      placeholder: formData.placeholder.trim() || undefined,
      helpText: formData.helpText.trim() || undefined,
      required: formData.required,
      containerClass: formData.containerClass.trim() || undefined,
    };

    // Add type-specific properties
    if (field.type === 'textarea' || field.type === 'textarea-voice') {
      updates.rows = formData.rows;
    }

    if (field.type === 'number') {
      updates.min = formData.min;
      updates.max = formData.max;
      updates.step = formData.step;
    }

    onSave(updates);
  };

  // Background color options
  const bgColorOptions = [
    { value: '', label: 'None (White)', class: 'bg-white' },
    { value: 'bg-gray-50', label: 'Gray', class: 'bg-gray-50' },
    { value: 'bg-blue-50', label: 'Blue', class: 'bg-blue-50' },
    { value: 'bg-green-50', label: 'Green', class: 'bg-green-50' },
    { value: 'bg-yellow-50', label: 'Yellow', class: 'bg-yellow-50' },
    { value: 'bg-purple-50', label: 'Purple', class: 'bg-purple-50' },
    { value: 'bg-pink-50', label: 'Pink', class: 'bg-pink-50' },
    { value: 'bg-indigo-50', label: 'Indigo', class: 'bg-indigo-50' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Field</h2>
              <p className="text-sm text-gray-500 mt-1">
                Customize how this field appears to Script Writers
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Field Info (Read-only) */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Field ID:</span>
                  <span className="ml-2 font-mono text-gray-900">{field.id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Field Key:</span>
                  <span className="ml-2 font-mono text-gray-900">{field.fieldKey}</span>
                </div>
                <div>
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-2 font-medium text-blue-600">{field.type}</span>
                </div>
                <div>
                  <span className="text-gray-600">Category:</span>
                  <span className="ml-2 font-medium text-green-600">{field.category}</span>
                </div>
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.label ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter field label"
              />
              {errors.label && <p className="mt-1 text-sm text-red-600">{errors.label}</p>}
              <p className="mt-1 text-xs text-gray-500">
                The label shown above the field
              </p>
            </div>

            {/* Placeholder (if applicable) */}
            {!['divider'].includes(field.type) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placeholder
                </label>
                <input
                  type="text"
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter placeholder text"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The hint text shown inside the input field
                </p>
              </div>
            )}

            {/* Help Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Help Text
              </label>
              <textarea
                rows={2}
                value={formData.helpText}
                onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Enter helpful description or instructions"
              />
              <p className="mt-1 text-xs text-gray-500">
                Additional guidance shown below the field
              </p>
            </div>

            {/* Required Toggle */}
            {!['divider'].includes(field.type) && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="required" className="ml-2 text-sm font-medium text-gray-700">
                  Required Field
                </label>
              </div>
            )}

            {/* Rows (for textarea fields) */}
            {(field.type === 'textarea' || field.type === 'textarea-voice') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Rows
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.rows}
                  onChange={(e) =>
                    setFormData({ ...formData, rows: parseInt(e.target.value) || 3 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Height of the textarea (1-20 rows)
                </p>
              </div>
            )}

            {/* Number Field Options */}
            {field.type === 'number' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Value
                  </label>
                  <input
                    type="number"
                    value={formData.min ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, min: e.target.value ? parseFloat(e.target.value) : undefined })
                    }
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.min ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="No limit"
                  />
                  {errors.min && <p className="mt-1 text-xs text-red-600">{errors.min}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Value
                  </label>
                  <input
                    type="number"
                    value={formData.max ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, max: e.target.value ? parseFloat(e.target.value) : undefined })
                    }
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.max ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="No limit"
                  />
                  {errors.max && <p className="mt-1 text-xs text-red-600">{errors.max}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Step
                  </label>
                  <input
                    type="number"
                    value={formData.step ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, step: e.target.value ? parseFloat(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="1"
                  />
                </div>
              </div>
            )}

            {/* Background Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Color
              </label>
              <div className="grid grid-cols-4 gap-3">
                {bgColorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, containerClass: option.value })}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                      formData.containerClass === option.value
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-full h-8 rounded ${option.class} border border-gray-200`}></div>
                    <span className="mt-2 text-xs font-medium text-gray-700">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Choose a background color to visually group or highlight this field
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
