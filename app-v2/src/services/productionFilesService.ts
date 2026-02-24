/**
 * Production Files Service
 *
 * Aligned with frontend/src/services/productionFilesService.ts
 * Handles database operations for production files (CRUD, approvals)
 */

import { supabase, auth } from '@/lib/api';
import type { ProductionFile } from '@/types';

// File types for Drive folder organization
export type DriveFileType = 'raw-footage' | 'edited-video' | 'final-video';

// All file types including videographer categories
export type FileTypeUpload =
  | 'raw-footage' | 'edited-video' | 'final-video'  // Drive folder types
  | 'RAW_FOOTAGE' | 'A_ROLL' | 'B_ROLL' | 'HOOK' | 'BODY' | 'CTA' | 'AUDIO_CLIP' | 'OTHER';  // Videographer types

export interface FileUploadData {
  analysisId: string;
  fileType: FileTypeUpload | string;  // Allow any string for flexibility
  fileName: string;
  fileUrl: string;
  fileId: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
}

export const productionFilesService = {
  /**
   * Get all files for an analysis
   */
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
    return (data || []) as ProductionFile[];
  },

  /**
   * Upload/Add a file record to database
   * Note: This only creates the database record. Use backendUploadService for actual file upload.
   */
  async createFileRecord(fileData: FileUploadData): Promise<ProductionFile> {
    const { data: { user } } = await auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('production_files')
      .insert({
        analysis_id: fileData.analysisId,
        file_type: fileData.fileType,
        file_name: fileData.fileName,
        file_url: fileData.fileUrl,
        file_id: fileData.fileId,
        file_size: fileData.fileSize,
        uploaded_by: user.id,
        mime_type: fileData.mimeType,
        description: fileData.description,
      })
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .single();

    if (error) throw error;
    return data as ProductionFile;
  },

  /**
   * Update file details
   */
  async updateFile(
    fileId: string,
    updates: Partial<Pick<ProductionFile, 'file_name' | 'description'>>
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
    return data as ProductionFile;
  },

  /**
   * Delete a file record (hard delete)
   */
  async deleteFile(fileId: string): Promise<void> {
    const { error } = await supabase
      .from('production_files')
      .delete()
      .eq('id', fileId);

    if (error) throw error;
  },

  /**
   * Soft delete a file (set is_deleted to true)
   */
  async softDeleteFile(fileId: string): Promise<void> {
    const { error } = await supabase
      .from('production_files')
      .update({ is_deleted: true })
      .eq('id', fileId);

    if (error) throw error;
  },

  /**
   * Get files by type
   */
  async getFilesByType(analysisId: string, fileType: FileTypeUpload): Promise<ProductionFile[]> {
    const { data, error } = await supabase
      .from('production_files')
      .select(`
        *,
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .eq('analysis_id', analysisId)
      .eq('file_type', fileType)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ProductionFile[];
  },

  /**
   * Get raw footage files for an analysis
   */
  async getRawFootageFiles(analysisId: string): Promise<ProductionFile[]> {
    return this.getFilesByType(analysisId, 'raw-footage');
  },

  /**
   * Get edited video files for an analysis
   */
  async getEditedVideoFiles(analysisId: string): Promise<ProductionFile[]> {
    return this.getFilesByType(analysisId, 'edited-video');
  },

  /**
   * Get final video files for an analysis
   */
  async getFinalVideoFiles(analysisId: string): Promise<ProductionFile[]> {
    return this.getFilesByType(analysisId, 'final-video');
  },

  /**
   * Approve a file
   */
  async approveFile(fileId: string, reviewNotes?: string): Promise<ProductionFile> {
    const { data: { user } } = await auth.getUser();
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
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .single();

    if (error) throw error;
    return data as ProductionFile;
  },

  /**
   * Reject a file
   */
  async rejectFile(fileId: string, reviewNotes: string): Promise<ProductionFile> {
    const { data: { user } } = await auth.getUser();
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
        uploader:profiles!production_files_uploaded_by_fkey (id, email, full_name, avatar_url, role)
      `)
      .single();

    if (error) throw error;
    return data as ProductionFile;
  },

  /**
   * Count files by type for an analysis
   */
  async getFileCounts(analysisId: string): Promise<{
    rawFootage: number;
    editedVideo: number;
    finalVideo: number;
    total: number;
  }> {
    // Use server-side count queries instead of fetching all records
    const base = () => supabase.from('production_files').select('id', { count: 'exact', head: true }).eq('analysis_id', analysisId);

    const [totalResult, rawResult, editedResult, finalResult] = await Promise.all([
      base(),
      base().eq('file_type', 'raw-footage'),
      base().eq('file_type', 'edited-video'),
      base().eq('file_type', 'final-video'),
    ]);

    return {
      rawFootage: rawResult.count || 0,
      editedVideo: editedResult.count || 0,
      finalVideo: finalResult.count || 0,
      total: totalResult.count || 0,
    };
  },
};
