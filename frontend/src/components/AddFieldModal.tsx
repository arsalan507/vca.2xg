/**
 * Add Field Modal
 *
 * Modal dialog for creating new custom fields in the form builder.
 * Allows admins to configure all field properties from scratch.
 */

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ScriptFormFieldConfig, FieldType, DataSource } from '@/types/formBuilder';

interface AddFieldModalProps {
  onAdd: (field: ScriptFormFieldConfig) => void;
  onClose: () => void;
}

export default function AddFieldModal({ onAdd, onClose }: AddFieldModalProps) {
  const [formData, setFormData] = useState({
    id: '',
    fieldKey: '',
    label: '',
    placeholder: '',
    helpText: '',
    type: 'text' as FieldType,
    required: false,
    enabled: true,
    containerClass: '',
    category: 'basic' as 'basic' | 'content' | 'production',
    rows: 3,
    min: undefined as number | undefined,
    max: undefined as number | undefined,
    step: undefined as number | undefined,
    dataSourceType: 'none' as 'none' | 'localStorage' | 'database' | 'hardcoded',
    dataSourceKey: '',
    dataSourceTable: 'industries' as 'industries' | 'profile_list' | 'hook_tags' | 'character_tags',
    hardcodedOptions: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generate field key from label
  const generateFieldKey = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  // Generate field ID from label
  const generateFieldId = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Auto-generate ID and key when label changes
  const handleLabelChange = (label: string) => {
    setFormData({
      ...formData,
      label,
      id: generateFieldId(label),
      fieldKey: generateFieldKey(label),
    });
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required';
    }

    if (!formData.id.trim()) {
      newErrors.id = 'Field ID is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.id)) {
      newErrors.id = 'Field ID must contain only lowercase letters, numbers, and hyphens';
    }

    if (!formData.fieldKey.trim()) {
      newErrors.fieldKey = 'Field key is required';
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.fieldKey)) {
      newErrors.fieldKey = 'Field key must be a valid variable name';
    }

    // Data source validation
    if (['dropdown', 'db-dropdown', 'multi-select'].includes(formData.type)) {
      if (formData.dataSourceType === 'none') {
        newErrors.dataSourceType = 'Data source is required for this field type';
      } else if (formData.dataSourceType === 'localStorage' && !formData.dataSourceKey.trim()) {
        newErrors.dataSourceKey = 'Data source key is required';
      } else if (formData.dataSourceType === 'hardcoded' && !formData.hardcodedOptions.trim()) {
        newErrors.hardcodedOptions = 'Options are required';
      }
    }

    // Number field validations
    if (formData.type === 'number') {
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

    // Build data source
    let dataSource: DataSource | undefined;
    if (['dropdown', 'db-dropdown', 'multi-select'].includes(formData.type)) {
      if (formData.dataSourceType === 'localStorage') {
        dataSource = { type: 'localStorage', key: formData.dataSourceKey };
      } else if (formData.dataSourceType === 'database') {
        dataSource = { type: 'database', table: formData.dataSourceTable };
      } else if (formData.dataSourceType === 'hardcoded') {
        // Parse hardcoded options (one per line, format: "value | label")
        const lines = formData.hardcodedOptions.split('\n').filter(l => l.trim());
        const options = lines.map((line) => {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length === 2) {
            return { value: parts[0], label: parts[1] };
          }
          return { value: line.trim(), label: line.trim() };
        });
        dataSource = { type: 'hardcoded', options };
      }
    }

    // Build field config
    const field: ScriptFormFieldConfig = {
      id: formData.id,
      fieldKey: formData.fieldKey,
      label: formData.label.trim(),
      placeholder: formData.placeholder.trim() || undefined,
      helpText: formData.helpText.trim() || undefined,
      type: formData.type,
      required: formData.required,
      enabled: formData.enabled,
      order: 999, // Will be set properly by the service
      category: formData.category,
      containerClass: formData.containerClass.trim() || undefined,
      dataSource,
    };

    // Add type-specific properties
    if (formData.type === 'textarea' || formData.type === 'textarea-voice') {
      field.rows = formData.rows;
    }

    if (formData.type === 'number') {
      field.min = formData.min;
      field.max = formData.max;
      field.step = formData.step;
    }

    onAdd(field);
  };

  // Field type options
  const fieldTypes: { value: FieldType; label: string; description: string }[] = [
    { value: 'text', label: 'Text', description: 'Single-line text input' },
    { value: 'textarea', label: 'Textarea', description: 'Multi-line text input' },
    { value: 'url', label: 'URL', description: 'URL input with validation' },
    { value: 'number', label: 'Number', description: 'Numeric input with min/max' },
    { value: 'dropdown', label: 'Dropdown (localStorage)', description: 'Single-select from localStorage' },
    { value: 'db-dropdown', label: 'Dropdown (Database)', description: 'Single-select from database' },
    { value: 'multi-select', label: 'Multi-Select Tags', description: 'Multiple selections from database' },
    { value: 'voice', label: 'Voice Recorder', description: 'Voice recording only' },
    { value: 'textarea-voice', label: 'Text + Voice', description: 'Text input with voice recorder' },
    { value: 'divider', label: 'Divider', description: 'Section separator' },
  ];

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
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add Custom Field</h2>
              <p className="text-sm text-gray-500 mt-1">
                Create a new field for the Script Writer form
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
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-1">💡 Quick Tip:</h3>
              <p className="text-sm text-blue-800">
                The Field ID and Field Key are auto-generated from your label. You can customize them if needed,
                but make sure they're unique and follow the naming rules.
              </p>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.label ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Budget Amount, Video Duration, Special Requirements"
              />
              {errors.label && <p className="mt-1 text-sm text-red-600">{errors.label}</p>}
              <p className="mt-1 text-xs text-gray-500">
                The label shown above the field to Script Writers
              </p>
            </div>

            {/* Field ID & Key (Auto-generated) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field ID *
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                    errors.id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="budget-amount"
                />
                {errors.id && <p className="mt-1 text-xs text-red-600">{errors.id}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Unique identifier (lowercase, hyphens)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Key *
                </label>
                <input
                  type="text"
                  value={formData.fieldKey}
                  onChange={(e) => setFormData({ ...formData, fieldKey: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                    errors.fieldKey ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="budgetAmount"
                />
                {errors.fieldKey && <p className="mt-1 text-xs text-red-600">{errors.fieldKey}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Database field name (camelCase)
                </p>
              </div>
            </div>

            {/* Field Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as FieldType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {fieldTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Data Source (for dropdown/multi-select fields) */}
            {['dropdown', 'db-dropdown', 'multi-select'].includes(formData.type) && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Source Configuration</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Where should options come from? *
                    </label>
                    <select
                      value={formData.dataSourceType}
                      onChange={(e) => setFormData({ ...formData, dataSourceType: e.target.value as any })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                        errors.dataSourceType ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="none">Select data source...</option>
                      <option value="localStorage">localStorage (Managed in Settings)</option>
                      <option value="database">Database Table</option>
                      <option value="hardcoded">Hardcoded Options</option>
                    </select>
                    {errors.dataSourceType && <p className="mt-1 text-sm text-red-600">{errors.dataSourceType}</p>}
                  </div>

                  {formData.dataSourceType === 'localStorage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        localStorage Key *
                      </label>
                      <input
                        type="text"
                        value={formData.dataSourceKey}
                        onChange={(e) => setFormData({ ...formData, dataSourceKey: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                          errors.dataSourceKey ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="my_custom_dropdown"
                      />
                      {errors.dataSourceKey && <p className="mt-1 text-sm text-red-600">{errors.dataSourceKey}</p>}
                      <p className="mt-1 text-xs text-gray-500">
                        Options will be managed in Settings → Dropdown Options
                      </p>
                    </div>
                  )}

                  {formData.dataSourceType === 'database' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Database Table *
                      </label>
                      <select
                        value={formData.dataSourceTable}
                        onChange={(e) => setFormData({ ...formData, dataSourceTable: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="industries">Industries</option>
                        <option value="profile_list">Profiles</option>
                        <option value="hook_tags">Hook Tags</option>
                        <option value="character_tags">Character Tags</option>
                      </select>
                    </div>
                  )}

                  {formData.dataSourceType === 'hardcoded' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Options (one per line) *
                      </label>
                      <textarea
                        rows={5}
                        value={formData.hardcodedOptions}
                        onChange={(e) => setFormData({ ...formData, hardcodedOptions: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                          errors.hardcodedOptions ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Option 1&#10;Option 2&#10;Option 3&#10;&#10;Or use format:&#10;value1 | Display Label 1&#10;value2 | Display Label 2"
                      />
                      {errors.hardcodedOptions && <p className="mt-1 text-sm text-red-600">{errors.hardcodedOptions}</p>}
                      <p className="mt-1 text-xs text-gray-500">
                        Format: "value | label" or just the value (one per line)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Placeholder */}
            {!['divider'].includes(formData.type) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placeholder
                </label>
                <input
                  type="text"
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Hint text shown inside the field"
                />
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
                placeholder="Additional guidance or instructions"
              />
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Basic Info</option>
                  <option value="content">Content Analysis</option>
                  <option value="production">Production Details</option>
                </select>
              </div>

              {/* Required */}
              {!['divider'].includes(formData.type) && (
                <div className="flex items-center pt-7">
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

              {/* Enabled */}
              <div className="flex items-center pt-7">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="ml-2 text-sm font-medium text-gray-700">
                  Enabled by Default
                </label>
              </div>
            </div>

            {/* Textarea Rows */}
            {(formData.type === 'textarea' || formData.type === 'textarea-voice') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Rows
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.rows}
                  onChange={(e) => setFormData({ ...formData, rows: parseInt(e.target.value) || 3 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Number Options */}
            {formData.type === 'number' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Value
                  </label>
                  <input
                    type="number"
                    value={formData.min ?? ''}
                    onChange={(e) => setFormData({ ...formData, min: e.target.value ? parseFloat(e.target.value) : undefined })}
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
                    onChange={(e) => setFormData({ ...formData, max: e.target.value ? parseFloat(e.target.value) : undefined })}
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
                    onChange={(e) => setFormData({ ...formData, step: e.target.value ? parseFloat(e.target.value) : undefined })}
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
                Add Field
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
