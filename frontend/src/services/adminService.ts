import { supabase } from '@/lib/supabase';
import type { ViralAnalysis, ReviewAnalysisData, HookTag, CharacterTag } from '@/types';

export const adminService = {
  // Get all analyses with user info (admin only)
  async getAllAnalyses(): Promise<ViralAnalysis[]> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        profiles:user_id (
          email,
          full_name,
          avatar_url
        ),
        assignments:project_assignments (
          id,
          role,
          user:profiles!project_assignments_user_id_fkey (
            id,
            email,
            full_name,
            avatar_url,
            role
          )
        ),
        industry:industries (
          id,
          name,
          short_code
        ),
        profile:profile_list (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Import content config service to fetch tags
    const { contentConfigService } = await import('./contentConfigService');

    // Flatten the nested profile data and parse assignments + fetch tags
    const analyses = await Promise.all(
      data.map(async (analysis: any) => {
        const videographer = analysis.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user;
        const editor = analysis.assignments?.find((a: any) => a.role === 'EDITOR')?.user;
        const posting_manager = analysis.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user;

        // Fetch hook tags and character tags for this analysis
        let hook_tags: HookTag[] = [];
        let character_tags: CharacterTag[] = [];

        try {
          hook_tags = await contentConfigService.getAnalysisHookTags(analysis.id);
          character_tags = await contentConfigService.getAnalysisCharacterTags(analysis.id);
        } catch (err) {
          console.error(`Failed to fetch tags for analysis ${analysis.id}:`, err);
        }

        return {
          ...analysis,
          email: analysis.profiles?.email,
          full_name: analysis.profiles?.full_name,
          avatar_url: analysis.profiles?.avatar_url,
          videographer,
          editor,
          posting_manager,
          hook_tags,
          character_tags,
          profiles: undefined, // Remove the nested object
        };
      })
    );

    return analyses;
  },

  // Review analysis with scoring (admin only)
  async reviewAnalysis(
    id: string,
    reviewData: ReviewAnalysisData
  ): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate that feedback is provided for rejections
    if (reviewData.status === 'REJECTED' && !reviewData.feedback) {
      throw new Error('Feedback is required when rejecting an analysis');
    }

    // Calculate overall score as average of all scores
    const overall_score = (
      reviewData.hookStrength +
      reviewData.contentQuality +
      reviewData.viralPotential +
      reviewData.replicationClarity
    ) / 4;

    // Upload voice feedback if provided
    let feedback_voice_note_url: string | undefined;
    if (reviewData.feedbackVoiceNote) {
      const fileName = `feedback-${id}-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, reviewData.feedbackVoiceNote, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(fileName);

      feedback_voice_note_url = publicUrl;
    }

    // If rejecting, increment the rejection counter using the database function
    if (reviewData.status === 'REJECTED') {
      const { error: rpcError } = await supabase.rpc('increment_rejection_counter', {
        analysis_uuid: id,
      });

      if (rpcError) {
        console.error('Failed to increment rejection counter:', rpcError);
        // Don't throw - allow rejection to proceed even if counter fails
      }
    }

    const { data, error } = await supabase
      .from('viral_analyses')
      .update({
        status: reviewData.status,
        feedback: reviewData.feedback,
        feedback_voice_note_url,
        hook_strength: reviewData.hookStrength,
        content_quality: reviewData.contentQuality,
        viral_potential: reviewData.viralPotential,
        replication_clarity: reviewData.replicationClarity,
        overall_score: parseFloat(overall_score.toFixed(1)),
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update analysis status (admin only) - Simple status update without review
  async updateAnalysisStatus(
    id: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
  ): Promise<ViralAnalysis> {
    const { data, error} = await supabase
      .from('viral_analyses')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete any analysis (admin only)
  async deleteAnalysis(id: string): Promise<void> {
    const { error } = await supabase
      .from('viral_analyses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Disapprove an already-approved script (admin only)
  async disapproveScript(
    id: string,
    reason: string
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate that reason is provided
    if (!reason || reason.trim().length === 0) {
      throw new Error('Disapproval reason is required');
    }

    // Call the database function to disapprove the script
    const { error } = await supabase.rpc('disapprove_script', {
      analysis_uuid: id,
      reason: reason.trim(),
    });

    if (error) throw error;
  },

  // Get dashboard stats (admin only)
  async getDashboardStats() {
    const [analysesResult, usersResult] = await Promise.all([
      supabase.from('viral_analyses').select('status', { count: 'exact' }),
      supabase.from('profiles').select('role', { count: 'exact' }),
    ]);

    if (analysesResult.error) throw analysesResult.error;
    if (usersResult.error) throw usersResult.error;

    const totalAnalyses = analysesResult.count || 0;
    const totalUsers = usersResult.count || 0;

    // Count by status
    const { data: statusCounts } = await supabase
      .from('viral_analyses')
      .select('status');

    const pending = statusCounts?.filter((a) => a.status === 'PENDING').length || 0;
    const approved = statusCounts?.filter((a) => a.status === 'APPROVED').length || 0;
    const rejected = statusCounts?.filter((a) => a.status === 'REJECTED').length || 0;

    return {
      totalAnalyses,
      totalUsers,
      pendingAnalyses: pending,
      approvedAnalyses: approved,
      rejectedAnalyses: rejected,
    };
  },
};
