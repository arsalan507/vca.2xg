import { supabase } from '@/lib/supabase';
import type { ProductionFile, UploadFileData, ViralAnalysis } from '@/types';

export const productionFilesService = {
  // Get all files for an analysis
  async getFiles(analysisId: string): Promise<ProductionFile[]> {
    const { data, error } = await supabase
      .from('production_files')
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Upload/Add a file record
  async uploadFile(fileData: UploadFileData): Promise<ProductionFile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get current production stage
    const { data: analysis } = await supabase
      .from('viral_analyses')
      .select('production_stage')
      .eq('id', fileData.analysisId)
      .single();

    const { data, error } = await supabase
      .from('production_files')
      .insert({
        analysis_id: fileData.analysisId,
        uploaded_by: user.id,
        file_name: fileData.fileName,
        file_type: fileData.fileType,
        file_url: fileData.fileUrl,
        file_size: fileData.fileSize,
        mime_type: fileData.mimeType,
        description: fileData.description,
        upload_stage: analysis?.production_stage,
        is_primary: fileData.isPrimary || false,
      })
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Update file details
  async updateFile(
    fileId: string,
    updates: Partial<Pick<ProductionFile, 'file_name' | 'description' | 'is_primary'>>
  ): Promise<ProductionFile> {
    const { data, error } = await supabase
      .from('production_files')
      .update(updates)
      .eq('id', fileId)
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a file
  async deleteFile(fileId: string): Promise<void> {
    const { error } = await supabase
      .from('production_files')
      .delete()
      .eq('id', fileId);

    if (error) throw error;
  },

  // Update analysis Google Drive URLs
  async updateDriveUrls(
    analysisId: string,
    urls: {
      raw_footage_drive_url?: string;
      edited_video_drive_url?: string;
      final_video_url?: string;
    }
  ): Promise<ViralAnalysis> {
    const { data, error } = await supabase
      .from('viral_analyses')
      .update(urls)
      .eq('id', analysisId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get files by type
  async getFilesByType(analysisId: string, fileType: string): Promise<ProductionFile[]> {
    const { data, error} = await supabase
      .from('production_files')
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .eq('analysis_id', analysisId)
      .eq('file_type', fileType)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Approve a file
  async approveFile(fileId: string, reviewNotes?: string): Promise<ProductionFile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('production_files')
      .update({
        approval_status: 'approved',
        reviewed_by: user.id,
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', fileId)
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role),
        reviewer:profiles!production_files_reviewed_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Reject a file
  async rejectFile(fileId: string, reviewNotes: string): Promise<ProductionFile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('production_files')
      .update({
        approval_status: 'rejected',
        reviewed_by: user.id,
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', fileId)
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role),
        reviewer:profiles!production_files_reviewed_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .single();

    if (error) throw error;
    return data;
  },
};
