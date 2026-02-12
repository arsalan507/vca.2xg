/**
 * Posting Manager Service - Posting Manager API
 *
 * Handles:
 * - Fetching projects ready to post (READY_TO_POST stage)
 * - Setting posting details (platform, caption, heading, hashtags)
 * - Marking projects as posted with live URL
 * - Calendar/schedule management
 */

import { supabase, auth } from '@/lib/api';
import type { ViralAnalysis } from '@/types';

export interface PostingStats {
  readyToPost: number;
  scheduledToday: number;
  postedThisWeek: number;
  postedThisMonth: number;
}

export interface SetPostingDetailsData {
  analysisId: string;
  postingPlatform: string;
  postingCaption: string;
  postingHeading?: string;
  postingHashtags?: string[];
  scheduledPostTime?: string;
}

export interface MarkAsPostedData {
  analysisId: string;
  postedUrl: string;
  keepInQueue?: boolean;  // If true, keeps project in queue for posting to more platforms
}

// Edited file types for video preview
const EDITED_FILE_TYPES = ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'];

export const postingManagerService = {
  /**
   * Get projects ready to post (READY_TO_POST stage)
   */
  async getReadyToPostProjects(): Promise<ViralAnalysis[]> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name, platform),
        profiles:user_id(email, full_name, avatar_url),
        assignments:project_assignments(
          id, role,
          user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url)
        )
      `)
      .eq('status', 'APPROVED')
      .eq('production_stage', 'READY_TO_POST')
      .order('scheduled_post_time', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false })
      .order('deadline', { ascending: true });

    if (error) throw error;

    const projects = (data || []) as any[];

    // Fetch production files separately (PostgREST schema cache missing FK)
    if (projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);
      const { data: allFiles } = await supabase
        .from('production_files')
        .select('*')
        .in('analysis_id', projectIds);

      const filesByAnalysis = new Map<string, any[]>();
      for (const file of (allFiles || []) as any[]) {
        const existing = filesByAnalysis.get(file.analysis_id) || [];
        existing.push(file);
        filesByAnalysis.set(file.analysis_id, existing);
      }
      for (const project of projects) {
        project.production_files = filesByAnalysis.get(project.id) || [];
      }
    }

    return projects.map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: project.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
    })) as ViralAnalysis[];
  },

  /**
   * Get scheduled posts for calendar view
   */
  async getScheduledPosts(startDate?: string, endDate?: string): Promise<ViralAnalysis[]> {
    let query = supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name, platform),
        profiles:user_id(email, full_name, avatar_url),
        assignments:project_assignments(
          id, role,
          user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url)
        )
      `)
      .eq('status', 'APPROVED')
      .in('production_stage', ['READY_TO_POST', 'POSTED'])
      .not('scheduled_post_time', 'is', null);

    if (startDate) {
      query = query.gte('scheduled_post_time', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_post_time', endDate);
    }

    const { data, error } = await query.order('scheduled_post_time', { ascending: true });

    if (error) throw error;

    const scheduledList = (data || []) as any[];
    return scheduledList.map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: project.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
    })) as ViralAnalysis[];
  },

  /**
   * Get posted projects
   */
  async getPostedProjects(limit: number = 50): Promise<ViralAnalysis[]> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name, platform),
        profiles:user_id(email, full_name, avatar_url),
        assignments:project_assignments(
          id, role,
          user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url)
        )
      `)
      .eq('status', 'APPROVED')
      .eq('production_stage', 'POSTED')
      .order('posted_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const postedList = (data || []) as any[];
    return postedList.map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: project.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
    })) as ViralAnalysis[];
  },

  /**
   * Get posting stats for dashboard
   */
  async getPostingStats(): Promise<PostingStats> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Ready to post count
    const { count: readyToPost } = await supabase
      .from('viral_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'APPROVED')
      .eq('production_stage', 'READY_TO_POST');

    // Scheduled for today
    const { count: scheduledToday } = await supabase
      .from('viral_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'APPROVED')
      .eq('production_stage', 'READY_TO_POST')
      .gte('scheduled_post_time', startOfDay)
      .lt('scheduled_post_time', endOfDay);

    // Posted this week
    const { count: postedThisWeek } = await supabase
      .from('viral_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('production_stage', 'POSTED')
      .gte('posted_at', startOfWeek);

    // Posted this month
    const { count: postedThisMonth } = await supabase
      .from('viral_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('production_stage', 'POSTED')
      .gte('posted_at', startOfMonth);

    return {
      readyToPost: readyToPost || 0,
      scheduledToday: scheduledToday || 0,
      postedThisWeek: postedThisWeek || 0,
      postedThisMonth: postedThisMonth || 0,
    };
  },

  /**
   * Get a single project by ID with full details
   */
  async getProjectById(analysisId: string): Promise<ViralAnalysis> {
    const [projectResult, filesResult] = await Promise.all([
      supabase
        .from('viral_analyses')
        .select(`
          *,
          industry:industries(id, name, short_code),
          profile:profile_list(id, name, platform),
          profiles:user_id(email, full_name, avatar_url),
          assignments:project_assignments(
            id, role,
            user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url)
          )
        `)
        .eq('id', analysisId)
        .single(),
      supabase
        .from('production_files')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false }),
    ]);

    if (projectResult.error) throw projectResult.error;

    const analysis = projectResult.data as any;
    return {
      ...analysis,
      email: analysis.profiles?.email,
      full_name: analysis.profiles?.full_name,
      avatar_url: analysis.profiles?.avatar_url,
      videographer: analysis.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: analysis.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: analysis.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
      production_files: (filesResult.data || []) as any[],
    } as ViralAnalysis;
  },

  /**
   * Set posting details (platform, caption, heading, hashtags, schedule)
   */
  async setPostingDetails(data: SetPostingDetailsData): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate required fields
    if (!data.postingPlatform) {
      throw new Error('Platform selection is required');
    }
    if (!data.postingCaption) {
      throw new Error('Caption is required');
    }

    // YouTube and TikTok require heading
    const requiresHeading = ['YOUTUBE_SHORTS', 'YOUTUBE_VIDEO', 'TIKTOK', 'youtube_shorts', 'youtube_long'].includes(data.postingPlatform);
    if (requiresHeading && !data.postingHeading) {
      throw new Error('Heading/title is required for YouTube and TikTok posts');
    }

    const updateData: Record<string, unknown> = {
      posting_platform: data.postingPlatform,
      posting_caption: data.postingCaption,
    };

    if (data.postingHeading) {
      updateData.posting_heading = data.postingHeading;
    }
    if (data.postingHashtags && data.postingHashtags.length > 0) {
      updateData.posting_hashtags = data.postingHashtags;
    }
    if (data.scheduledPostTime) {
      updateData.scheduled_post_time = data.scheduledPostTime;
    }

    const { error } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', data.analysisId);

    if (error) throw error;

    // Assign posting manager if not already assigned
    const { data: existingAssignment, error: assignCheckError } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('analysis_id', data.analysisId)
      .eq('role', 'POSTING_MANAGER')
      .maybeSingle();

    if (assignCheckError) {
      console.error('Failed to check posting manager assignment:', assignCheckError);
    }
    if (!existingAssignment) {
      const { error: insertError } = await supabase.from('project_assignments').insert({
        analysis_id: data.analysisId,
        user_id: user.id,
        role: 'POSTING_MANAGER',
        assigned_by: user.id,
      });
      if (insertError) {
        console.error('Failed to assign posting manager:', insertError);
      }
    }

    return this.getProjectById(data.analysisId);
  },

  /**
   * Schedule a post for a specific date/time
   */
  async schedulePost(analysisId: string, scheduledTime: string): Promise<ViralAnalysis> {
    const { error } = await supabase
      .from('viral_analyses')
      .update({
        scheduled_post_time: scheduledTime,
      })
      .eq('id', analysisId);

    if (error) throw error;

    return this.getProjectById(analysisId);
  },

  /**
   * Mark project as posted with the live URL
   */
  async markAsPosted(data: MarkAsPostedData): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate posted URL
    if (!data.postedUrl) {
      throw new Error('Posted URL is required');
    }

    // Basic URL validation
    try {
      new URL(data.postedUrl);
    } catch {
      throw new Error('Please enter a valid URL');
    }

    if (data.keepInQueue) {
      // Keep project in queue for posting to more platforms
      const { data: currentProject } = await supabase
        .from('viral_analyses')
        .select('posted_urls')
        .eq('id', data.analysisId)
        .single();

      const projectInfo = currentProject as { posted_urls?: any[] } | null;
      const existingUrls = projectInfo?.posted_urls || [];
      const newPost = {
        url: data.postedUrl,
        posted_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('viral_analyses')
        .update({
          posted_urls: [...existingUrls, newPost],
          posting_platform: null,
          posting_caption: null,
          posting_heading: null,
          posting_hashtags: null,
          scheduled_post_time: null,
        })
        .eq('id', data.analysisId);

      if (error) throw error;
    } else {
      // Final post - move to POSTED stage
      const { error } = await supabase
        .from('viral_analyses')
        .update({
          production_stage: 'POSTED',
          posted_url: data.postedUrl,
          posted_at: new Date().toISOString(),
          production_completed_at: new Date().toISOString(),
        })
        .eq('id', data.analysisId);

      if (error) throw error;
    }

    return this.getProjectById(data.analysisId);
  },

  /**
   * Get edited video files for a project (for preview before posting)
   */
  async getEditedVideoFiles(analysisId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('production_files')
      .select('*')
      .eq('analysis_id', analysisId)
      .in('file_type', EDITED_FILE_TYPES)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
  },
};
