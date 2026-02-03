/**
 * Editor Queue Service - Workflow v2.0
 *
 * Handles:
 * - Fetching available projects from READY_FOR_EDIT queue (only with raw files)
 * - Picking a project for editing
 * - Marking editing as complete (transition to READY_TO_POST)
 */

import { supabase } from '@/lib/supabase';
import type { ViralAnalysis, PickEditProjectData, MarkEditingCompleteData } from '@/types';

export const editorQueueService = {
  /**
   * Get available projects in READY_FOR_EDIT stage
   * IMPORTANT: Only includes projects that have at least 1 raw footage file
   * Excludes projects that already have an editor assigned
   */
  async getAvailableProjects(): Promise<ViralAnalysis[]> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name),
        hook_tags:analysis_hook_tags(hook_tag:hook_tags(id, name)),
        character_tags:analysis_character_tags(character_tag:character_tags(id, name)),
        profiles:user_id(email, full_name, avatar_url),
        assignments:project_assignments(
          *,
          user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url, role)
        ),
        production_files(*)
      `)
      .eq('status', 'APPROVED')
      .eq('production_stage', 'READY_FOR_EDIT')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Filter: Only projects without an editor AND with raw footage
    const availableProjects = (data || []).filter((project: any) => {
      // Check if already has editor
      const hasEditor = project.assignments?.some(
        (a: any) => a.role === 'EDITOR'
      );
      if (hasEditor) return false;

      // Check if has raw footage files (support both legacy uppercase and current lowercase types)
      const rawFileTypes = ['RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER', 'raw-footage'];
      const hasRawFiles = project.production_files?.some(
        (f: any) => rawFileTypes.includes(f.file_type) && !f.is_deleted
      );
      return hasRawFiles;
    });

    // Transform the data
    return availableProjects.map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      hook_tags: project.hook_tags?.map((ht: any) => ht.hook_tag) || [],
      character_tags: project.character_tags?.map((ct: any) => ct.character_tag) || [],
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
    }));
  },

  /**
   * Pick a project for editing
   * - Assigns editor to the project
   * - Transitions to EDITING stage
   */
  async pickProject(data: PickEditProjectData): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if project is still available
    const { data: project, error: fetchError } = await supabase
      .from('viral_analyses')
      .select('id, production_stage')
      .eq('id', data.analysisId)
      .single();

    if (fetchError) throw fetchError;

    if (project.production_stage !== 'READY_FOR_EDIT') {
      throw new Error('This project is no longer available for editing');
    }

    // Check if already assigned to an editor
    const { data: existingAssignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('analysis_id', data.analysisId)
      .eq('role', 'EDITOR')
      .single();

    if (existingAssignment) {
      throw new Error('This project has already been picked by another editor');
    }

    // Check if project has raw footage (sanity check)
    const { count: rawFilesCount } = await supabase
      .from('production_files')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_id', data.analysisId)
      .in('file_type', ['RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER', 'raw-footage'])
      .eq('is_deleted', false);

    if (!rawFilesCount || rawFilesCount === 0) {
      throw new Error('This project has no raw footage files. Please wait for the videographer to upload files.');
    }

    // Update the analysis to EDITING stage
    const { error: updateError } = await supabase
      .from('viral_analyses')
      .update({
        production_stage: 'EDITING',
      })
      .eq('id', data.analysisId);

    if (updateError) throw updateError;

    // Assign editor to the project
    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .insert({
        analysis_id: data.analysisId,
        user_id: user.id,
        role: 'EDITOR',
        assigned_by: user.id,
      });

    if (assignmentError) throw assignmentError;

    return this.getProjectById(data.analysisId);
  },

  /**
   * Mark editing as complete
   * - Validates at least 1 edited video file exists
   * - Transitions to READY_TO_POST stage
   */
  async markEditingComplete(data: MarkEditingCompleteData): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if project has edited video files
    const { data: hasFiles, error: checkError } = await supabase.rpc(
      'has_edited_video',
      { p_analysis_id: data.analysisId }
    );

    if (checkError) {
      console.error('Error checking edited video:', checkError);
      // Fallback: check manually
      const { count } = await supabase
        .from('production_files')
        .select('id', { count: 'exact', head: true })
        .eq('analysis_id', data.analysisId)
        .in('file_type', ['EDITED_VIDEO', 'FINAL_VIDEO'])
        .eq('is_deleted', false);

      if (!count || count === 0) {
        throw new Error('Please upload at least one edited video before marking as complete');
      }
    } else if (!hasFiles) {
      throw new Error('Please upload at least one edited video before marking as complete');
    }

    // Update the analysis
    const updateData: any = {
      production_stage: 'READY_TO_POST',
    };

    if (data.productionNotes) {
      // Append to existing notes
      const { data: currentProject } = await supabase
        .from('viral_analyses')
        .select('production_notes')
        .eq('id', data.analysisId)
        .single();

      const existingNotes = currentProject?.production_notes || '';
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
   * Get a single project by ID with full details
   */
  async getProjectById(analysisId: string): Promise<ViralAnalysis> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name),
        hook_tags:analysis_hook_tags(hook_tag:hook_tags(id, name)),
        character_tags:analysis_character_tags(character_tag:character_tags(id, name)),
        profiles:user_id(email, full_name, avatar_url),
        assignments:project_assignments(
          *,
          user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url, role)
        ),
        production_files(*)
      `)
      .eq('id', analysisId)
      .single();

    if (error) throw error;

    return {
      ...data,
      email: data.profiles?.email,
      full_name: data.profiles?.full_name,
      avatar_url: data.profiles?.avatar_url,
      hook_tags: data.hook_tags?.map((ht: any) => ht.hook_tag) || [],
      character_tags: data.character_tags?.map((ct: any) => ct.character_tag) || [],
      videographer: data.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: data.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: data.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
    };
  },

  /**
   * Get my assigned projects (as editor)
   * Includes EDITING stage projects
   */
  async getMyProjects(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get my assignments as editor
    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'EDITOR');

    if (assignError) throw assignError;

    if (!assignments || assignments.length === 0) {
      return [];
    }

    const analysisIds = assignments.map((a: any) => a.analysis_id);

    // Fetch the full projects
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        industry:industries(id, name, short_code),
        profile:profile_list(id, name),
        hook_tags:analysis_hook_tags(hook_tag:hook_tags(id, name)),
        character_tags:analysis_character_tags(character_tag:character_tags(id, name)),
        profiles:user_id(email, full_name, avatar_url),
        assignments:project_assignments(
          *,
          user:profiles!project_assignments_user_id_fkey(id, email, full_name, avatar_url, role)
        ),
        production_files(*)
      `)
      .in('id', analysisIds)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      hook_tags: project.hook_tags?.map((ht: any) => ht.hook_tag) || [],
      character_tags: project.character_tags?.map((ct: any) => ct.character_tag) || [],
      videographer: project.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: project.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: project.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
    }));
  },

  /**
   * Get raw footage files for a project
   * Used in editor view to preview available footage
   */
  async getRawFootageFiles(analysisId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('production_files')
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey(id, email, full_name, avatar_url)
      `)
      .eq('analysis_id', analysisId)
      .in('file_type', ['RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER', 'raw-footage'])
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
