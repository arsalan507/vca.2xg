/**
 * Videographer Queue Service - Workflow v2.0
 *
 * Handles:
 * - Fetching available projects from PLANNING queue
 * - Picking a project (with profile selection + content ID generation)
 * - Marking shooting as complete (transition to READY_FOR_EDIT)
 */

import { supabase } from '@/lib/supabase';
import type { ViralAnalysis, PickProjectData, MarkShootingCompleteData } from '@/types';

export const videographerQueueService = {
  /**
   * Get available projects in PLANNING stage
   * These are approved scripts waiting to be picked by a videographer
   * Excludes projects that already have a videographer assigned
   * Includes legacy stages and null stages for backwards compatibility
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
        )
      `)
      .eq('status', 'APPROVED')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching available projects:', error);
      throw error;
    }

    console.log('Total APPROVED projects fetched:', data?.length || 0);

    // Filter client-side to match admin's Planning tab logic exactly:
    // - PLANNING, NOT_STARTED, PRE_PRODUCTION, PLANNED stages
    // - OR no stage set (null/undefined/empty string) for approved projects
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];

    const availableProjects = (data || []).filter((project: any) => {
      const stage = project.production_stage;
      const isInPlanningStage = planningStages.includes(stage) || !stage;

      // Also filter out projects that already have a videographer assigned
      const hasVideographer = project.assignments?.some(
        (a: any) => a.role === 'VIDEOGRAPHER'
      );

      return isInPlanningStage && !hasVideographer;
    });

    console.log('Available projects after filtering:', availableProjects.length);
    if (availableProjects.length === 0 && data && data.length > 0) {
      // Debug: show why projects were filtered out
      const planningProjects = data.filter((p: any) => planningStages.includes(p.production_stage) || !p.production_stage);
      console.log('Projects in planning stages:', planningProjects.length);
      const withoutVideographer = planningProjects.filter((p: any) => !p.assignments?.some((a: any) => a.role === 'VIDEOGRAPHER'));
      console.log('Without videographer:', withoutVideographer.length);
    }

    // Transform the data
    return availableProjects.map((project: any) => ({
      ...project,
      email: project.profiles?.email,
      full_name: project.profiles?.full_name,
      avatar_url: project.profiles?.avatar_url,
      hook_tags: project.hook_tags?.map((ht: any) => ht.hook_tag) || [],
      character_tags: project.character_tags?.map((ct: any) => ct.character_tag) || [],
    }));
  },

  /**
   * Pick a project from the PLANNING queue
   * - Assigns videographer to the project
   * - Sets profile (optional - can be set later) and generates content ID if profile provided
   * - Transitions to SHOOTING stage
   */
  async pickProject(data: PickProjectData): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Profile is now optional - can be set later when uploading files
    // Content ID will only be generated when profile is finally selected

    // Check if project is still available
    const { data: project, error: fetchError } = await supabase
      .from('viral_analyses')
      .select('id, production_stage, content_id, profile_id')
      .eq('id', data.analysisId)
      .single();

    if (fetchError) throw fetchError;

    // Match the same stages that getAvailableProjects() considers as "available"
    const planningStages = ['PLANNING', 'NOT_STARTED', 'PRE_PRODUCTION', 'PLANNED'];
    const isInPlanningStage = planningStages.includes(project.production_stage) || !project.production_stage;
    if (!isInPlanningStage) {
      throw new Error('This project is no longer available for picking');
    }

    // Check if already assigned to a videographer
    const { data: existingAssignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('analysis_id', data.analysisId)
      .eq('role', 'VIDEOGRAPHER')
      .single();

    if (existingAssignment) {
      throw new Error('This project has already been picked by another videographer');
    }

    // Generate content_id only if profile is provided and content_id not already set
    if (data.profileId && !project.content_id) {
      const { data: contentIdResult, error: contentIdError } = await supabase.rpc(
        'generate_content_id_on_approval',
        {
          p_analysis_id: data.analysisId,
          p_profile_id: data.profileId,
        }
      );

      if (contentIdError) {
        console.error('Failed to generate content_id:', contentIdError);
        throw new Error('Failed to generate content ID');
      }
      console.log('Generated content_id:', contentIdResult);
    }

    // Update the analysis with production details and move to SHOOTING
    const updateData: any = {
      production_stage: 'SHOOTING',
      production_started_at: new Date().toISOString(),
    };

    // Only set profile_id if provided
    if (data.profileId) {
      updateData.profile_id = data.profileId;
    }

    // Set cast composition if provided (includes total_people_involved)
    if (data.castComposition) {
      updateData.cast_composition = data.castComposition;
      updateData.total_people_involved = data.castComposition.total || 0;
    }

    if (data.deadline) {
      updateData.deadline = data.deadline;
    }

    const { error: updateError } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', data.analysisId);

    if (updateError) throw updateError;

    // Assign videographer to the project
    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .insert({
        analysis_id: data.analysisId,
        user_id: user.id,
        role: 'VIDEOGRAPHER',
        assigned_by: user.id,
      });

    if (assignmentError) throw assignmentError;

    // Link hook tags if provided
    if (data.hookTagIds && data.hookTagIds.length > 0) {
      // First remove existing hook tags
      await supabase
        .from('analysis_hook_tags')
        .delete()
        .eq('analysis_id', data.analysisId);

      // Insert new ones
      const hookTagInserts = data.hookTagIds.map(tagId => ({
        analysis_id: data.analysisId,
        hook_tag_id: tagId,
      }));
      await supabase.from('analysis_hook_tags').insert(hookTagInserts);
    }

    // Fetch and return the updated project
    return this.getProjectById(data.analysisId);
  },

  /**
   * Mark shooting as complete
   * - Validates at least 1 raw footage file exists
   * - Transitions to READY_FOR_EDIT stage
   */
  async markShootingComplete(data: MarkShootingCompleteData): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // ALWAYS do a direct file count check - don't rely on RPC which may be unreliable
    const rawFileTypes = [
      'RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER',
      'raw-footage'
    ];

    const { count: fileCount, error: countError } = await supabase
      .from('production_files')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_id', data.analysisId)
      .in('file_type', rawFileTypes)
      .eq('is_deleted', false);

    console.log('markShootingComplete: File count for', data.analysisId, '=', fileCount, countError ? `Error: ${countError.message}` : '');

    if (countError) {
      throw new Error('Failed to verify files. Please try again.');
    }

    if (!fileCount || fileCount === 0) {
      throw new Error('Please upload at least one raw footage file before marking as complete. No files found for this project.');
    }

    // Update the analysis
    const updateData: any = {
      production_stage: 'READY_FOR_EDIT',
    };

    if (data.productionNotes) {
      updateData.production_notes = data.productionNotes;
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
   * Get my assigned projects (as videographer)
   * Includes SHOOTING and READY_FOR_EDIT stages
   */
  async getMyProjects(): Promise<ViralAnalysis[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get my assignments as videographer
    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select('analysis_id')
      .eq('user_id', user.id)
      .eq('role', 'VIDEOGRAPHER');

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
   * Reject a project - hides it from this videographer's available list
   * Stored in localStorage keyed by user ID for persistence
   */
  getRejectedProjectIds(): string[] {
    try {
      const raw = localStorage.getItem('videographer_rejected_projects');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  rejectProject(analysisId: string): void {
    const rejected = this.getRejectedProjectIds();
    if (!rejected.includes(analysisId)) {
      rejected.push(analysisId);
      localStorage.setItem('videographer_rejected_projects', JSON.stringify(rejected));
    }
  },

  unrejectProject(analysisId: string): void {
    const rejected = this.getRejectedProjectIds().filter(id => id !== analysisId);
    localStorage.setItem('videographer_rejected_projects', JSON.stringify(rejected));
  },

  clearAllRejections(): void {
    localStorage.removeItem('videographer_rejected_projects');
  },
};
