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

// Card columns — includes script text fields so smartSearch can search them
const CARD_COLS = `id, title, content_id, platform, shoot_type, production_stage, priority, status,
  created_at, deadline, profile_id, industry_id, cast_composition, content_type, is_dissolved,
  hook, script_body, script_cta, production_notes, creator_name`;

export const videographerService = {
  /**
   * Get available projects in PLANNING stage
   * These are approved scripts waiting to be picked by a videographer
   */
  async getAvailableProjects(): Promise<ViralAnalysis[]> {
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];

    // All queries in parallel — combined planning+null stage into one OR query
    const [assignedResult, projectsResult, userResult] = await Promise.all([
      supabase.from('project_assignments').select('analysis_id').eq('role', 'VIDEOGRAPHER'),
      supabase.from('viral_analyses').select(`
          ${CARD_COLS},
          industry:industries(id, name, short_code),
          profile:profile_list(id, name, platform),
          profiles:user_id(email, full_name, avatar_url),
          character_tags:analysis_character_tags(character_tag:character_tags(id, name, color, is_active))
        `)
        .eq('status', 'APPROVED')
        .or(`production_stage.in.(${planningStages.join(',')}),production_stage.is.null`)
        .or('is_dissolved.eq.false,is_dissolved.is.null')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false }),
      auth.getUser(),
    ]);

    if (projectsResult.error) throw projectsResult.error;

    const assignedIds = new Set(((assignedResult.data || []) as { analysis_id: string }[]).map(a => a.analysis_id));

    // Get skipped projects
    const user = userResult.data?.user;
    let skippedIds = new Set<string>();
    if (user) {
      const { data: skips } = await supabase
        .from('project_skips').select('analysis_id')
        .eq('user_id', user.id).eq('role', 'VIDEOGRAPHER');
      skippedIds = new Set(Array.isArray(skips) ? skips.map((s: any) => s.analysis_id) : []);
    }

    return ((projectsResult.data || []) as any[])
      .filter((p: any) => !assignedIds.has(p.id) && !skippedIds.has(p.id))
      .map((project: any) => ({
        ...project,
        email: project.profiles?.email,
        full_name: project.profiles?.full_name,
        avatar_url: project.profiles?.avatar_url,
        character_tags: (project.character_tags || []).map((ct: any) => ct.character_tag).filter(Boolean),
      })) as ViralAnalysis[];
  },

  /**
   * Get my assigned projects (as videographer)
   */
  async getMyProjects(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'VIDEOGRAPHER');

    if (assignError) throw assignError;
    const assignmentsList = (assignments || []) as { analysis_id: string }[];
    if (assignmentsList.length === 0) return [];

    const analysisIds = assignmentsList.map((a) => a.analysis_id);

    // Fetch projects (minimal columns) and file counts in parallel
    const [projectsResult, filesResult] = await Promise.all([
      supabase.from('viral_analyses').select(`
          ${CARD_COLS},
          industry:industries(id, name, short_code),
          profile:profile_list(id, name, platform),
          profiles:user_id(email, full_name, avatar_url),
          assignments:project_assignments(
            id, role,
            user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url)
          ),
          character_tags:analysis_character_tags(character_tag:character_tags(id, name, color, is_active))
        `)
        .in('id', analysisIds)
        .or('is_dissolved.eq.false,is_dissolved.is.null')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false }),
      // Only fetch fields needed for file count display (not full file data)
      supabase.from('production_files')
        .select('id, analysis_id, is_deleted')
        .in('analysis_id', analysisIds),
    ]);

    if (projectsResult.error) throw projectsResult.error;

    const filesByAnalysis = new Map<string, any[]>();
    for (const file of (filesResult.data || []) as any[]) {
      const existing = filesByAnalysis.get(file.analysis_id) || [];
      existing.push(file);
      filesByAnalysis.set(file.analysis_id, existing);
    }

    return ((projectsResult.data || []) as any[]).map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      production_files: filesByAnalysis.get(project.id) || [],
      character_tags: (project.character_tags || []).map((ct: any) => ct.character_tag).filter(Boolean),
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
        ${CARD_COLS},
        industry:industries(id, name, short_code),
        profile:profile_list(id, name, platform)
      `)
      .eq('user_id', user.id)
      .or('is_dissolved.eq.false,is_dissolved.is.null')
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

    // Run all queries in parallel
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];
    const completedStages = ['READY_FOR_EDIT', 'EDITING', 'EDIT_REVIEW', 'READY_TO_POST', 'POSTED'];

    const [
      planningResult,
      nullStageResult,
      assignedVidsResult,
      activeResult,
      completedResult,
      scriptsResult,
    ] = await Promise.all([
      // Planning stage project IDs
      supabase.from('viral_analyses').select('id')
        .eq('status', 'APPROVED').in('production_stage', planningStages),
      // Null stage project IDs
      supabase.from('viral_analyses').select('id')
        .eq('status', 'APPROVED').is('production_stage', null),
      // All videographer assignment analysis_ids
      supabase.from('project_assignments').select('analysis_id')
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

    // Available = planning/null-stage projects that don't have a videographer assigned
    const vidProjectIds = new Set(
      ((assignedVidsResult.data || []) as { analysis_id: string }[]).map(a => a.analysis_id)
    );
    const allPlanningIds = [
      ...((planningResult.data || []) as { id: string }[]),
      ...((nullStageResult.data || []) as { id: string }[]),
    ];
    const availableCount = allPlanningIds.filter(p => !vidProjectIds.has(p.id)).length;

    return {
      activeShoots: activeResult.count || 0,
      totalShoots: myIds.length,
      scripts: scriptsResult.count || 0,
      completed: completedResult.count || 0,
      available: availableCount,
    };
  },

  /**
   * Get homepage data in a single optimized call (stats + projects + scripts + available).
   * Uses minimal column selection (CARD_COLS) instead of * to avoid fetching ~80 heavy text columns.
   * Skips production_files (not displayed on homepage).
   * Combines two available queries into one with OR filter.
   */
  async getHomepageData(): Promise<{
    stats: VideographerStats;
    projects: ViralAnalysis[];
    scripts: ViralAnalysis[];
    available: ViralAnalysis[];
  }> {
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];
    const completedStages = ['READY_FOR_EDIT', 'EDITING', 'EDIT_REVIEW', 'READY_TO_POST', 'POSTED'];

    // Round 1: Cached auth (~0ms after first validation)
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Round 2: Assignments + lightweight queries that don't depend on myIds (all parallel)
    const [myAssignments, allVidAssignments, myScriptsResult, availableResult, skipsResult] = await Promise.all([
      supabase.from('project_assignments').select('analysis_id')
        .eq('user_id', user.id).eq('role', 'VIDEOGRAPHER'),
      supabase.from('project_assignments').select('analysis_id')
        .eq('role', 'VIDEOGRAPHER'),
      // My scripts (minimal columns, no script_body)
      supabase.from('viral_analyses').select(`
        ${CARD_COLS}, profile:profile_list(id, name, platform)
      `).eq('user_id', user.id).or('is_dissolved.eq.false,is_dissolved.is.null').order('created_at', { ascending: false }),
      // Available projects (combined OR — one query instead of two, minimal columns)
      supabase.from('viral_analyses').select(`
        ${CARD_COLS}, profile:profile_list(id, name, platform),
        profiles:user_id(email, full_name, avatar_url)
      `).eq('status', 'APPROVED')
        .or(`production_stage.in.(${planningStages.join(',')}),production_stage.is.null`)
        .or('is_dissolved.eq.false,is_dissolved.is.null')
        .order('priority', { ascending: false }).order('created_at', { ascending: false }),
      // Skipped projects
      supabase.from('project_skips').select('analysis_id')
        .eq('user_id', user.id).eq('role', 'VIDEOGRAPHER'),
    ]);

    const myIds = ((myAssignments.data || []) as { analysis_id: string }[]).map(a => a.analysis_id);
    const allAssignedIds = new Set(((allVidAssignments.data || []) as { analysis_id: string }[]).map(a => a.analysis_id));

    // Round 3: Only the query that depends on myIds (minimal columns, NO production_files)
    const myProjectsResult = myIds.length > 0
      ? await supabase.from('viral_analyses').select(`
          ${CARD_COLS}, profile:profile_list(id, name, platform),
          profiles:user_id(email, full_name, avatar_url),
          assignments:project_assignments(id, role, user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url))
        `).in('id', myIds).or('is_dissolved.eq.false,is_dissolved.is.null').order('priority', { ascending: false }).order('created_at', { ascending: false })
      : { data: [], error: null };

    const projects = ((myProjectsResult.data || []) as any[]).map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
    })) as ViralAnalysis[];

    // Build available projects (filter out assigned + skipped)
    const skippedIds = new Set(((skipsResult.data || []) as any[]).map((s: any) => s.analysis_id));
    const available = ((availableResult.data || []) as any[])
      .filter((p: any) => !allAssignedIds.has(p.id) && !skippedIds.has(p.id))
      .map((project: any) => ({
        ...project,
        email: project.profiles?.email,
        full_name: project.profiles?.full_name,
        avatar_url: project.profiles?.avatar_url,
      })) as ViralAnalysis[];

    // Calculate stats from fetched data
    const activeShoots = projects.filter(p => p.production_stage === 'SHOOTING').length;
    const completed = projects.filter(p => completedStages.includes(p.production_stage || '')).length;

    return {
      stats: {
        activeShoots,
        totalShoots: projects.length,
        scripts: ((myScriptsResult.data || []) as any[]).length,
        completed,
        available: available.length,
      },
      projects,
      scripts: ((myScriptsResult.data || []) as ViralAnalysis[]),
      available,
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
          ),
          character_tags:analysis_character_tags(character_tag:character_tags(id, name, color, is_active))
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
      character_tags: (analysis.character_tags || []).map((ct: any) => ct.character_tag).filter(Boolean),
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
  async getProfiles(): Promise<{ id: string; name: string; code: string | null; platform?: string; is_active?: boolean }[]> {
    const { data, error } = await supabase
      .from('profile_list')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as { id: string; name: string; code: string | null; platform?: string; is_active?: boolean }[];
  },

  /**
   * Create a new content profile (videographer can create with CODE)
   */
  async createProfile(name: string, code: string, platform?: string): Promise<any> {
    const { data, error } = await supabase
      .from('profile_list')
      .insert({ name, code: code.toUpperCase(), platform: platform || null })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Hard delete a content profile (permanent deletion)
   */
  async deleteProfile(profileId: string): Promise<void> {
    const { error } = await supabase
      .from('profile_list')
      .delete()
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
