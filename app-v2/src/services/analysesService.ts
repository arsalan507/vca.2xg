/**
 * Analyses Service - Script Writer API
 *
 * Handles:
 * - Fetching user's analyses
 * - Creating new analyses
 * - Uploading voice notes
 * - Updating analyses
 */

import { supabase, auth, storage } from '@/lib/api';
import type { ViralAnalysis, AnalysisFormData } from '@/types';

export interface AnalysisStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvalRate: number;
}

export const analysesService = {
  /**
   * Get all analyses for current user
   */
  async getMyAnalyses(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name, platform)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ViralAnalysis[];
  },

  /**
   * Get stats for current user's analyses
   */
  async getMyStats(): Promise<AnalysisStats> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Use server-side count queries instead of fetching all records
    const [totalResult, pendingResult, approvedResult, rejectedResult] = await Promise.all([
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'PENDING'),
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'APPROVED'),
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'REJECTED'),
    ]);

    const total = totalResult.count || 0;
    const approved = approvedResult.count || 0;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return {
      total,
      pending: pendingResult.count || 0,
      approved,
      rejected: rejectedResult.count || 0,
      approvalRate,
    };
  },

  /**
   * Get single analysis by ID
   */
  async getAnalysis(id: string): Promise<ViralAnalysis> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name, platform),
        hook_tags:analysis_hook_tags(hook_tag:hook_tags(id, name)),
        character_tags:analysis_character_tags(character_tag:character_tags(id, name))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transform nested tags
    const analysis = data as any;
    return {
      ...analysis,
      hook_tags: analysis.hook_tags?.map((ht: any) => ht.hook_tag) || [],
      character_tags: analysis.character_tags?.map((ct: any) => ct.character_tag) || [],
    } as ViralAnalysis;
  },

  /**
   * Get pending analyses for current user
   */
  async getPendingAnalyses(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('viral_analyses')
      .select('*, industry:industries(id, name, short_code), profile:profile_list(id, name, platform)')
      .eq('user_id', user.id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ViralAnalysis[];
  },

  /**
   * Get approved analyses for current user
   */
  async getApprovedAnalyses(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('viral_analyses')
      .select('*, industry:industries(id, name, short_code), profile:profile_list(id, name, platform)')
      .eq('user_id', user.id)
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ViralAnalysis[];
  },

  /**
   * Get rejected analyses for current user
   */
  async getRejectedAnalyses(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('viral_analyses')
      .select('*, industry:industries(id, name, short_code), profile:profile_list(id, name, platform)')
      .eq('user_id', user.id)
      .eq('status', 'REJECTED')
      .eq('is_dissolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ViralAnalysis[];
  },

  /**
   * Upload voice note to storage
   */
  async uploadVoiceNote(userId: string, blob: Blob, section: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${userId}/${section}_${timestamp}.webm`;

    const { error } = await storage
      .from('voice-notes')
      .upload(fileName, blob, {
        contentType: 'audio/webm',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = storage
      .from('voice-notes')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  /**
   * Create new analysis
   */
  async createAnalysis(formData: AnalysisFormData): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if user is a trusted writer (auto-approve)
    // Use maybeSingle() to handle case where profile doesn't exist
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('is_trusted_writer')
      .eq('id', user.id)
      .maybeSingle();

    const profile = userProfile as { is_trusted_writer?: boolean } | null;
    const isTrustedWriter = profile?.is_trusted_writer === true;

    // Upload voice notes if provided
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
        status: isTrustedWriter ? 'APPROVED' : 'PENDING',
        production_stage: isTrustedWriter ? 'PLANNING' : null,

        // Core fields (matching production frontend)
        reference_url: formData.referenceUrl || null,
        title: formData.title || null,
        shoot_type: formData.shootType || null,
        creator_name: formData.creatorName || null,
        works_without_audio: formData.worksWithoutAudio || null,

        // Profile/Industry
        profile_id: formData.profileId || null,
        industry_id: formData.industryId || null,

        // Legacy fields (for backwards compatibility)
        platform: formData.platform || null,
        content_rating: formData.contentRating || null,
        why_viral: formData.whyViral || '',
        how_to_replicate: formData.howToReplicate || '',
        target_emotion: formData.targetEmotion || 'Not specified',
        expected_outcome: 'Not specified',
        replication_strength: formData.replicationStrength || null,

        // Voice notes
        hook_voice_note_url: hookVoiceUrl || null,
        why_viral_voice_note_url: whyViralVoiceUrl || null,
        how_to_replicate_voice_note_url: howToReplicateVoiceUrl || null,

        // Optional extended fields
        content_type: formData.contentType || null,
        characters_involved: formData.charactersInvolved || null,
        unusual_element: formData.unusualElement || null,

        // Level 2 fields
        body_reactions: formData.bodyReactions || [],
        emotion_first_6_sec: formData.emotionFirst6Sec || null,
        challenged_belief: formData.challengedBelief || null,
        emotional_identity_impact: formData.emotionalIdentityImpact || [],
        if_he_can_why_cant_you: formData.ifHeCanWhyCantYou || null,
        feel_like_commenting: formData.feelLikeCommenting || null,
        read_comments: formData.readComments || null,
        sharing_number: formData.sharingNumber || null,
        video_action: formData.videoAction || null,

        total_people_involved: formData.totalPeopleInvolved || null,
        shoot_possibility: formData.shootPossibility || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    const insertedData = data as ViralAnalysis;

    // Generate content_id if profile was provided (for videographer/admin submissions)
    if (formData.profileId && insertedData) {
      try {
        await supabase.rpc('generate_content_id_on_approval', {
          p_analysis_id: insertedData.id,
          p_profile_id: formData.profileId,
        });
        // Refetch to get the generated content_id
        const { data: updated } = await supabase
          .from('viral_analyses')
          .select('*')
          .eq('id', insertedData.id)
          .single();
        if (updated) {
          return updated as ViralAnalysis;
        }
      } catch (rpcError) {
        console.warn('Failed to generate content_id:', rpcError);
      }
    }

    return insertedData;
  },

  /**
   * Update an existing analysis
   */
  async updateAnalysis(id: string, formData: Partial<AnalysisFormData>): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Upload new voice notes if provided
    let hookVoiceUrl: string | undefined;
    let whyViralVoiceUrl: string | undefined;
    let howToReplicateVoiceUrl: string | undefined;

    if (formData.hookVoiceNote) {
      hookVoiceUrl = await this.uploadVoiceNote(user.id, formData.hookVoiceNote, 'hook');
    }
    if (formData.whyViralVoiceNote) {
      whyViralVoiceUrl = await this.uploadVoiceNote(user.id, formData.whyViralVoiceNote, 'why_viral');
    }
    if (formData.howToReplicateVoiceNote) {
      howToReplicateVoiceUrl = await this.uploadVoiceNote(user.id, formData.howToReplicateVoiceNote, 'how_to_replicate');
    }

    const updateData: Record<string, unknown> = {};

    // Only include fields that are provided
    if (formData.referenceUrl !== undefined) updateData.reference_url = formData.referenceUrl;
    if (formData.title !== undefined) updateData.title = formData.title;
    if (formData.platform !== undefined) updateData.platform = formData.platform;
    if (formData.shootType !== undefined) updateData.shoot_type = formData.shootType;
    if (formData.contentRating !== undefined) updateData.content_rating = formData.contentRating;
    if (formData.whyViral !== undefined) updateData.why_viral = formData.whyViral;
    if (formData.howToReplicate !== undefined) updateData.how_to_replicate = formData.howToReplicate;
    if (formData.targetEmotion !== undefined) updateData.target_emotion = formData.targetEmotion;
    if (formData.replicationStrength !== undefined) updateData.replication_strength = formData.replicationStrength;

    // Voice note URLs
    if (hookVoiceUrl) updateData.hook_voice_note_url = hookVoiceUrl;
    if (whyViralVoiceUrl) updateData.why_viral_voice_note_url = whyViralVoiceUrl;
    if (howToReplicateVoiceUrl) updateData.how_to_replicate_voice_note_url = howToReplicateVoiceUrl;

    const { data, error } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ViralAnalysis;
  },

  /**
   * Delete an analysis (soft delete via is_dissolved)
   */
  async deleteAnalysis(id: string): Promise<void> {
    const { error } = await supabase
      .from('viral_analyses')
      .update({ is_dissolved: true })
      .eq('id', id);

    if (error) throw error;
  },
};
