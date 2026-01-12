/**
 * Form Field Resolver Utilities
 *
 * Resolves field options from various data sources:
 * - localStorage (managed dropdown options)
 * - Database (via contentConfigService)
 * - Hardcoded options
 */

import type { ScriptFormFieldConfig, ResolvedField } from '@/types/formBuilder';
import { contentConfigService } from '@/services/contentConfigService';

/**
 * Get dropdown options from localStorage
 */
function getDropdownOptions(key: string): Array<{ id: string; label: string; value: string }> {
  try {
    const stored = localStorage.getItem('script_dropdown_configs');
    if (!stored) return [];

    const configs = JSON.parse(stored);
    const config = configs.find((c: any) => c.key === key);

    if (!config || !config.options) return [];

    return config.options.map((opt: any, index: number) => ({
      id: `${key}_${index}`,
      label: opt,
      value: opt,
    }));
  } catch (error) {
    console.error(`Failed to load dropdown options for key "${key}":`, error);
    return [];
  }
}

/**
 * Resolve options for a single field
 */
export async function resolveFieldOptions(
  field: ScriptFormFieldConfig
): Promise<ResolvedField> {
  const resolved: ResolvedField = { ...field };

  // Only resolve options for fields that need them
  if (!['dropdown', 'db-dropdown', 'multi-select'].includes(field.type)) {
    return resolved;
  }

  if (!field.dataSource) {
    console.warn(`Field "${field.id}" requires dataSource but none provided`);
    return resolved;
  }

  try {
    // localStorage-based dropdown
    if (field.dataSource.type === 'localStorage') {
      resolved.options = getDropdownOptions(field.dataSource.key);
    }

    // Database-based dropdown/tags
    else if (field.dataSource.type === 'database') {
      const table = field.dataSource.table;

      if (table === 'industries') {
        const data = await contentConfigService.getAllIndustries();
        resolved.options = data.map((item: any) => ({
          id: item.id,
          label: item.name,
          value: item.id,
        }));
      } else if (table === 'profile_list') {
        const data = await contentConfigService.getAllProfiles();
        resolved.options = data.map((item: any) => ({
          id: item.id,
          label: item.name,
          value: item.id,
        }));
      } else if (table === 'hook_tags') {
        const data = await contentConfigService.getAllHookTags();
        resolved.options = data.map((item: any) => ({
          id: item.id,
          label: item.name,
          value: item.id,
        }));
      } else if (table === 'character_tags') {
        const data = await contentConfigService.getAllCharacterTags();
        resolved.options = data.map((item: any) => ({
          id: item.id,
          label: item.name,
          value: item.id,
        }));
      }
    }

    // Hardcoded options
    else if (field.dataSource.type === 'hardcoded') {
      resolved.options = field.dataSource.options.map((opt, index) => ({
        id: `${field.id}_${index}`,
        label: opt.label,
        value: opt.value,
      }));
    }
  } catch (error) {
    console.error(`Failed to resolve options for field "${field.id}":`, error);
    resolved.options = [];
  }

  return resolved;
}

/**
 * Resolve options for all fields in parallel
 */
export async function resolveAllFieldOptions(
  fields: ScriptFormFieldConfig[]
): Promise<ResolvedField[]> {
  return Promise.all(fields.map((field) => resolveFieldOptions(field)));
}

/**
 * Check if a field should be visible based on conditional logic
 */
export function isFieldVisible(
  field: ScriptFormFieldConfig,
  formValues: Record<string, any>
): boolean {
  if (!field.conditional) return true;

  const { fieldId, operator, value } = field.conditional;
  const fieldValue = formValues[fieldId];

  if (fieldValue === undefined || fieldValue === null) return false;

  switch (operator) {
    case 'equals':
      return fieldValue === value;

    case 'notEquals':
      return fieldValue !== value;

    case 'contains':
      if (Array.isArray(fieldValue) && Array.isArray(value)) {
        return value.some((v) => fieldValue.includes(v));
      }
      return false;

    case 'notContains':
      if (Array.isArray(fieldValue) && Array.isArray(value)) {
        return !value.some((v) => fieldValue.includes(v));
      }
      return false;

    default:
      console.warn(`Unknown conditional operator: ${operator}`);
      return true;
  }
}
