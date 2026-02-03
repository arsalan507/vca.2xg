import { supabase } from '@/lib/supabase';
import type {
  ViralAnalysis,
  ProjectAssignment,
  AssignTeamData,
  UpdateProductionStageData,
  UpdateProductionDetailsData,
  Profile,
} from '@/types';

export const assignmentService = {
  // Assign team members to an approved analysis
  async assignTeam(
    analysisId: string,
    data: AssignTeamData
  ): Promise<ViralAnalysis> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // If auto-assign videographer is requested
    if (data.autoAssignVideographer) {
      const assigned = await this.autoAssignVideographer(analysisId);
      data.videographerId = assigned.videographer?.id;
    }

    // If auto-assign editor is requested
    if (data.autoAssignEditor) {
      const assigned = await this.autoAssignEditor(analysisId);
      data.editorId = assigned.editor?.id;
    }

    // If auto-assign posting manager is requested
    if (data.autoAssignPostingManager) {
      const assigned = await this.autoAssignPostingManager(analysisId);
      data.postingManagerId = assigned.posting_manager?.id;
    }

    // Create/update assignments
    // First, delete existing assignments for each role that's being updated, then insert new ones
    const assignments: ProjectAssignment[] = [];

    if (data.videographerId) {
      // Delete existing videographer assignment for this analysis
      await supabase
        .from('project_assignments')
        .delete()
        .eq('analysis_id', analysisId)
        .eq('role', 'VIDEOGRAPHER');

      // Insert new assignment
      const { data: assignment, error } = await supabase
        .from('project_assignments')
        .insert({
          analysis_id: analysisId,
          user_id: data.videographerId,
          role: 'VIDEOGRAPHER',
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      assignments.push(assignment);
    }

    if (data.editorId) {
      // Delete existing editor assignment for this analysis
      await supabase
        .from('project_assignments')
        .delete()
        .eq('analysis_id', analysisId)
        .eq('role', 'EDITOR');

      // Insert new assignment
      const { data: assignment, error } = await supabase
        .from('project_assignments')
        .insert({
          analysis_id: analysisId,
          user_id: data.editorId,
          role: 'EDITOR',
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      assignments.push(assignment);
    }

    if (data.postingManagerId) {
      // Delete existing posting manager assignment for this analysis
      await supabase
        .from('project_assignments')
        .delete()
        .eq('analysis_id', analysisId)
        .eq('role', 'POSTING_MANAGER');

      // Insert new assignment
      const { data: assignment, error } = await supabase
        .from('project_assignments')
        .insert({
          analysis_id: analysisId,
          user_id: data.postingManagerId,
          role: 'POSTING_MANAGER',
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      assignments.push(assignment);
    }

    // Build update object for production details
    const updateData: Record<string, any> = {};

    // Add production details if provided
    if (data.industryId) updateData.industry_id = data.industryId;
    if (data.profileId) updateData.profile_id = data.profileId;
    if (data.totalPeopleInvolved !== undefined) updateData.total_people_involved = data.totalPeopleInvolved;
    if (data.shootPossibility !== undefined) updateData.shoot_possibility = data.shootPossibility;
    if (data.adminRemarks !== undefined) updateData.admin_remarks = data.adminRemarks;

    // Generate content_id if profile is selected (new logic - BCH + profile first 3 letters + sequence)
    if (data.profileId) {
      const { data: contentIdResult, error: contentIdError } = await supabase.rpc(
        'generate_content_id_on_approval',
        {
          p_analysis_id: analysisId,
          p_profile_id: data.profileId,
        }
      );

      if (contentIdError) {
        console.error('Failed to generate content_id:', contentIdError);
        // Don't throw - allow assignment to proceed, content_id might already exist
      } else {
        console.log('Generated content_id:', contentIdResult);
      }
    }

    // Update production stage to PRE_PRODUCTION if still NOT_STARTED
    const { data: analysis } = await supabase
      .from('viral_analyses')
      .select('production_stage')
      .eq('id', analysisId)
      .single();

    if (!analysis?.production_stage || analysis.production_stage === 'NOT_STARTED') {
      updateData.production_stage = 'PRE_PRODUCTION';
      updateData.production_started_at = new Date().toISOString();
    }

    // Apply updates if we have any
    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('viral_analyses')
        .update(updateData)
        .eq('id', analysisId);
    }

    // Handle hook tags (many-to-many relationship)
    if (data.hookTagIds && data.hookTagIds.length > 0) {
      // Delete existing hook tag relationships
      await supabase
        .from('analysis_hook_tags')
        .delete()
        .eq('analysis_id', analysisId);

      // Insert new hook tag relationships
      const hookTagInserts = data.hookTagIds.map((tagId) => ({
        analysis_id: analysisId,
        hook_tag_id: tagId,
      }));
      await supabase
        .from('analysis_hook_tags')
        .insert(hookTagInserts);
    }

    // Handle character tags (many-to-many relationship)
    if (data.characterTagIds && data.characterTagIds.length > 0) {
      // Delete existing character tag relationships
      await supabase
        .from('analysis_character_tags')
        .delete()
        .eq('analysis_id', analysisId);

      // Insert new character tag relationships
      const characterTagInserts = data.characterTagIds.map((tagId) => ({
        analysis_id: analysisId,
        character_tag_id: tagId,
      }));
      await supabase
        .from('analysis_character_tags')
        .insert(characterTagInserts);
    }

    // Fetch updated analysis with assignments
    return this.getAnalysisWithAssignments(analysisId);
  },

  // Auto-assign videographer based on workload
  async autoAssignVideographer(analysisId: string): Promise<ViralAnalysis> {
    // Get all videographers
    const { data: videographers, error: vError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'VIDEOGRAPHER');

    if (vError) throw vError;
    if (!videographers || videographers.length === 0) {
      throw new Error('No videographers available');
    }

    // Calculate workload for each videographer
    const workloads = await Promise.all(
      videographers.map(async (v: any) => {
        const { data, error } = await supabase.rpc('get_videographer_workload', {
          videographer_id: v.id,
        });

        if (error) {
          console.error('Error getting workload:', error);
          return { videographer: v, workload: 0 };
        }

        return { videographer: v, workload: data || 0 };
      })
    );

    // Find videographer with lowest workload
    const assigned = workloads.reduce((min, current) =>
      current.workload < min.workload ? current : min
    );

    // Assign the videographer
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: assignError } = await supabase
      .from('project_assignments')
      .upsert({
        analysis_id: analysisId,
        user_id: assigned.videographer.id,
        role: 'VIDEOGRAPHER',
        assigned_by: user.id,
      }, {
        onConflict: 'analysis_id,user_id,role',
      });

    if (assignError) throw assignError;

    return this.getAnalysisWithAssignments(analysisId);
  },

  // Auto-assign editor based on workload
  async autoAssignEditor(analysisId: string): Promise<ViralAnalysis> {
    // Get all editors
    const { data: editors, error: eError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'EDITOR');

    if (eError) throw eError;
    if (!editors || editors.length === 0) {
      throw new Error('No editors available');
    }

    // Calculate workload for each editor (count active assignments)
    const workloads = await Promise.all(
      editors.map(async (e: any) => {
        const { count, error } = await supabase
          .from('project_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', e.id)
          .eq('role', 'EDITOR');

        if (error) {
          console.error('Error getting editor workload:', error);
          return { editor: e, workload: 0 };
        }

        return { editor: e, workload: count || 0 };
      })
    );

    // Find editor with lowest workload
    const assigned = workloads.reduce((min, current) =>
      current.workload < min.workload ? current : min
    );

    // Assign the editor
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: assignError } = await supabase
      .from('project_assignments')
      .upsert({
        analysis_id: analysisId,
        user_id: assigned.editor.id,
        role: 'EDITOR',
        assigned_by: user.id,
      }, {
        onConflict: 'analysis_id,user_id,role',
      });

    if (assignError) throw assignError;

    return this.getAnalysisWithAssignments(analysisId);
  },

  // Auto-assign posting manager based on workload
  async autoAssignPostingManager(analysisId: string): Promise<ViralAnalysis> {
    // Get all posting managers
    const { data: postingManagers, error: pmError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'POSTING_MANAGER');

    if (pmError) throw pmError;
    if (!postingManagers || postingManagers.length === 0) {
      throw new Error('No posting managers available');
    }

    // Calculate workload for each posting manager (count active assignments)
    const workloads = await Promise.all(
      postingManagers.map(async (pm: any) => {
        const { count, error } = await supabase
          .from('project_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', pm.id)
          .eq('role', 'POSTING_MANAGER');

        if (error) {
          console.error('Error getting posting manager workload:', error);
          return { postingManager: pm, workload: 0 };
        }

        return { postingManager: pm, workload: count || 0 };
      })
    );

    // Find posting manager with lowest workload
    const assigned = workloads.reduce((min, current) =>
      current.workload < min.workload ? current : min
    );

    // Assign the posting manager
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: assignError } = await supabase
      .from('project_assignments')
      .upsert({
        analysis_id: analysisId,
        user_id: assigned.postingManager.id,
        role: 'POSTING_MANAGER',
        assigned_by: user.id,
      }, {
        onConflict: 'analysis_id,user_id,role',
      });

    if (assignError) throw assignError;

    return this.getAnalysisWithAssignments(analysisId);
  },

  // Get analysis with all assignments populated
  async getAnalysisWithAssignments(analysisId: string): Promise<ViralAnalysis> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .select(`
        *,
        profiles:user_id (email, full_name, avatar_url),
        assignments:project_assignments (
          *,
          user:profiles!project_assignments_user_id_fkey (id, email, full_name, avatar_url, role)
        )
      `)
      .eq('id', analysisId)
      .single();

    if (error) throw error;

    // Transform assignments into specific roles
    const analysis: ViralAnalysis = {
      ...data,
      email: data.profiles?.email,
      full_name: data.profiles?.full_name,
      avatar_url: data.profiles?.avatar_url,
      videographer: data.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
      editor: data.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
      posting_manager: data.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
    };

    return analysis;
  },

  // Update production stage
  async updateProductionStage(
    analysisId: string,
    data: UpdateProductionStageData
  ): Promise<ViralAnalysis> {
    // VALIDATION: If transitioning to READY_FOR_EDIT, verify files exist
    if (data.production_stage === 'READY_FOR_EDIT') {
      const rawFileTypes = [
        'RAW_FOOTAGE', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER',
        'raw-footage'
      ];

      const { count: fileCount, error: countError } = await supabase
        .from('production_files')
        .select('id', { count: 'exact', head: true })
        .eq('analysis_id', analysisId)
        .in('file_type', rawFileTypes)
        .eq('is_deleted', false);

      if (countError) {
        throw new Error('Failed to verify files. Please try again.');
      }

      if (!fileCount || fileCount === 0) {
        throw new Error('Cannot move to Ready for Edit - please upload at least one raw footage file first.');
      }
    }

    const updateData: any = {
      production_stage: data.production_stage,
    };

    if (data.production_notes) {
      updateData.production_notes = data.production_notes;
    }

    // Set completed timestamp if moving to POSTED
    if (data.production_stage === 'POSTED') {
      updateData.production_completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('viral_analyses')
      .update(updateData)
      .eq('id', analysisId)
      .select()
      .single();

    if (error) throw error;

    return this.getAnalysisWithAssignments(analysisId);
  },

  // Update production details (priority, deadline, budget)
  async updateProductionDetails(
    analysisId: string,
    data: UpdateProductionDetailsData
  ): Promise<ViralAnalysis> {
    const { error } = await supabase
      .from('viral_analyses')
      .update(data as Record<string, any>)
      .eq('id', analysisId)
      .select()
      .single();

    if (error) throw error;

    return this.getAnalysisWithAssignments(analysisId);
  },

  // Get users by role (for assignment dropdowns)
  async getUsersByRole(role: 'VIDEOGRAPHER' | 'EDITOR' | 'POSTING_MANAGER'): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', role)
      .order('full_name');

    if (error) throw error;
    return data || [];
  },

  // Get my assigned analyses
  async getMyAssignedAnalyses(
    productionStage?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: ViralAnalysis[]; total: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('project_assignments')
      .select(`
        analysis_id,
        created_at,
        viral_analyses!inner (
          *,
          profiles:user_id (email, full_name, avatar_url),
          assignments:project_assignments (
            *,
            user:profiles!project_assignments_user_id_fkey (id, email, full_name, avatar_url, role)
          )
        )
      `, { count: 'exact' })
      .eq('user_id', user.id);

    if (productionStage) {
      query = query.eq('viral_analyses.production_stage', productionStage);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    // Flatten the data structure and sort by analysis created_at
    const analyses: ViralAnalysis[] = (data || []).map((item: any) => {
      const analysis = item.viral_analyses;
      return {
        ...analysis,
        email: analysis.profiles?.email,
        full_name: analysis.profiles?.full_name,
        avatar_url: analysis.profiles?.avatar_url,
        videographer: analysis.assignments?.find((a: any) => a.role === 'VIDEOGRAPHER')?.user,
        editor: analysis.assignments?.find((a: any) => a.role === 'EDITOR')?.user,
        posting_manager: analysis.assignments?.find((a: any) => a.role === 'POSTING_MANAGER')?.user,
      };
    });

    // Sort by the analysis created_at (most recent first)
    analyses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { data: analyses, total: count || 0 };
  },

  // Remove assignment
  async removeAssignment(
    analysisId: string,
    role: 'VIDEOGRAPHER' | 'EDITOR' | 'POSTING_MANAGER'
  ): Promise<void> {
    const { error } = await supabase
      .from('project_assignments')
      .delete()
      .eq('analysis_id', analysisId)
      .eq('role', role);

    if (error) throw error;
  },
};
