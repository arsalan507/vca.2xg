/**
 * Editor Service - Editor API
 *
 * Handles:
 * - Fetching available projects (READY_FOR_EDIT stage with raw files)
 * - Picking projects (assign self, move to EDITING)
 * - Managing my projects (EDITING, READY_TO_POST)
 * - Marking editing complete
 */

import { supabase, auth } from '@/lib/api';
import type { ViralAnalysis } from '@/types';

export interface EditorStats {
  inProgress: number;
  available: number;
  completed: number;
}

export interface PickEditProjectData {
  analysisId: string;
}

export interface MarkEditingCompleteData {
  analysisId: string;
  productionNotes?: string;
}

// Raw file types that indicate footage is ready for editing
const RAW_FILE_TYPES = ['RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER', 'raw-footage'];

// Edited file types that indicate editing is complete
const EDITED_FILE_TYPES = ['EDITED_VIDEO', 'FINAL_VIDEO', 'edited-video', 'final-video'];

export const editorService = {
  /**
   * Get available projects in READY_FOR_EDIT stage
   * Only includes projects that have raw footage and no editor assigned
   */
  async getAvailableProjects(): Promise<ViralAnalysis[]> {
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
      .eq('production_stage', 'READY_FOR_EDIT')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const projects = (data || []) as any[];
    if (projects.length === 0) return [];

    // Fetch production files separately (PostgREST embedded query doesn't work)
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

    // Attach files to projects
    for (const project of projects) {
      project.production_files = filesByAnalysis.get(project.id) || [];
    }

    // Filter: Only projects without an editor AND with raw footage
    const availableProjects = projects.filter((project: any) => {
      const hasEditor = project.assignments?.some(
        (a: any) => a.role === 'EDITOR'
      );
      if (hasEditor) return false;

      const hasRawFiles = project.production_files?.some(
        (f: any) => RAW_FILE_TYPES.includes(f.file_type) && !f.is_deleted
      );
      return hasRawFiles;
    });

    // Get skipped projects from database
    const { data: { user } } = await auth.getUser();
    let skippedIds = new Set<string>();
    if (user) {
      const { data: skips } = await supabase
        .from('project_skips')
        .select('analysis_id')
        .eq('user_id', user.id)
        .eq('role', 'EDITOR');
      skippedIds = new Set(Array.isArray(skips) ? skips.map((s: any) => s.analysis_id) : []);
    }

    return availableProjects
      .filter((p: any) => !skippedIds.has(p.id))
      .map((project: any) => ({
        ...project,
        email: project.profiles?.email,
        full_name: project.profiles?.full_name,
        avatar_url: project.profiles?.avatar_url,
        videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      })) as ViralAnalysis[];
  },

  /**
   * Get my assigned projects (as editor)
   */
  async getMyProjects(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get my assignments as editor
    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'EDITOR');

    if (assignError) throw assignError;
    const assignmentsList = (assignments || []) as { analysis_id: string }[];
    if (assignmentsList.length === 0) return [];

    const analysisIds = assignmentsList.map((a) => a.analysis_id);

    // Fetch projects and production files in parallel
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
      posting_manager: project.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
      production_files: filesByAnalysis.get(project.id) || [],
    })) as ViralAnalysis[];
  },

  /**
   * Get stats for dashboard
   */
  async getMyStats(): Promise<EditorStats> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get my assignment IDs first (lightweight)
    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'EDITOR');

    if (assignError) throw assignError;
    const assignmentsList = (assignments || []) as { analysis_id: string }[];
    const myIds = assignmentsList.map((a) => a.analysis_id);

    // Run all count queries in parallel (no full data fetches)
    const [availableCountResult, assignedEditorsResult, inProgressResult, completedResult] = await Promise.all([
      // Count READY_FOR_EDIT projects (rough available count)
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED').eq('production_stage', 'READY_FOR_EDIT'),
      // Count projects that already have an editor (to subtract)
      supabase.from('project_assignments').select('id', { count: 'exact', head: true })
        .eq('role', 'EDITOR'),
      // My in-progress edits
      myIds.length > 0
        ? supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).in('id', myIds).eq('production_stage', 'EDITING')
        : Promise.resolve({ count: 0 }),
      // My completed edits
      myIds.length > 0
        ? supabase.from('viral_analyses').select('id', { count: 'exact', head: true }).in('id', myIds).in('production_stage', ['EDIT_REVIEW', 'READY_TO_POST', 'POSTED'])
        : Promise.resolve({ count: 0 }),
    ]);

    // Available ≈ READY_FOR_EDIT count - assigned editors (rough, good enough for stats)
    const roughAvailable = Math.max(0,
      (availableCountResult.count || 0) - (assignedEditorsResult.count || 0)
    );

    return {
      inProgress: inProgressResult.count || 0,
      available: roughAvailable,
      completed: completedResult.count || 0,
    };
  },

  /**
   * Get homepage data in a single call (stats + projects combined)
   * Avoids duplicate project_assignments query that getMyStats + getMyProjects make separately
   */
  async getHomepageData(): Promise<{ stats: EditorStats; projects: ViralAnalysis[] }> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Single assignments fetch (shared between stats + projects)
    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'EDITOR');

    if (assignError) throw assignError;
    const assignmentsList = (assignments || []) as { analysis_id: string }[];
    const myIds = assignmentsList.map((a) => a.analysis_id);

    // 2. Run stats counts + project data in parallel
    const [
      availableCountResult,
      assignedEditorsResult,
      projectsResult,
      filesResult,
    ] = await Promise.all([
      // Stats: count READY_FOR_EDIT
      supabase.from('viral_analyses').select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED').eq('production_stage', 'READY_FOR_EDIT'),
      // Stats: count assigned editors
      supabase.from('project_assignments').select('id', { count: 'exact', head: true })
        .eq('role', 'EDITOR'),
      // Projects: full data
      myIds.length > 0
        ? supabase
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
            .in('id', myIds)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // Files for all projects
      myIds.length > 0
        ? supabase.from('production_files').select('*').in('analysis_id', myIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Calculate stats from fetched data
    const projectList = (projectsResult.data || []) as any[];
    const inProgress = projectList.filter((p: any) => p.production_stage === 'EDITING').length;
    const completed = projectList.filter((p: any) =>
      ['EDIT_REVIEW', 'READY_TO_POST', 'POSTED'].includes(p.production_stage || '')
    ).length;
    const roughAvailable = Math.max(0,
      (availableCountResult.count || 0) - (assignedEditorsResult.count || 0)
    );

    // Attach files to projects
    const filesByAnalysis = new Map<string, any[]>();
    for (const file of (filesResult.data || []) as any[]) {
      const existing = filesByAnalysis.get(file.analysis_id) || [];
      existing.push(file);
      filesByAnalysis.set(file.analysis_id, existing);
    }

    const projects = projectList.map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: project.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
      production_files: filesByAnalysis.get(project.id) || [],
    })) as ViralAnalysis[];

    return {
      stats: { inProgress, available: roughAvailable, completed },
      projects,
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
   * Pick a project from the READY_FOR_EDIT queue
   */
  async pickProject(data: PickEditProjectData): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if project is still available
    const { data: project, error: fetchError } = await supabase
      .from('viral_analyses')
      .select('id, production_stage')
      .eq('id', data.analysisId)
      .single();

    if (fetchError) throw fetchError;

    const projectData = project as { id: string; production_stage?: string };
    if (projectData.production_stage !== 'READY_FOR_EDIT') {
      throw new Error('This project is no longer available for editing');
    }

    // Check if already assigned to an editor
    const { data: existingAssignment, error: assignCheckError } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('analysis_id', data.analysisId)
      .eq('role', 'EDITOR')
      .maybeSingle();

    if (assignCheckError) {
      throw new Error('Failed to check project availability');
    }
    if (existingAssignment) {
      throw new Error('This project has already been picked by another editor');
    }

    // Verify raw footage exists
    const { count: rawFilesCount } = await supabase
      .from('production_files')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_id', data.analysisId)
      .in('file_type', RAW_FILE_TYPES)
      .eq('is_deleted', false);

    if (!rawFilesCount || rawFilesCount === 0) {
      throw new Error('This project has no raw footage files');
    }

    // Update the analysis to EDITING stage
    const { error: updateError } = await supabase
      .from('viral_analyses')
      .update({
        production_stage: 'EDITING',
      })
      .eq('id', data.analysisId);

    if (updateError) throw updateError;

    // Assign editor to the project — rollback stage on failure
    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .insert({
        analysis_id: data.analysisId,
        user_id: user.id,
        role: 'EDITOR',
        assigned_by: user.id,
      });

    if (assignmentError) {
      // Rollback: revert production_stage back to READY_FOR_EDIT
      await supabase.from('viral_analyses')
        .update({ production_stage: 'READY_FOR_EDIT' })
        .eq('id', data.analysisId);
      throw assignmentError;
    }

    return this.getProjectById(data.analysisId);
  },

  /**
   * Mark editing as complete - move to EDIT_REVIEW for admin approval
   */
  async markEditingComplete(data: MarkEditingCompleteData): Promise<ViralAnalysis> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify edited files exist
    const { count: editedCount, error: countError } = await supabase
      .from('production_files')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_id', data.analysisId)
      .in('file_type', EDITED_FILE_TYPES)
      .eq('is_deleted', false);

    if (countError) throw new Error('Failed to verify files');
    if (!editedCount || editedCount === 0) {
      throw new Error('Please upload at least one edited video before marking as complete');
    }

    // Update the analysis - send to admin for edit review
    const updateData: Record<string, unknown> = {
      production_stage: 'EDIT_REVIEW',
    };

    if (data.productionNotes) {
      // Get current notes and append
      const { data: currentProject } = await supabase
        .from('viral_analyses')
        .select('production_notes')
        .eq('id', data.analysisId)
        .single();

      const projectInfo = currentProject as { production_notes?: string } | null;
      const existingNotes = projectInfo?.production_notes || '';
      updateData.production_notes = existingNotes
        ? `${existingNotes}\n\n[Editor Notes]\n${data.productionNotes}`
        : `[Editor Notes]\n${data.productionNotes}`;
    }

    const { error: updateError } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', data.analysisId);

    if (updateError) throw updateError;

    return this.getProjectById(data.analysisId);
  },

  /**
   * Get raw footage files for a project (for preview in editor)
   */
  async getRawFootageFiles(analysisId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('production_files')
      .select('*')
      .eq('analysis_id', analysisId)
      .in('file_type', RAW_FILE_TYPES)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
  },

  /**
   * Get edited files for a project
   */
  async getEditedFiles(analysisId: string): Promise<any[]> {
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
        role: 'EDITOR',
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
