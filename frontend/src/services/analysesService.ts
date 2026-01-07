import { supabase } from '@/lib/supabase';
import type { ViralAnalysis, AnalysisFormData } from '@/types';

export const analysesService = {
  // Get all analyses for current user
  async getMyAnalyses(): Promise<ViralAnalysis[]> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
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

    const { data, error } = await supabase.storage
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

    if (formData.hookVoiceNote) {
      hookVoiceUrl = await this.uploadVoiceNote(user.id, formData.hookVoiceNote, 'hook');
    }
    if (formData.whyViralVoiceNote) {
      whyViralVoiceUrl = await this.uploadVoiceNote(user.id, formData.whyViralVoiceNote, 'why_viral');
    }
    if (formData.howToReplicateVoiceNote) {
      howToReplicateVoiceUrl = await this.uploadVoiceNote(user.id, formData.howToReplicateVoiceNote, 'how_to_replicate');
    }

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
      })
      .select()
      .single();

    if (error) throw error;
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

    if (formData.hookVoiceNote) {
      hookVoiceUrl = await this.uploadVoiceNote(user.id, formData.hookVoiceNote, 'hook');
    }
    if (formData.whyViralVoiceNote) {
      whyViralVoiceUrl = await this.uploadVoiceNote(user.id, formData.whyViralVoiceNote, 'why_viral');
    }
    if (formData.howToReplicateVoiceNote) {
      howToReplicateVoiceUrl = await this.uploadVoiceNote(user.id, formData.howToReplicateVoiceNote, 'how_to_replicate');
    }

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
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
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
