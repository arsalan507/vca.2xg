/**
 * Videographer Service - Videographer API
 *
 * Handles:
 * - Fetching available projects (PLANNING stage)
 * - Picking projects (assign self, move to SHOOTING)
 * - Managing my projects (SHOOTING, READY_FOR_EDIT)
 * - Marking shooting complete
 */

import { supabase, auth } from '@/lib/api';
import type { ViralAnalysis } from '@/types';

export interface VideographerStats {
  activeShoots: number;      // Currently shooting
  totalShoots: number;       // All my projects ever
  scripts: number;           // Scripts I submitted
  completed: number;         // Completed shoots
  available: number;         // Available to pick
}

export interface PickProjectData {
  analysisId: string;
  profileId?: string;
  deadline?: string;
}

export const videographerService = {
  /**
   * Get available projects in PLANNING stage
   * These are approved scripts waiting to be picked by a videographer
   */
  async getAvailableProjects(): Promise<ViralAnalysis[]> {
    // Define valid planning stages
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];

    // Run all independent queries in parallel
    const [assignedResult, projectsResult, userResult] = await Promise.all([
      // Get IDs of projects that already have a videographer assigned
      supabase
        .from('project_assignments')
        .select('analysis_id')
        .eq('role', 'VIDEOGRAPHER'),
      // Fetch approved projects in planning stages (server-side filter)
      supabase
        .from('viral_analyses')
        .select(`
          *,
          industry:industries(id, name, short_code),
          profile:profile_list(id, name, platform),
          profiles:user_id(email, full_name, avatar_url)
        `)
        .eq('status', 'APPROVED')
        .in('production_stage', planningStages)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false }),
      // Get current user for skips
      auth.getUser(),
    ]);

    if (projectsResult.error) throw projectsResult.error;

    const assignedList = (assignedResult.data || []) as { analysis_id: string }[];
    const assignedIds = new Set(assignedList.map((a) => a.analysis_id));

    // Also fetch projects with NULL production_stage (not yet set)
    const { data: nullStageData } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name, platform),
        profiles:user_id(email, full_name, avatar_url)
      `)
      .eq('status', 'APPROVED')
      .is('production_stage', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    const projects = [...(Array.isArray(projectsResult.data) ? projectsResult.data : []), ...(Array.isArray(nullStageData) ? nullStageData : [])] as any[];

    // Filter out projects that already have a videographer
    const availableProjects = projects.filter((project: any) => !assignedIds.has(project.id));

    // Get skipped projects
    const user = userResult.data?.user;
    let skippedIds = new Set<string>();
    if (user) {
      const { data: skips } = await supabase
        .from('project_skips')
        .select('analysis_id')
        .eq('user_id', user.id)
        .eq('role', 'VIDEOGRAPHER');
      skippedIds = new Set(Array.isArray(skips) ? skips.map((s: any) => s.analysis_id) : []);
    }

    return availableProjects
      .filter((p: any) => !skippedIds.has(p.id))
      .map((project: any) => ({
        ...project,
        email: project.profiles?.email,
        full_name: project.profiles?.full_name,
        avatar_url: project.profiles?.avatar_url,
      })) as ViralAnalysis[];
  },

  /**
   * Get my assigned projects (as videographer)
   */
  async getMyProjects(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get my assignments as videographer
    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'VIDEOGRAPHER');

    if (assignError) throw assignError;
    const assignmentsList = (assignments || []) as { analysis_id: string }[];
    if (assignmentsList.length === 0) return [];

    const analysisIds = assignmentsList.map((a) => a.analysis_id);

    // Fetch projects and production files in parallel
    // (PostgREST embedded query production_files(*) returns undefined — schema cache missing FK)
    const [projectsResult, filesResult] = await Promise.all([
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
        .in('id', analysisIds)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('production_files')
        .select('*')
        .in('analysis_id', analysisIds),
    ]);

    if (projectsResult.error) throw projectsResult.error;

    // Group files by analysis_id
    const filesByAnalysis = new Map<string, any[]>();
    for (const file of (filesResult.data || []) as any[]) {
      const existing = filesByAnalysis.get(file.analysis_id) || [];
      existing.push(file);
      filesByAnalysis.set(file.analysis_id, existing);
    }

    const projectList = (projectsResult.data || []) as any[];
    return projectList.map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      production_files: filesByAnalysis.get(project.id) || [],
    })) as ViralAnalysis[];
  },

  /**
   * Get scripts I submitted (analyses I created)
   */
  async getMyScripts(): Promise<ViralAnalysis[]> {
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
   * Get stats for dashboard
   */
  async getMyStats(): Promise<VideographerStats> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get my assignment IDs first (lightweight)
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'VIDEOGRAPHER');

    const myIds = ((assignments || []) as { analysis_id: string }[]).map((a) => a.analysis_id);

    // Run all count queries in parallel (no full data fetches)
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];
    const completedStages = ['READY_FOR_EDIT', 'EDITING', 'EDIT_REVIEW', 'READY_TO_POST', 'POSTED'];

    const [
      availableResult,
      availableNullResult,
      assignedVidsResult,
      activeResult,
      completedResult,
      scriptsResult,
    ] = await Promise.all([
      // Count available projects (approved + planning stage)
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED').in('production_stage', planningStages),
      // Count available projects with null stage
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED').is('production_stage', null),
      // Count projects that already have a videographer (to subtract)
      supabase.from('project_assignments').select('id', { count: 'exact', head: true })
        .eq('role', 'VIDEOGRAPHER'),
      // Active shoots (my projects in SHOOTING)
      myIds.length > 0
        ? supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
            .in('id', myIds).eq('production_stage', 'SHOOTING')
        : Promise.resolve({ count: 0 }),
      // Completed (my projects past SHOOTING)
      myIds.length > 0
        ? supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
            .in('id', myIds).in('production_stage', completedStages)
        : Promise.resolve({ count: 0 }),
      // Scripts I submitted
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    // Available ≈ (planning + null_stage) - already_assigned (rough count, good enough for stats)
    const roughAvailable = Math.max(0,
      (availableResult.count || 0) + (availableNullResult.count || 0) - (assignedVidsResult.count || 0)
    );

    return {
      activeShoots: activeResult.count || 0,
      totalShoots: myIds.length,
      scripts: scriptsResult.count || 0,
      completed: completedResult.count || 0,
      available: roughAvailable,
    };
  },

  /**
   * Get a single project by ID with full details
   */
  async getProjectById(analysisId: string): Promise<ViralAnalysis> {
    // Fetch project and production files in parallel
    // (PostgREST embedded query production_files(*) returns undefined — schema cache missing FK)
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
   * Pick a project from the PLANNING queue
   */
  async pickProject(data: PickProjectData): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if project is still available
    const { data: project, error: fetchError } = await supabase
      .from('viral_analyses')
      .select('id, production_stage, content_id, profile_id')
      .eq('id', data.analysisId)
      .single();

    if (fetchError) throw fetchError;

    const projectData = project as { id: string; production_stage?: string; content_id?: string; profile_id?: string };
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];
    const isInPlanningStage = planningStages.includes(projectData.production_stage || '') || !projectData.production_stage;
    if (!isInPlanningStage) {
      throw new Error('This project is no longer available');
    }

    // Check if already assigned
    const { data: existingAssignment, error: assignCheckError } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('analysis_id', data.analysisId)
      .eq('role', 'VIDEOGRAPHER')
      .maybeSingle();

    if (assignCheckError) {
      throw new Error('Failed to check project availability');
    }
    if (existingAssignment) {
      throw new Error('This project has already been picked');
    }

    // Generate content_id if profile provided and not already set
    if (data.profileId && !projectData.content_id) {
      await supabase.rpc('generate_content_id_on_approval', {
        p_analysis_id: data.analysisId,
        p_profile_id: data.profileId,
      });
    }

    // Update the analysis
    const updateData: Record<string, unknown> = {
      production_stage: 'SHOOTING',
      production_started_at: new Date().toISOString(),
    };

    if (data.profileId) {
      updateData.profile_id = data.profileId;
    }

    if (data.deadline) {
      updateData.deadline = data.deadline;
    }

    const { error: updateError } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', data.analysisId);

    if (updateError) throw updateError;

    // Assign videographer — rollback stage on failure
    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .insert({
        analysis_id: data.analysisId,
        user_id: user.id,
        role: 'VIDEOGRAPHER',
        assigned_by: user.id,
      });

    if (assignmentError) {
      // Rollback: revert production_stage and clear started_at
      const rollbackData: Record<string, unknown> = {
        production_stage: projectData.production_stage || 'PLANNING',
        production_started_at: null,
      };
      if (data.profileId) rollbackData.profile_id = projectData.profile_id || null;
      await supabase.from('viral_analyses')
        .update(rollbackData)
        .eq('id', data.analysisId);
      throw assignmentError;
    }

    return this.getProjectById(data.analysisId);
  },

  /**
   * Mark shooting as complete - move to READY_FOR_EDIT
   */
  async markShootingComplete(analysisId: string, productionNotes?: string): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // File verification is done by the UI before calling this method
    // (UploadPage checks existingFiles.length > 0)

    // Update the analysis
    const updateData: Record<string, unknown> = {
      production_stage: 'READY_FOR_EDIT',
    };

    if (productionNotes) {
      // Get current notes and append instead of overwriting
      const { data: currentProject } = await supabase
        .from('viral_analyses')
        .select('production_notes')
        .eq('id', analysisId)
        .single();

      const projectInfo = currentProject as { production_notes?: string } | null;
      const existingNotes = projectInfo?.production_notes || '';
      updateData.production_notes = existingNotes
        ? `${existingNotes}\n\n[Videographer Notes]\n${productionNotes}`
        : `[Videographer Notes]\n${productionNotes}`;
    }

    const { error: updateError } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', analysisId);

    if (updateError) throw updateError;

    return this.getProjectById(analysisId);
  },

  /**
   * Get content profiles list
   */
  async getProfiles(): Promise<{ id: string; name: string; platform?: string; is_active?: boolean }[]> {
    const { data, error } = await supabase
      .from('profile_list')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as { id: string; name: string; platform?: string; is_active?: boolean }[];
  },

  /**
   * Create a new content profile
   */
  async createProfile(name: string, platform: string = 'INSTAGRAM'): Promise<{ id: string; name: string; platform?: string }> {
    const { data, error } = await supabase
      .from('profile_list')
      .insert({ name, platform })
      .select()
      .single();

    if (error) throw error;
    return data as { id: string; name: string; platform?: string };
  },

  /**
   * Delete a content profile (soft delete - sets is_active to false)
   */
  async deleteProfile(profileId: string): Promise<void> {
    const { error } = await supabase
      .from('profile_list')
      .update({ is_active: false })
      .eq('id', profileId);

    if (error) throw error;
  },

  /**
   * Skip a project - persisted to database so it syncs across devices
   */
  async rejectProject(analysisId: string): Promise<void> {
    const { data: { user } } = await auth.getUser();
    if (!user) return;

    await supabase
      .from('project_skips')
      .upsert({
        analysis_id: analysisId,
        user_id: user.id,
        role: 'VIDEOGRAPHER',
      }, { onConflict: 'analysis_id,user_id' });
  },

  async unrejectProject(analysisId: string): Promise<void> {
    const { data: { user } } = await auth.getUser();
    if (!user) return;

    await supabase
      .from('project_skips')
      .delete()
      .eq('analysis_id', analysisId)
      .eq('user_id', user.id);
  },
};
