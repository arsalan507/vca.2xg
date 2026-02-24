import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productionFilesService } from '../productionFilesService';

// ---- Helpers ----

function createQueryBuilder(resolvedValue: { data: unknown; error: unknown; count?: number }) {
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'is', 'not', 'or', 'like', 'ilike',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ] as const;

  const builder: Record<string, any> = {};

  for (const m of chainMethods) {
    builder[m] = vi.fn((..._args: unknown[]) => builder);
  }

  builder.then = (resolve: (v: any) => void, reject?: (r: any) => void) => {
    return Promise.resolve(resolvedValue).then(resolve, reject);
  };

  return builder;
}

// ---- Module-level mock state ----

const getUserMock = vi.hoisted(() => vi.fn());
let fromResultsQueue: Record<string, Array<{ data: unknown; error: unknown; count?: number }>> = {};

function getNextResult(table: string) {
  const queue = fromResultsQueue[table];
  if (!queue || queue.length === 0) return { data: null, error: null };
  if (queue.length === 1) return queue[0];
  return queue.shift()!;
}

vi.mock('../../lib/api', () => {
  const from = vi.fn((table: string) => {
    const result = getNextResult(table);
    return createQueryBuilder(result);
  });

  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@test.com' } }, error: null });

  return {
    supabase: {
      from,
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: { getUser: getUserMock, getSession: vi.fn() },
    },
    auth: {
      getUser: getUserMock,
      getSession: vi.fn(),
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    },
  };
});

// ---- Setup ----

beforeEach(() => {
  vi.clearAllMocks();
  fromResultsQueue = {};
});

// ---- Tests ----

describe('productionFilesService', () => {
  // ========================================
  // getFiles
  // ========================================
  describe('getFiles', () => {
    it('should return files for an analysis with uploader info', async () => {
      fromResultsQueue['production_files'] = [
        {
          data: [
            {
              id: 'f1',
              analysis_id: 'a1',
              file_type: 'RAW_FOOTAGE',
              file_name: 'video.mp4',
              uploader: { id: 'u1', email: 'u@test.com', full_name: 'Uploader' },
            },
            {
              id: 'f2',
              analysis_id: 'a1',
              file_type: 'EDITED_VIDEO',
              file_name: 'edit.mp4',
              uploader: null,
            },
          ],
          error: null,
        },
      ];

      const result = await productionFilesService.getFiles('a1');

      expect(result).toHaveLength(2);
      expect(result[0].file_name).toBe('video.mp4');
    });

    it('should return empty array when no files exist', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: null }];

      const result = await productionFilesService.getFiles('a1');
      expect(result).toEqual([]);
    });

    it('should throw on error', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: { message: 'Query failed' } }];

      await expect(productionFilesService.getFiles('a1')).rejects.toEqual({ message: 'Query failed' });
    });
  });

  // ========================================
  // createFileRecord
  // ========================================
  describe('createFileRecord', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(
        productionFilesService.createFileRecord({
          analysisId: 'a1',
          fileType: 'raw-footage',
          fileName: 'video.mp4',
          fileUrl: 'https://drive.google.com/file/123',
          fileId: 'drive-123',
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('should create file record and return it with uploader', async () => {
      fromResultsQueue['production_files'] = [
        {
          data: {
            id: 'f-new',
            analysis_id: 'a1',
            file_type: 'raw-footage',
            file_name: 'video.mp4',
            file_url: 'https://drive.google.com/file/123',
            uploaded_by: 'user-1',
            uploader: { id: 'user-1', email: 'user@test.com', full_name: 'User' },
          },
          error: null,
        },
      ];

      const result = await productionFilesService.createFileRecord({
        analysisId: 'a1',
        fileType: 'raw-footage',
        fileName: 'video.mp4',
        fileUrl: 'https://drive.google.com/file/123',
        fileId: 'drive-123',
        fileSize: 1024000,
        mimeType: 'video/mp4',
        description: 'Main clip',
      });

      expect(result.id).toBe('f-new');
      expect(result.file_name).toBe('video.mp4');
    });

    it('should throw on insert error', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: { message: 'Insert failed' } }];

      await expect(
        productionFilesService.createFileRecord({
          analysisId: 'a1',
          fileType: 'raw-footage',
          fileName: 'video.mp4',
          fileUrl: 'url',
          fileId: 'id',
        })
      ).rejects.toEqual({ message: 'Insert failed' });
    });
  });

  // ========================================
  // updateFile
  // ========================================
  describe('updateFile', () => {
    it('should update file name and description', async () => {
      fromResultsQueue['production_files'] = [
        {
          data: {
            id: 'f1',
            file_name: 'renamed.mp4',
            description: 'Updated desc',
          },
          error: null,
        },
      ];

      const result = await productionFilesService.updateFile('f1', {
        file_name: 'renamed.mp4',
        description: 'Updated desc',
      });

      expect(result.file_name).toBe('renamed.mp4');
    });

    it('should throw on update error', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: { message: 'Update failed' } }];

      await expect(productionFilesService.updateFile('f1', { file_name: 'new' })).rejects.toEqual({ message: 'Update failed' });
    });
  });

  // ========================================
  // deleteFile
  // ========================================
  describe('deleteFile', () => {
    it('should hard delete file', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: null }];

      await expect(productionFilesService.deleteFile('f1')).resolves.toBeUndefined();
    });

    it('should throw on delete error', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: { message: 'Delete failed' } }];

      await expect(productionFilesService.deleteFile('f1')).rejects.toEqual({ message: 'Delete failed' });
    });
  });

  // ========================================
  // softDeleteFile
  // ========================================
  describe('softDeleteFile', () => {
    it('should set is_deleted to true', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: null }];

      await expect(productionFilesService.softDeleteFile('f1')).resolves.toBeUndefined();
    });

    it('should throw on error', async () => {
      fromResultsQueue['production_files'] = [{ data: null, error: { message: 'Soft delete failed' } }];

      await expect(productionFilesService.softDeleteFile('f1')).rejects.toEqual({ message: 'Soft delete failed' });
    });
  });

  // ========================================
  // getFilesByType
  // ========================================
  describe('getFilesByType', () => {
    it('should return files filtered by type', async () => {
      fromResultsQueue['production_files'] = [
        {
          data: [
            { id: 'f1', file_type: 'raw-footage', file_name: 'raw1.mp4' },
          ],
          error: null,
        },
      ];

      const result = await productionFilesService.getFilesByType('a1', 'raw-footage');
      expect(result).toHaveLength(1);
    });
  });

  // ========================================
  // getRawFootageFiles / getEditedVideoFiles / getFinalVideoFiles
  // ========================================
  describe('convenience file type getters', () => {
    it('getRawFootageFiles should delegate to getFilesByType', async () => {
      fromResultsQueue['production_files'] = [{ data: [], error: null }];

      const result = await productionFilesService.getRawFootageFiles('a1');
      expect(result).toEqual([]);
    });

    it('getEditedVideoFiles should delegate to getFilesByType', async () => {
      fromResultsQueue['production_files'] = [{ data: [], error: null }];

      const result = await productionFilesService.getEditedVideoFiles('a1');
      expect(result).toEqual([]);
    });

    it('getFinalVideoFiles should delegate to getFilesByType', async () => {
      fromResultsQueue['production_files'] = [{ data: [], error: null }];

      const result = await productionFilesService.getFinalVideoFiles('a1');
      expect(result).toEqual([]);
    });
  });

  // ========================================
  // approveFile / rejectFile
  // ========================================
  describe('approveFile', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(productionFilesService.approveFile('f1')).rejects.toThrow('Not authenticated');
    });

    it('should update approval status to approved', async () => {
      fromResultsQueue['production_files'] = [
        {
          data: {
            id: 'f1',
            approval_status: 'approved',
            reviewed_by: 'user-1',
          },
          error: null,
        },
      ];

      const result = await productionFilesService.approveFile('f1', 'Looks great');
      expect(result.id).toBe('f1');
    });
  });

  describe('rejectFile', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(productionFilesService.rejectFile('f1', 'Bad quality')).rejects.toThrow('Not authenticated');
    });

    it('should update approval status to rejected with notes', async () => {
      fromResultsQueue['production_files'] = [
        {
          data: {
            id: 'f1',
            approval_status: 'rejected',
            reviewed_by: 'user-1',
            review_notes: 'Bad quality',
          },
          error: null,
        },
      ];

      const result = await productionFilesService.rejectFile('f1', 'Bad quality');
      expect(result.id).toBe('f1');
    });
  });

  // ========================================
  // getFileCounts
  // ========================================
  describe('getFileCounts', () => {
    it('should return counts for each file type', async () => {
      fromResultsQueue['production_files'] = [
        { data: null, error: null, count: 10 }, // total
        { data: null, error: null, count: 5 },  // raw
        { data: null, error: null, count: 3 },  // edited
        { data: null, error: null, count: 2 },  // final
      ];

      const result = await productionFilesService.getFileCounts('a1');

      expect(result.total).toBe(10);
      expect(result.rawFootage).toBe(5);
      expect(result.editedVideo).toBe(3);
      expect(result.finalVideo).toBe(2);
    });

    it('should return zeros when counts are null', async () => {
      fromResultsQueue['production_files'] = [
        { data: null, error: null, count: undefined },
      ];

      const result = await productionFilesService.getFileCounts('a1');

      expect(result.total).toBe(0);
      expect(result.rawFootage).toBe(0);
    });
  });
});
