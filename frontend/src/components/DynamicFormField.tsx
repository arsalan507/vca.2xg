/**
 * Dynamic Form Field Component
 *
 * Renders form fields dynamically based on ScriptFormFieldConfig.
 * Supports all field types: text, textarea, url, number, dropdown, multi-select, voice, etc.
 */

import type { ResolvedField } from '@/types/formBuilder';
import VoiceRecorder from '@/components/VoiceRecorder';
import MultiSelectTags from '@/components/MultiSelectTags';

interface DynamicFormFieldProps {
  field: ResolvedField;
  value: any;
  onChange: (fieldKey: string, value: any) => void;
  error?: string;
  formData?: any; // Full form data for accessing related fields (e.g., voiceNoteUrl)
}

export default function DynamicFormField({
  field,
  value,
  onChange,
  error,
  formData = {},
}: DynamicFormFieldProps) {
  // ============================================
  // DIVIDER TYPE
  // ============================================
  if (field.type === 'divider') {
    return (
      <div className="col-span-2 border-t border-gray-200 pt-6 mt-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{field.label}</h3>
        {field.helpText && (
          <p className="text-sm text-gray-500">{field.helpText}</p>
        )}
      </div>
    );
  }

  // ============================================
  // FIELD LABEL
  // ============================================
  const renderLabel = () => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {field.label}
      {field.required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  // ============================================
  // TEXT INPUT
  // ============================================
  if (field.type === 'text') {
    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(field.fieldKey, e.target.value)}
          placeholder={field.placeholder}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={field.required}
        />
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ============================================
  // URL INPUT
  // ============================================
  if (field.type === 'url') {
    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <input
          type="url"
          value={value || ''}
          onChange={(e) => onChange(field.fieldKey, e.target.value)}
          placeholder={field.placeholder}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={field.required}
        />
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ============================================
  // NUMBER INPUT
  // ============================================
  if (field.type === 'number') {
    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(field.fieldKey, e.target.valueAsNumber || null)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={field.required}
        />
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ============================================
  // TEXTAREA
  // ============================================
  if (field.type === 'textarea') {
    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field.fieldKey, e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows || 3}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={field.required}
        />
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ============================================
  // DROPDOWN (localStorage-based)
  // ============================================
  if (field.type === 'dropdown') {
    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <select
          value={value || ''}
          onChange={(e) => onChange(field.fieldKey, e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={field.required}
        >
          <option value="">{field.placeholder || 'Select...'}</option>
          {field.options?.map((opt) => (
            <option key={opt.id} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ============================================
  // DB DROPDOWN (database-based)
  // ============================================
  if (field.type === 'db-dropdown') {
    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <select
          value={value || ''}
          onChange={(e) => onChange(field.fieldKey, e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={field.required}
        >
          <option value="">{field.placeholder || 'Select...'}</option>
          {field.options?.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ============================================
  // MULTI-SELECT (database tags)
  // ============================================
  if (field.type === 'multi-select') {
    // Convert options to Tag format (id, name)
    const tagOptions = (field.options || []).map((opt) => ({
      id: opt.id,
      name: opt.label,
    }));

    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <MultiSelectTags
          label=""
          options={tagOptions}
          selectedIds={value || []}
          onChange={(selectedIds) => onChange(field.fieldKey, selectedIds)}
          placeholder={field.placeholder || 'Select...'}
          required={field.required}
          error={error}
        />
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
      </div>
    );
  }

  // ============================================
  // VOICE RECORDER
  // ============================================
  if (field.type === 'voice') {
    const voiceKey = field.fieldKey;
    const voiceUrlKey = `${field.fieldKey}Url`;
    const existingVoiceUrl = formData[voiceUrlKey] || '';

    return (
      <div className={field.containerClass}>
        {renderLabel()}
        {field.helpText && (
          <p className="mb-2 text-sm text-gray-500">{field.helpText}</p>
        )}
        <VoiceRecorder
          existingAudioUrl={existingVoiceUrl}
          onRecordingComplete={(blob, url) => {
            onChange(voiceKey, blob);
            setTimeout(() => onChange(voiceUrlKey, url), 0);
          }}
          onClear={() => {
            onChange(voiceKey, null);
            setTimeout(() => onChange(voiceUrlKey, ''), 0);
          }}
          placeholder={field.placeholder || 'Record a voice note'}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ============================================
  // TEXTAREA + VOICE
  // ============================================
  if (field.type === 'textarea-voice') {
    // Use separate keys for text and voice
    const textKey = field.fieldKey;
    const voiceKey = `${field.fieldKey}VoiceNote`;
    const voiceUrlKey = `${field.fieldKey}VoiceNoteUrl`;

    const textValue = value || '';
    const existingVoiceUrl = formData[voiceUrlKey] || '';

    return (
      <div className={field.containerClass}>
        {renderLabel()}
        <textarea
          value={textValue}
          onChange={(e) => onChange(textKey, e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows || 3}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={field.required}
        />
        <div className="mt-2">
          <VoiceRecorder
            existingAudioUrl={existingVoiceUrl}
            onRecordingComplete={(blob, url) => {
              // Update both voice blob and url via parent onChange
              onChange(voiceKey, blob);
              // Schedule url update after state is set
              setTimeout(() => onChange(voiceUrlKey, url), 0);
            }}
            onClear={() => {
              onChange(voiceKey, null);
              setTimeout(() => onChange(voiceUrlKey, ''), 0);
            }}
            placeholder={field.helpText || 'Or record a voice note'}
          />
        </div>
        {field.helpText && (
          <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div className={field.containerClass}>
      {renderLabel()}
      <p className="text-sm text-red-600">
        Unknown field type: {field.type}
      </p>
    </div>
  );
}
