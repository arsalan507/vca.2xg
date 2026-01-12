import { supabase } from '@/lib/supabase';
import type { ViralAnalysis, AnalysisFormData } from '@/types';

export const analysesService = {
  // Get all analyses for current user
  async getMyAnalyses(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('viral_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get single analysis
  async getAnalysis(id: string): Promise<ViralAnalysis> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Upload voice note to Supabase Storage
  async uploadVoiceNote(userId: string, blob: Blob, section: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${userId}/${section}_${timestamp}.webm`;

    const { error } = await supabase.storage
      .from('voice-notes')
      .upload(fileName, blob, {
        contentType: 'audio/webm',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('voice-notes')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  // Upload audio file (for "our idea" audio)
  async uploadAudio(userId: string, blob: Blob, prefix: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${userId}/${prefix}_${timestamp}.webm`;

    const { error } = await supabase.storage
      .from('voice-notes')
      .upload(fileName, blob, {
        contentType: 'audio/webm',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('voice-notes')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  // Create new analysis
  async createAnalysis(formData: AnalysisFormData): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Upload voice notes if present
    let hookVoiceUrl = '';
    let whyViralVoiceUrl = '';
    let howToReplicateVoiceUrl = '';
    let ourIdeaAudioUrl = '';

    if (formData.hookVoiceNote) {
      hookVoiceUrl = await this.uploadVoiceNote(user.id, formData.hookVoiceNote, 'hook');
    }
    if (formData.whyViralVoiceNote) {
      whyViralVoiceUrl = await this.uploadVoiceNote(user.id, formData.whyViralVoiceNote, 'why_viral');
    }
    if (formData.howToReplicateVoiceNote) {
      howToReplicateVoiceUrl = await this.uploadVoiceNote(user.id, formData.howToReplicateVoiceNote, 'how_to_replicate');
    }
    if (formData.ourIdeaAudio) {
      ourIdeaAudioUrl = await this.uploadAudio(user.id, formData.ourIdeaAudio, 'our_idea');
    }

    // Separate known fields from custom fields
    const knownFields = new Set([
      'referenceUrl', 'hook', 'hookVoiceNote', 'hookVoiceNoteUrl',
      'whyViral', 'whyViralVoiceNote', 'whyViralVoiceNoteUrl',
      'howToReplicate', 'howToReplicateVoiceNote', 'howToReplicateVoiceNoteUrl',
      'targetEmotion', 'expectedOutcome', 'industryId', 'profileId',
      'hookTagIds', 'totalPeopleInvolved', 'characterTagIds',
      'onScreenTextHook', 'ourIdeaAudio', 'ourIdeaAudioUrl',
      'shootLocation', 'shootPossibility', 'posting_profile'
    ]);

    // Extract custom fields
    const customFields: Record<string, any> = {};
    Object.keys(formData).forEach(key => {
      if (!knownFields.has(key)) {
        customFields[key] = formData[key];
      }
    });

    // Map posting_profile to profileId if present
    const profileIdValue = formData.posting_profile || formData.profileId;

    const { data, error } = await supabase
      .from('viral_analyses')
      .insert({
        user_id: user.id,
        reference_url: formData.referenceUrl,
        hook: formData.hook,
        hook_voice_note_url: hookVoiceUrl,
        why_viral: formData.whyViral,
        why_viral_voice_note_url: whyViralVoiceUrl,
        how_to_replicate: formData.howToReplicate,
        how_to_replicate_voice_note_url: howToReplicateVoiceUrl,
        target_emotion: formData.targetEmotion,
        expected_outcome: formData.expectedOutcome,
        // New enhanced fields
        industry_id: formData.industryId,
        profile_id: profileIdValue,
        total_people_involved: formData.totalPeopleInvolved,
        on_screen_text_hook: formData.onScreenTextHook,
        our_idea_audio_url: ourIdeaAudioUrl,
        shoot_location: formData.shootLocation,
        shoot_possibility: formData.shootPossibility,
        // Custom fields from Form Builder
        custom_fields: customFields,
      })
      .select()
      .single();

    if (error) throw error;

    // Now set the tag associations
    const { contentConfigService } = await import('./contentConfigService');

    if (formData.hookTagIds.length > 0) {
      await contentConfigService.setAnalysisHookTags(data.id, formData.hookTagIds);
    }

    if (formData.characterTagIds.length > 0) {
      await contentConfigService.setAnalysisCharacterTags(data.id, formData.characterTagIds);
    }

    return data;
  },

  // Update analysis
  async updateAnalysis(id: string, formData: AnalysisFormData): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Upload new voice notes if present
    let hookVoiceUrl = formData.hookVoiceNoteUrl;
    let whyViralVoiceUrl = formData.whyViralVoiceNoteUrl;
    let howToReplicateVoiceUrl = formData.howToReplicateVoiceNoteUrl;
    let ourIdeaAudioUrl = formData.ourIdeaAudioUrl;

    if (formData.hookVoiceNote) {
      hookVoiceUrl = await this.uploadVoiceNote(user.id, formData.hookVoiceNote, 'hook');
    }
    if (formData.whyViralVoiceNote) {
      whyViralVoiceUrl = await this.uploadVoiceNote(user.id, formData.whyViralVoiceNote, 'why_viral');
    }
    if (formData.howToReplicateVoiceNote) {
      howToReplicateVoiceUrl = await this.uploadVoiceNote(user.id, formData.howToReplicateVoiceNote, 'how_to_replicate');
    }
    if (formData.ourIdeaAudio) {
      ourIdeaAudioUrl = await this.uploadAudio(user.id, formData.ourIdeaAudio, 'our_idea');
    }

    // Separate known fields from custom fields
    const knownFields = new Set([
      'referenceUrl', 'hook', 'hookVoiceNote', 'hookVoiceNoteUrl',
      'whyViral', 'whyViralVoiceNote', 'whyViralVoiceNoteUrl',
      'howToReplicate', 'howToReplicateVoiceNote', 'howToReplicateVoiceNoteUrl',
      'targetEmotion', 'expectedOutcome', 'industryId', 'profileId',
      'hookTagIds', 'totalPeopleInvolved', 'characterTagIds',
      'onScreenTextHook', 'ourIdeaAudio', 'ourIdeaAudioUrl',
      'shootLocation', 'shootPossibility', 'posting_profile'
    ]);

    // Extract custom fields
    const customFields: Record<string, any> = {};
    Object.keys(formData).forEach(key => {
      if (!knownFields.has(key)) {
        customFields[key] = formData[key];
      }
    });

    // Map posting_profile to profileId if present
    const profileIdValue = formData.posting_profile || formData.profileId;

    const { data, error } = await supabase
      .from('viral_analyses')
      .update({
        reference_url: formData.referenceUrl,
        hook: formData.hook,
        hook_voice_note_url: hookVoiceUrl,
        why_viral: formData.whyViral,
        why_viral_voice_note_url: whyViralVoiceUrl,
        how_to_replicate: formData.howToReplicate,
        how_to_replicate_voice_note_url: howToReplicateVoiceUrl,
        target_emotion: formData.targetEmotion,
        expected_outcome: formData.expectedOutcome,
        // New enhanced fields
        industry_id: formData.industryId,
        profile_id: profileIdValue,
        total_people_involved: formData.totalPeopleInvolved,
        on_screen_text_hook: formData.onScreenTextHook,
        our_idea_audio_url: ourIdeaAudioUrl,
        shoot_location: formData.shootLocation,
        shoot_possibility: formData.shootPossibility,
        // Custom fields from Form Builder
        custom_fields: customFields,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update tag associations
    const { contentConfigService } = await import('./contentConfigService');

    await contentConfigService.setAnalysisHookTags(id, formData.hookTagIds);
    await contentConfigService.setAnalysisCharacterTags(id, formData.characterTagIds);

    return data;
  },

  // Delete analysis
  async deleteAnalysis(id: string): Promise<void> {
    const { error } = await supabase
      .from('viral_analyses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
