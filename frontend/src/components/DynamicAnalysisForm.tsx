/**
 * Dynamic Analysis Form
 *
 * Renders the Script Writer form dynamically based on formBuilderService configuration.
 * Replaces the hardcoded 400+ line form in AnalysesPage.
 */

import { useState, useEffect } from 'react';
import { formBuilderService } from '@/services/formBuilderService';
import { resolveAllFieldOptions, isFieldVisible } from '@/utils/formFieldResolver';
import DynamicFormField from '@/components/DynamicFormField';
import type { ResolvedField } from '@/types/formBuilder';
import type { AnalysisFormData } from '@/types';

interface DynamicAnalysisFormProps {
  formData: AnalysisFormData;
  onChange: (updates: Partial<AnalysisFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  isEditing: boolean;
}

export default function DynamicAnalysisForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
}: DynamicAnalysisFormProps) {
  const [resolvedFields, setResolvedFields] = useState<ResolvedField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Log component mount
  useEffect(() => {
    console.log('🎬 [DynamicAnalysisForm] Component mounted/remounted');
  }, []);

  // Load and resolve form fields
  useEffect(() => {
    async function loadFields() {
      try {
        setIsLoadingFields(true);
        const enabledFields = await formBuilderService.getEnabledFields();
        console.log('📋 Loading form fields:', enabledFields.length, 'enabled fields');
        enabledFields.forEach(f => console.log(`  - ${f.label} (${f.type}, key: ${f.fieldKey})`));
        const resolved = await resolveAllFieldOptions(enabledFields);
        setResolvedFields(resolved);
      } catch (error) {
        console.error('Failed to load form fields:', error);
      } finally {
        setIsLoadingFields(false);
      }
    }

    loadFields();
  }, [reloadTrigger]);

  // Expose reload function via window for debugging
  useEffect(() => {
    (window as any).reloadFormFields = () => {
      console.log('🔄 Manual reload triggered');
      setReloadTrigger(prev => prev + 1);
    };

    // Expose localStorage inspector
    (window as any).inspectFormConfig = () => {
      const stored = localStorage.getItem('script_form_config');
      if (stored) {
        const config = JSON.parse(stored);
        console.log('🔍 LocalStorage Config:');
        console.log('  - Version:', config.version);
        console.log('  - Last Updated:', config.lastUpdated);
        console.log('  - Total Fields:', config.fields.length);
        console.log('  - Field IDs:', config.fields.map((f: any) => f.id).join(', '));
        console.log('  - Enabled Fields:', config.fields.filter((f: any) => f.enabled).length);
        console.log('  - Disabled Fields:', config.fields.filter((f: any) => !f.enabled).length);
        console.table(config.fields.map((f: any) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          enabled: f.enabled,
          order: f.order,
        })));
        return config;
      } else {
        console.log('⚠️ No config found in localStorage');
        return null;
      }
    };
  }, []);

  // Handle field value change
  const handleFieldChange = (fieldKey: string, value: any) => {
    // For textarea-voice and voice fields, value might be an object with multiple keys
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Blob)) {
      onChange(value);
    } else {
      onChange({ [fieldKey]: value });
    }

    // Clear error for this field
    if (errors[fieldKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  // Client-side validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    resolvedFields.forEach((field) => {
      // Skip validation for disabled fields or dividers
      if (field.type === 'divider') return;

      // Skip if conditionally hidden
      if (!isFieldVisible(field, formData)) return;

      // Required field validation
      if (field.required) {
        const value = (formData as any)[field.fieldKey];

        // Special handling for textarea-voice fields
        if (field.type === 'textarea-voice') {
          const textValue = value?.[field.fieldKey];
          const voiceValue = value?.[`${field.fieldKey}Audio`];
          if (!textValue && !voiceValue) {
            newErrors[field.fieldKey] = `${field.label} is required (text or voice)`;
          }
        }
        // Array fields (multi-select)
        else if (Array.isArray(value)) {
          if (value.length === 0) {
            newErrors[field.fieldKey] = `${field.label} is required`;
          }
        }
        // All other fields
        else if (!value || (typeof value === 'string' && !value.trim())) {
          newErrors[field.fieldKey] = `${field.label} is required`;
        }
      }

      // URL validation
      if (field.type === 'url' && (formData as any)[field.fieldKey]) {
        const urlValue = (formData as any)[field.fieldKey];
        try {
          new URL(urlValue);
        } catch {
          newErrors[field.fieldKey] = 'Please enter a valid URL';
        }
      }

      // Number range validation
      if (field.type === 'number' && (formData as any)[field.fieldKey]) {
        const numValue = (formData as any)[field.fieldKey];
        if (field.min !== undefined && numValue < field.min) {
          newErrors[field.fieldKey] = `Minimum value is ${field.min}`;
        }
        if (field.max !== undefined && numValue > field.max) {
          newErrors[field.fieldKey] = `Maximum value is ${field.max}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementById(`field-${firstErrorField}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    onSubmit(e);
  };

  if (isLoadingFields) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading form...</span>
      </div>
    );
  }

  if (resolvedFields.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>No form fields configured.</strong> Please contact your administrator to configure
          the form in Settings → Form Builder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {resolvedFields.map((field) => {
        // Check conditional visibility
        if (!isFieldVisible(field, formData)) {
          return null;
        }

        return (
          <div key={field.id} id={`field-${field.fieldKey}`}>
            <DynamicFormField
              field={field}
              value={(formData as any)[field.fieldKey]}
              onChange={handleFieldChange}
              error={errors[field.fieldKey]}
              formData={formData}
            />
          </div>
        );
      })}

      {/* Form Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ml-auto"
        >
          {isEditing ? 'Update Analysis' : 'Submit Analysis'}
        </button>
      </div>
    </form>
  );
}
