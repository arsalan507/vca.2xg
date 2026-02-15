/**
 * Admin Service - Admin API
 *
 * Handles:
 * - Fetching all analyses
 * - Reviewing/scoring analyses
 * - Dashboard stats
 * - Queue stats for pipeline
 */

import { supabase, auth, storage } from '@/lib/api';
import type { ViralAnalysis } from '@/types';

export interface ReviewData {
  status: 'APPROVED' | 'REJECTED';
  feedback?: string;
  feedbackVoiceNote?: Blob | null;
  hookStrength: number;
  contentQuality: number;
  viralPotential: number;
  replicationClarity: number;
  profileId?: string;
}

export interface DashboardStats {
  totalAnalyses: number;
  totalUsers: number;
  pendingAnalyses: number;
  approvedAnalyses: number;
  rejectedAnalyses: number;
}

export interface QueueStats {
  pending: number;
  planning: number;
  shooting: number;
  readyForEdit: number;
  editing: number;
  editReview: number;
  readyToPost: number;
  posted: number;
  totalActive: number;
}

export const adminService = {
  /**
   * Get all analyses with user info (admin only)
   */
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
          name,
          platform
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten the nested profile data and parse assignments
    const analyses = (data || []) as any[];
    return analyses.map((analysis: any) => {
      const videographer = analysis.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user;
      const editor = analysis.assignments?.find((a: any) => a.role === 'EDITOR')?.user;
      const posting_manager = analysis.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user;

      return {
        ...analysis,
        email: analysis.profiles?.email,
        full_name: analysis.profiles?.full_name,
        avatar_url: analysis.profiles?.avatar_url,
        videographer,
        editor,
        posting_manager,
      };
    }) as ViralAnalysis[];
  },

  /**
   * Get pending analyses
   */
  async getPendingAnalyses(): Promise<ViralAnalysis[]> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        profiles:user_id (
          email,
          full_name,
          avatar_url
        ),
        industry:industries (id, name, short_code),
        profile:profile_list (id, name, platform)
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const pendingList = (data || []) as any[];
    return pendingList.map((analysis: any) => ({
      ...analysis,
      email: analysis.profiles?.email,
      full_name: analysis.profiles?.full_name,
      avatar_url: analysis.profiles?.avatar_url,
    })) as ViralAnalysis[];
  },

  /**
   * Get single analysis by ID
   */
  async getAnalysis(id: string): Promise<ViralAnalysis> {
    // Fetch project and production files in parallel
    const [projectResult, filesResult] = await Promise.all([
      supabase
        .from('viral_analyses')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            avatar_url
          ),
          industry:industries (id, name, short_code),
          profile:profile_list (id, name, platform),
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
          )
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('production_files')
        .select('*')
        .eq('analysis_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (projectResult.error) throw projectResult.error;

    const analysis = projectResult.data as any;
    const videographer = analysis.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user;
    const editor = analysis.assignments?.find((a: any) => a.role === 'EDITOR')?.user;
    const posting_manager = analysis.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user;

    return {
      ...analysis,
      email: analysis.profiles?.email,
      full_name: analysis.profiles?.full_name,
      avatar_url: analysis.profiles?.avatar_url,
      videographer,
      editor,
      posting_manager,
      production_files: (filesResult.data || []) as any[],
    } as ViralAnalysis;
  },

  /**
   * Review analysis with scoring
   */
  async reviewAnalysis(id: string, reviewData: ReviewData): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate feedback for rejections
    if (reviewData.status === 'REJECTED' && !reviewData.feedback) {
      throw new Error('Feedback is required when rejecting an analysis');
    }

    // Calculate overall score
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
      const { error: uploadError } = await storage
        .from('voice-notes')
        .upload(fileName, reviewData.feedbackVoiceNote, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = storage
        .from('voice-notes')
        .getPublicUrl(fileName);

      feedback_voice_note_url = publicUrl;
    }

    // Increment rejection counter if rejecting
    if (reviewData.status === 'REJECTED') {
      await supabase.rpc('increment_rejection_counter', {
        analysis_uuid: id,
      });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
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
    };

    // If approving, set production_stage to PLANNING
    if (reviewData.status === 'APPROVED') {
      updateData.production_stage = 'PLANNING';
    }

    // If profile_id is provided, update it
    if (reviewData.profileId) {
      updateData.profile_id = reviewData.profileId;
    }

    const { data, error } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Generate content_id if approving with profile
    if (reviewData.status === 'APPROVED' && reviewData.profileId) {
      await supabase.rpc('generate_content_id_on_approval', {
        p_analysis_id: id,
        p_profile_id: reviewData.profileId,
      });
    }

    return data as ViralAnalysis;
  },

  /**
   * Get dashboard stats
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // Use server-side count queries instead of fetching all records
    const [totalResult, usersResult, pendingResult, approvedResult, rejectedResult] = await Promise.all([
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
    ]);

    if (totalResult.error) throw totalResult.error;

    return {
      totalAnalyses: totalResult.count || 0,
      totalUsers: usersResult.count || 0,
      pendingAnalyses: pendingResult.count || 0,
      approvedAnalyses: approvedResult.count || 0,
      rejectedAnalyses: rejectedResult.count || 0,
    };
  },

  /**
   * Get queue stats for pipeline overview
   */
  async getQueueStats(): Promise<QueueStats> {
    // Use server-side count queries per stage instead of fetching all records
    const approvedBase = () => supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED');

    const [
      pendingResult,
      planningResult,
      nullStageResult,
      shootingResult,
      readyForEditResult,
      editingResult,
      editReviewResult,
      readyToPostResult,
      postedResult,
    ] = await Promise.all([
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      approvedBase().in('production_stage', ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED']),
      approvedBase().is('production_stage', null),
      approvedBase().eq('production_stage', 'SHOOTING'),
      approvedBase().in('production_stage', ['READY_FOR_EDIT', 'SHOOT_REVIEW']),
      approvedBase().eq('production_stage', 'EDITING'),
      approvedBase().eq('production_stage', 'EDIT_REVIEW'),
      approvedBase().in('production_stage', ['READY_TO_POST', 'FINAL_REVIEW']),
      approvedBase().eq('production_stage', 'POSTED'),
    ]);

    const pending = pendingResult.count || 0;
    const planning = (planningResult.count || 0) + (nullStageResult.count || 0);
    const shooting = shootingResult.count || 0;
    const readyForEdit = readyForEditResult.count || 0;
    const editing = editingResult.count || 0;
    const editReview = editReviewResult.count || 0;
    const readyToPost = readyToPostResult.count || 0;
    const posted = postedResult.count || 0;
    const totalActive = planning + shooting + readyForEdit + editing + editReview + readyToPost;

    return { pending, planning, shooting, readyForEdit, editing, editReview, readyToPost, posted, totalActive };
  },

  /**
   * Get all team members (users)
   */
  async getTeamMembers(): Promise<{
    id: string;
    email: string;
    full_name?: string;
    role: string;
    avatar_url?: string;
    created_at: string;
    is_trusted_writer?: boolean;
  }[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('role')
      .order('full_name');

    if (error) throw error;
    return (data || []) as {
      id: string;
      email: string;
      full_name?: string;
      role: string;
      avatar_url?: string;
      created_at: string;
      is_trusted_writer?: boolean;
    }[];
  },

  /**
   * Get team stats by role
   */
  async getTeamStats(): Promise<{
    admins: number;
    writers: number;
    videographers: number;
    editors: number;
    postingManagers: number;
    total: number;
  }> {
    // Use server-side count queries per role instead of fetching all profiles
    const countByRole = (roles: string[]) =>
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', roles);

    const [totalResult, adminsResult, writersResult, videographersResult, editorsResult, pmResult] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      countByRole(['SUPER_ADMIN', 'admin']),
      countByRole(['SCRIPT_WRITER', 'script_writer']),
      countByRole(['VIDEOGRAPHER', 'videographer']),
      countByRole(['EDITOR', 'editor']),
      countByRole(['POSTING_MANAGER', 'posting_manager']),
    ]);

    return {
      admins: adminsResult.count || 0,
      writers: writersResult.count || 0,
      videographers: videographersResult.count || 0,
      editors: editorsResult.count || 0,
      postingManagers: pmResult.count || 0,
      total: totalResult.count || 0,
    };
  },

  /**
   * Get analytics data
   */
  async getAnalyticsData(): Promise<{
    scriptsThisWeek: number;
    scriptsLastWeek: number;
    approvalRate: number;
    avgTimeToApproval: number;
    topWriters: { name: string; count: number }[];
    stageDistribution: { stage: string; count: number }[];
  }> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    // Run count queries and data queries in parallel
    const [thisWeekResult, lastWeekResult, approvedCountResult, reviewedCountResult, analysesForWriters, stageData] = await Promise.all([
      // Count scripts this week (server-side)
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .gte('created_at', startOfWeek.toISOString()),
      // Count scripts last week (server-side)
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .gte('created_at', startOfLastWeek.toISOString())
        .lt('created_at', startOfWeek.toISOString()),
      // Count approved (server-side)
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED'),
      // Count reviewed (not pending) (server-side)
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .neq('status', 'PENDING'),
      // Only fetch data needed for top writers and avg time
      supabase.from('viral_analyses')
        .select('status, created_at, reviewed_at, profiles:user_id (full_name, email)')
        .order('created_at', { ascending: false }),
      // Stage distribution for approved
      supabase.from('viral_analyses')
        .select('production_stage')
        .eq('status', 'APPROVED'),
    ]);

    const scriptsThisWeek = thisWeekResult.count || 0;
    const scriptsLastWeek = lastWeekResult.count || 0;
    const approvedCount = approvedCountResult.count || 0;
    const reviewedCount = reviewedCountResult.count || 0;
    const approvalRate = reviewedCount > 0 ? Math.round((approvedCount / reviewedCount) * 100) : 0;

    // Calculate average time to approval (in hours) from fetched data
    const allAnalyses = (analysesForWriters.data || []) as any[];
    const approvedWithTimes = allAnalyses.filter((a: any) => a.status === 'APPROVED' && a.reviewed_at);
    let avgTimeToApproval = 0;
    if (approvedWithTimes.length > 0) {
      const totalHours = approvedWithTimes.reduce((sum: number, a: any) => {
        const created = new Date(a.created_at).getTime();
        const reviewed = new Date(a.reviewed_at).getTime();
        return sum + (reviewed - created) / (1000 * 60 * 60);
      }, 0);
      avgTimeToApproval = Math.round(totalHours / approvedWithTimes.length);
    }

    // Get top writers from the same data
    const writerCounts: Record<string, { name: string; count: number }> = {};
    allAnalyses.forEach((a: any) => {
      const name = a.profiles?.full_name || a.profiles?.email || 'Unknown';
      if (!writerCounts[name]) {
        writerCounts[name] = { name, count: 0 };
      }
      writerCounts[name].count++;
    });
    const topWriters = Object.values(writerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Stage distribution
    const stageCounts: Record<string, number> = {};
    const stageList = ((stageData.data || []) as { production_stage?: string }[]);
    stageList.forEach((a) => {
      const stage = a.production_stage || 'PLANNING';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    const stageDistribution = Object.entries(stageCounts).map(([stage, count]) => ({
      stage,
      count,
    }));

    return {
      scriptsThisWeek,
      scriptsLastWeek,
      approvalRate,
      avgTimeToApproval,
      topWriters,
      stageDistribution,
    };
  },

  /**
   * Get analyses by production stage
   */
  async getAnalysesByStage(stage: string): Promise<ViralAnalysis[]> {
    let stageFilter: string[];

    switch (stage) {
      case 'planning':
        stageFilter = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];
        break;
      case 'shooting':
        stageFilter = ['SHOOTING'];
        break;
      case 'ready_for_edit':
        stageFilter = ['READY_FOR_EDIT', 'SHOOT_REVIEW'];
        break;
      case 'editing':
        stageFilter = ['EDITING'];
        break;
      case 'edit_review':
        stageFilter = ['EDIT_REVIEW'];
        break;
      case 'ready_to_post':
        stageFilter = ['READY_TO_POST', 'FINAL_REVIEW'];
        break;
      case 'posted':
        stageFilter = ['POSTED'];
        break;
      default:
        stageFilter = [stage.toUpperCase()];
    }

    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        profiles:user_id (email, full_name, avatar_url),
        profile:profile_list (id, name, platform),
        assignments:project_assignments (
          id, role,
          user:profiles!project_assignments_user_id_fkey (id, email, full_name)
        )
      `)
      .eq('status', 'APPROVED')
      .in('production_stage', stageFilter)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const stageAnalyses = (data || []) as any[];
    return stageAnalyses.map((analysis: any) => ({
      ...analysis,
      email: analysis.profiles?.email,
      full_name: analysis.profiles?.full_name,
      avatar_url: analysis.profiles?.avatar_url,
      videographer: analysis.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: analysis.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
    })) as ViralAnalysis[];
  },

  /**
   * Approve edited video - move from EDIT_REVIEW to READY_TO_POST
   */
  async approveEditedVideo(analysisId: string, notes?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
      production_stage: 'READY_TO_POST',
    };

    if (notes) {
      const { data: currentProject } = await supabase
        .from('viral_analyses')
        .select('production_notes')
        .eq('id', analysisId)
        .single();

      const projectInfo = currentProject as { production_notes?: string } | null;
      const existingNotes = projectInfo?.production_notes || '';
      updateData.production_notes = existingNotes
        ? `${existingNotes}\n\n[Admin Edit Approval]\n${notes}`
        : `[Admin Edit Approval]\n${notes}`;
    }

    const { error } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', analysisId);

    if (error) throw error;
  },

  /**
   * Reject edited video - move from EDIT_REVIEW back to EDITING
   */
  async rejectEditedVideo(analysisId: string, reason: string): Promise<void> {
    if (!reason) throw new Error('Rejection reason is required');

    const { data: currentProject } = await supabase
      .from('viral_analyses')
      .select('production_notes, disapproval_count')
      .eq('id', analysisId)
      .single();

    const projectInfo = currentProject as { production_notes?: string; disapproval_count?: number } | null;
    const existingNotes = projectInfo?.production_notes || '';
    const newNotes = existingNotes
      ? `${existingNotes}\n\n[Edit Rejected]\n${reason}`
      : `[Edit Rejected]\n${reason}`;

    const { error } = await supabase
      .from('viral_analyses')
      .update({
        production_stage: 'EDITING',
        production_notes: newNotes,
        disapproval_count: (projectInfo?.disapproval_count || 0) + 1,
        last_disapproved_at: new Date().toISOString(),
        disapproval_reason: reason,
      })
      .eq('id', analysisId);

    if (error) throw error;
  },

  /**
   * Get skips for a project (who skipped it)
   */
  async getProjectSkips(analysisId: string): Promise<{ id: string; user_id: string; role: string; skipped_at: string; full_name?: string; email?: string }[]> {
    const { data, error } = await supabase
      .from('project_skips')
      .select('id, user_id, role, skipped_at')
      .eq('analysis_id', analysisId)
      .order('skipped_at', { ascending: false });

    if (error) throw error;

    const skips = (data || []) as { id: string; user_id: string; role: string; skipped_at: string }[];
    if (skips.length === 0) return [];

    // Fetch user profiles for skip entries
    const userIds = [...new Set(skips.map(s => s.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const profileMap = new Map(Array.isArray(profiles) ? profiles.map((p: any) => [p.id, p]) : []);

    return skips.map(s => ({
      ...s,
      full_name: (profileMap.get(s.user_id) as any)?.full_name,
      email: (profileMap.get(s.user_id) as any)?.email,
    }));
  },

  /**
   * Remove a skip (re-assign project to user's available list)
   */
  async removeSkip(skipId: string): Promise<void> {
    const { error } = await supabase
      .from('project_skips')
      .delete()
      .eq('id', skipId);

    if (error) throw error;
  },

  /**
   * Create a new team member (Admin only)
   */
  async createUser(email: string, fullName: string, role: string, pin?: string): Promise<{ success: boolean; user: any }> {
    const token = auth.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
    const body: Record<string, string> = { email, fullName, role: role.toUpperCase() };
    if (pin) body.pin = pin;

    const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to create user');
    }

    return res.json();
  },

  /**
   * Delete a team member (Admin only)
   */
  async deleteUser(userId: string): Promise<{ success: boolean }> {
    const token = auth.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
    const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to delete user');
    }

    return { success: true };
  },

  /**
   * Reset a user's PIN (Admin only)
   */
  async resetUserPin(userId: string, pin?: string): Promise<{ success: boolean }> {
    const token = auth.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
    const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/reset-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(pin ? { pin } : {}),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to reset PIN');
    }

    return { success: true };
  },

  /**
   * Update a user's role (Admin only)
   */
  async updateUserRole(userId: string, role: string): Promise<{ success: boolean }> {
    const token = auth.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
    const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to update role');
    }

    return { success: true };
  },

  /**
   * Delete a project/analysis (Admin only)
   * Cascades to production_files, project_assignments, project_skips
   */
  async deleteProject(analysisId: string): Promise<void> {
    const { error } = await supabase
      .from('viral_analyses')
      .delete()
      .eq('id', analysisId);

    if (error) throw error;
  },
};
