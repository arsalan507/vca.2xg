/**
 * Form Builder Service
 *
 * Manages the dynamic Script Writer form configuration.
 * - Stores configuration in Supabase database
 * - Provides CRUD operations for fields
 * - Handles default configuration generation
 * - Syncs across all devices and users
 */

import { supabase } from '@/lib/supabase';
import type { ScriptFormConfig, ScriptFormFieldConfig } from '@/types/formBuilder';

const CONFIG_KEY = 'script_form_config';
const CONFIG_VERSION = '1.0.0';

/**
 * Default form configuration matching current hardcoded form
 */
function getDefaultConfig(): ScriptFormConfig {
  const fields: ScriptFormFieldConfig[] = [
    // ============================================
    // BASIC INFORMATION
    // ============================================
    {
      id: 'industry',
      fieldKey: 'industryId',
      label: 'Industry',
      placeholder: 'Select industry...',
      type: 'db-dropdown',
      dataSource: { type: 'database', table: 'industries' },
      required: true,
      enabled: true,
      order: 0,
      category: 'basic',
    },
    {
      id: 'profile',
      fieldKey: 'profileId',
      label: 'Profile / Admin',
      placeholder: 'Select profile...',
      type: 'db-dropdown',
      dataSource: { type: 'database', table: 'profile_list' },
      required: true,
      enabled: true,
      order: 1,
      category: 'basic',
    },
    {
      id: 'reference-url',
      fieldKey: 'referenceUrl',
      label: 'Reference Link',
      placeholder: 'https://www.instagram.com/reel/example or https://youtube.com/watch?v=...',
      helpText: 'Paste the link to the viral content you want to analyze',
      type: 'url',
      required: true,
      enabled: true,
      order: 2,
      category: 'basic',
    },
    {
      id: 'hook-tags',
      fieldKey: 'hookTagIds',
      label: 'Hook Tags',
      placeholder: 'Select hook types...',
      type: 'multi-select',
      dataSource: { type: 'database', table: 'hook_tags' },
      required: true,
      enabled: true,
      order: 3,
      category: 'basic',
    },

    // ============================================
    // CONTENT ANALYSIS
    // ============================================
    {
      id: 'divider-content',
      fieldKey: '_divider_content',
      label: 'Content Analysis',
      type: 'divider',
      required: false,
      enabled: true,
      order: 4,
      category: 'content',
    },
    {
      id: 'hook',
      fieldKey: 'hook',
      label: 'Hook (First 6 Seconds)',
      placeholder: 'Describe the opening hook that grabs attention in the first 6 seconds...',
      helpText: 'Or record your explanation of the hook',
      type: 'textarea-voice',
      required: true,
      enabled: true,
      order: 5,
      category: 'content',
      containerClass: 'bg-gray-50',
      rows: 3,
    },
    {
      id: 'why-viral',
      fieldKey: 'whyViral',
      label: 'Why Did It Go Viral?',
      placeholder: 'Analyze the key factors that made this content go viral...',
      helpText: 'Or record your viral analysis',
      type: 'textarea-voice',
      required: false,
      enabled: true,
      order: 6,
      category: 'content',
      containerClass: 'bg-blue-50',
      rows: 3,
    },
    {
      id: 'how-to-replicate',
      fieldKey: 'howToReplicate',
      label: 'How to Replicate for Our Brand',
      placeholder: 'Explain step-by-step how we can adapt this viral format for our brand...',
      helpText: 'Or record your replication strategy',
      type: 'textarea-voice',
      required: false,
      enabled: true,
      order: 7,
      category: 'content',
      containerClass: 'bg-green-50',
      rows: 4,
    },
    {
      id: 'target-emotion',
      fieldKey: 'targetEmotion',
      label: 'What Emotions Are We Targeting?',
      placeholder: 'Select target emotion',
      type: 'dropdown',
      dataSource: { type: 'localStorage', key: 'target_emotions' },
      required: true,
      enabled: true,
      order: 8,
      category: 'content',
    },
    {
      id: 'expected-outcome',
      fieldKey: 'expectedOutcome',
      label: 'What Outcome Do We Expect?',
      placeholder: 'Select expected outcome',
      type: 'dropdown',
      dataSource: { type: 'localStorage', key: 'expected_outcomes' },
      required: true,
      enabled: true,
      order: 9,
      category: 'content',
    },

    // ============================================
    // PRODUCTION DETAILS
    // ============================================
    {
      id: 'divider-production',
      fieldKey: '_divider_production',
      label: 'Production Details',
      helpText: 'Additional information needed for video production',
      type: 'divider',
      required: false,
      enabled: true,
      order: 10,
      category: 'production',
    },
    {
      id: 'on-screen-text',
      fieldKey: 'onScreenTextHook',
      label: 'On-Screen Text Hook',
      placeholder: "Text that will appear on screen during the hook (e.g., 'live robbery ( plus shocking emoji)')",
      helpText: 'The text overlay that will grab attention in the first few seconds',
      type: 'textarea',
      required: false,
      enabled: true,
      order: 11,
      category: 'production',
      rows: 2,
    },
    {
      id: 'our-idea',
      fieldKey: 'ourIdeaAudio',
      label: 'Our Idea (Voice Note)',
      placeholder: 'Record your detailed idea for this content',
      helpText: 'Record your detailed idea and vision for this content',
      type: 'voice',
      required: false,
      enabled: true,
      order: 12,
      category: 'production',
      containerClass: 'bg-purple-50',
    },
    {
      id: 'shoot-location',
      fieldKey: 'shootLocation',
      label: 'Location of the Shoot',
      placeholder: 'e.g., in store, outside store, client location',
      helpText: 'Where will this video be shot?',
      type: 'text',
      required: false,
      enabled: true,
      order: 13,
      category: 'production',
    },
    {
      id: 'shoot-possibility',
      fieldKey: 'shootPossibility',
      label: 'Possibility of Shoot',
      placeholder: 'Select shoot possibility',
      helpText: 'How confident are you that this can be shot successfully?',
      type: 'dropdown',
      dataSource: {
        type: 'hardcoded',
        options: [
          { value: '100', label: '100% - Definitely can shoot' },
          { value: '75', label: '75% - Very likely' },
          { value: '50', label: '50% - Moderate chance' },
          { value: '25', label: '25% - Challenging but possible' },
        ],
      },
      required: true,
      enabled: true,
      order: 14,
      category: 'production',
    },
    {
      id: 'total-people',
      fieldKey: 'totalPeopleInvolved',
      label: 'Total People Involved',
      placeholder: '1',
      type: 'number',
      required: false,
      enabled: true,
      order: 15,
      category: 'production',
      min: 1,
      max: 100,
      step: 1,
    },
    {
      id: 'character-tags',
      fieldKey: 'characterTagIds',
      label: 'Character Tags',
      placeholder: 'Select characters involved...',
      type: 'multi-select',
      dataSource: { type: 'database', table: 'character_tags' },
      required: false,
      enabled: true,
      order: 16,
      category: 'production',
    },
  ];

  return {
    version: CONFIG_VERSION,
    lastUpdated: new Date().toISOString(),
    fields,
  };
}

// Cache for the config to avoid repeated database calls
let configCache: ScriptFormConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Form Builder Service
 */
export const formBuilderService = {
  /**
   * Get current form configuration from Supabase
   */
  async getConfig(): Promise<ScriptFormConfig> {
    try {
      // Check cache first
      const now = Date.now();
      if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('🔍 [formBuilderService] Using cached config');
        return configCache;
      }

      console.log('🔍 [formBuilderService] Fetching config from Supabase');

      const { data, error } = await supabase
        .from('form_configurations')
        .select('*')
        .eq('config_key', CONFIG_KEY)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No config found, create default
          console.log('⚠️ [formBuilderService] No config found, creating default');
          const defaultConfig = getDefaultConfig();
          await this.saveConfig(defaultConfig);
          return defaultConfig;
        }
        throw error;
      }

      const config: ScriptFormConfig = {
        version: data.version,
        lastUpdated: data.last_updated,
        fields: data.fields,
      };

      console.log('✅ [formBuilderService] Found saved config with', config.fields.length, 'fields');
      console.log('📋 [formBuilderService] Field IDs:', config.fields.map((f: any) => f.id).join(', '));

      // Update cache
      configCache = config;
      cacheTimestamp = now;

      return config;
    } catch (error) {
      console.error('❌ [formBuilderService] Failed to load config from Supabase:', error);
      // Fallback to default config
      const defaultConfig = getDefaultConfig();
      console.log('🔧 [formBuilderService] Returning default config with', defaultConfig.fields.length, 'fields');
      return defaultConfig;
    }
  },

  /**
   * Save form configuration to Supabase
   */
  async saveConfig(config: ScriptFormConfig): Promise<void> {
    try {
      config.lastUpdated = new Date().toISOString();
      config.version = CONFIG_VERSION;

      console.log('💾 [formBuilderService] Saving config with', config.fields.length, 'fields to Supabase');
      console.log('📋 [formBuilderService] Field IDs being saved:', config.fields.map((f: any) => f.id).join(', '));

      const { error } = await supabase
        .from('form_configurations')
        .upsert({
          config_key: CONFIG_KEY,
          version: config.version,
          fields: config.fields,
          last_updated: config.lastUpdated,
        }, {
          onConflict: 'config_key'
        });

      if (error) throw error;

      console.log('✅ [formBuilderService] Config saved successfully to Supabase');

      // Clear cache to force reload
      configCache = null;
    } catch (error) {
      console.error('❌ [formBuilderService] Failed to save config to Supabase:', error);
      throw error;
    }
  },

  /**
   * Get all fields sorted by order
   */
  async getAllFields(): Promise<ScriptFormFieldConfig[]> {
    const config = await this.getConfig();
    return [...config.fields].sort((a, b) => a.order - b.order);
  },

  /**
   * Get only enabled fields sorted by order
   */
  async getEnabledFields(): Promise<ScriptFormFieldConfig[]> {
    const allFields = await this.getAllFields();
    const enabledFields = allFields.filter(f => f.enabled);
    console.log('🟢 [formBuilderService] getEnabledFields:', enabledFields.length, 'enabled out of', allFields.length, 'total');
    console.log('📋 [formBuilderService] Enabled field IDs:', enabledFields.map(f => `${f.id} (${f.type})`).join(', '));
    return enabledFields;
  },

  /**
   * Get field by ID
   */
  async getFieldById(id: string): Promise<ScriptFormFieldConfig | undefined> {
    const config = await this.getConfig();
    return config.fields.find(f => f.id === id);
  },

  /**
   * Add new field
   */
  async addField(field: ScriptFormFieldConfig): Promise<void> {
    const config = await this.getConfig();
    console.log('➕ [formBuilderService] Adding new field:', field.id, field.label, field.type);

    // Validate unique ID
    if (config.fields.some(f => f.id === field.id)) {
      throw new Error(`Field with ID "${field.id}" already exists`);
    }

    // Validate unique fieldKey
    if (config.fields.some(f => f.fieldKey === field.fieldKey)) {
      throw new Error(`Field with key "${field.fieldKey}" already exists`);
    }

    console.log('✅ [formBuilderService] Validation passed, adding field');
    config.fields.push(field);
    console.log('📦 [formBuilderService] Config now has', config.fields.length, 'fields');
    await this.saveConfig(config);
  },

  /**
   * Update existing field
   */
  async updateField(id: string, updates: Partial<ScriptFormFieldConfig>): Promise<void> {
    const config = await this.getConfig();
    const index = config.fields.findIndex(f => f.id === id);

    if (index === -1) {
      throw new Error(`Field with ID "${id}" not found`);
    }

    // If updating fieldKey, validate uniqueness
    if (updates.fieldKey && updates.fieldKey !== config.fields[index].fieldKey) {
      if (config.fields.some(f => f.fieldKey === updates.fieldKey)) {
        throw new Error(`Field with key "${updates.fieldKey}" already exists`);
      }
    }

    config.fields[index] = {
      ...config.fields[index],
      ...updates,
    };

    await this.saveConfig(config);
  },

  /**
   * Delete field
   */
  async deleteField(id: string): Promise<void> {
    const config = await this.getConfig();
    config.fields = config.fields.filter(f => f.id !== id);
    await this.saveConfig(config);
  },

  /**
   * Reorder fields
   */
  async reorderFields(fieldIds: string[]): Promise<void> {
    const config = await this.getConfig();

    // Create a map of fieldId -> order
    const orderMap = new Map(fieldIds.map((id, index) => [id, index]));

    // Update order for all fields
    config.fields.forEach(field => {
      const newOrder = orderMap.get(field.id);
      if (newOrder !== undefined) {
        field.order = newOrder;
      }
    });

    await this.saveConfig(config);
  },

  /**
   * Reset to default configuration
   */
  async resetToDefault(): Promise<void> {
    const defaultConfig = getDefaultConfig();
    await this.saveConfig(defaultConfig);
  },

  /**
   * Export configuration as JSON (for backup/sharing)
   */
  async exportConfig(): Promise<string> {
    const config = await this.getConfig();
    return JSON.stringify(config, null, 2);
  },

  /**
   * Import configuration from JSON
   */
  async importConfig(jsonString: string): Promise<void> {
    try {
      const config = JSON.parse(jsonString) as ScriptFormConfig;

      // Basic validation
      if (!config.fields || !Array.isArray(config.fields)) {
        throw new Error('Invalid configuration format: missing fields array');
      }

      await this.saveConfig(config);
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw new Error('Invalid configuration JSON');
    }
  },

  /**
   * Clear cache (useful after external updates)
   */
  clearCache(): void {
    configCache = null;
    cacheTimestamp = 0;
    console.log('🗑️ [formBuilderService] Cache cleared');
  },
};
