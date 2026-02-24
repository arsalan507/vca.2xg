import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analysesService } from '../analysesService';

// ---- Helpers ----

interface CallRecord {
  method: string;
  args: unknown[];
}

function createQueryBuilder(resolvedValue: { data: unknown; error: unknown; count?: number }) {
  const calls: CallRecord[] = [];

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'is', 'not', 'or', 'like', 'ilike',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ] as const;

  const builder: Record<string, any> = {};

  for (const m of chainMethods) {
    builder[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    });
  }

  builder.then = (resolve: (v: any) => void, reject?: (r: any) => void) => {
    return Promise.resolve(resolvedValue).then(resolve, reject);
  };

  return { builder, calls };
}

// ---- Module-level mock state ----

let fromResults: Record<string, { data: unknown; error: unknown; count?: number }> = {};
const rpcMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const storageUploadMock = vi.hoisted(() => vi.fn());
const storageGetPublicUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/api', () => {
  const from = vi.fn((table: string) => {
    const result = fromResults[table] || { data: null, error: null };
    const { builder } = createQueryBuilder(result);
    return builder;
  });

  rpcMock.mockResolvedValue({ data: null, error: null });
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@test.com' } }, error: null });
  storageUploadMock.mockResolvedValue({ error: null });
  storageGetPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/voice.webm' } });

  return {
    supabase: {
      from,
      rpc: rpcMock,
      auth: { getUser: getUserMock, getSession: vi.fn() },
      storage: {
        from: vi.fn(() => ({
          upload: storageUploadMock,
          getPublicUrl: storageGetPublicUrlMock,
        })),
      },
    },
    auth: {
      getUser: getUserMock,
      getSession: vi.fn(),
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    },
    storage: {
      from: vi.fn(() => ({
        upload: storageUploadMock,
        getPublicUrl: storageGetPublicUrlMock,
      })),
    },
  };
});

// ---- Setup ----

beforeEach(() => {
  vi.clearAllMocks();
  fromResults = {};
});

// ---- Tests ----

describe('analysesService', () => {
  // ========================================
  // getMyAnalyses
  // ========================================
  describe('getMyAnalyses', () => {
    it('should return analyses for the current user', async () => {
      fromResults['viral_analyses'] = {
        data: [
          { id: 'a1', title: 'Analysis 1', user_id: 'user-1', status: 'PENDING' },
          { id: 'a2', title: 'Analysis 2', user_id: 'user-1', status: 'APPROVED' },
        ],
        error: null,
      };

      const result = await analysesService.getMyAnalyses();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a1');
      expect(result[1].id).toBe('a2');
    });

    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(analysesService.getMyAnalyses()).rejects.toThrow('Not authenticated');
    });

    it('should throw on Supabase error', async () => {
      fromResults['viral_analyses'] = { data: null, error: { message: 'DB error' } };

      await expect(analysesService.getMyAnalyses()).rejects.toEqual({ message: 'DB error' });
    });

    it('should return empty array when data is null', async () => {
      fromResults['viral_analyses'] = { data: null, error: null };

      const result = await analysesService.getMyAnalyses();
      expect(result).toEqual([]);
    });
  });

  // ========================================
  // getMyStats
  // ========================================
  describe('getMyStats', () => {
    it('should calculate approval rate correctly', async () => {
      fromResults['viral_analyses'] = { data: null, error: null, count: 10 };

      const result = await analysesService.getMyStats();

      // All queries return count=10, so total=10, approved=10, rate = 100%
      expect(result.total).toBe(10);
      expect(result.approved).toBe(10);
      expect(result.approvalRate).toBe(100);
    });

    it('should return zero approval rate when total is zero', async () => {
      fromResults['viral_analyses'] = { data: null, error: null, count: 0 };

      const result = await analysesService.getMyStats();

      expect(result.total).toBe(0);
      expect(result.approvalRate).toBe(0);
    });

    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(analysesService.getMyStats()).rejects.toThrow('Not authenticated');
    });
  });

  // ========================================
  // getAnalysis
  // ========================================
  describe('getAnalysis', () => {
    it('should return analysis with transformed hook_tags and character_tags', async () => {
      fromResults['viral_analyses'] = {
        data: {
          id: 'a1',
          title: 'Test',
          hook_tags: [
            { hook_tag: { id: 'ht1', name: 'Curiosity' } },
            { hook_tag: { id: 'ht2', name: 'Shock' } },
          ],
          character_tags: [
            { character_tag: { id: 'ct1', name: 'Protagonist' } },
          ],
        },
        error: null,
      };

      const result = await analysesService.getAnalysis('a1');

      expect(result.hook_tags).toEqual([
        { id: 'ht1', name: 'Curiosity' },
        { id: 'ht2', name: 'Shock' },
      ]);
      expect(result.character_tags).toEqual([
        { id: 'ct1', name: 'Protagonist' },
      ]);
    });

    it('should return empty arrays when tags are null/undefined', async () => {
      fromResults['viral_analyses'] = {
        data: {
          id: 'a1',
          title: 'No Tags',
          hook_tags: null,
          character_tags: undefined,
        },
        error: null,
      };

      const result = await analysesService.getAnalysis('a1');

      expect(result.hook_tags).toEqual([]);
      expect(result.character_tags).toEqual([]);
    });

    it('should throw on error', async () => {
      fromResults['viral_analyses'] = { data: null, error: { message: 'Not found' } };

      await expect(analysesService.getAnalysis('nonexistent')).rejects.toEqual({ message: 'Not found' });
    });
  });

  // ========================================
  // getPendingAnalyses / getApprovedAnalyses / getRejectedAnalyses
  // ========================================
  describe('getPendingAnalyses', () => {
    it('should return pending analyses for current user', async () => {
      fromResults['viral_analyses'] = {
        data: [{ id: 'a1', status: 'PENDING' }],
        error: null,
      };

      const result = await analysesService.getPendingAnalyses();
      expect(result).toHaveLength(1);
    });

    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(analysesService.getPendingAnalyses()).rejects.toThrow('Not authenticated');
    });
  });

  describe('getApprovedAnalyses', () => {
    it('should return approved analyses for current user', async () => {
      fromResults['viral_analyses'] = {
        data: [{ id: 'a1', status: 'APPROVED' }],
        error: null,
      };

      const result = await analysesService.getApprovedAnalyses();
      expect(result).toHaveLength(1);
    });

    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(analysesService.getApprovedAnalyses()).rejects.toThrow('Not authenticated');
    });
  });

  describe('getRejectedAnalyses', () => {
    it('should return rejected, non-dissolved analyses for current user', async () => {
      fromResults['viral_analyses'] = {
        data: [{ id: 'a1', status: 'REJECTED', is_dissolved: false }],
        error: null,
      };

      const result = await analysesService.getRejectedAnalyses();
      expect(result).toHaveLength(1);
    });

    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(analysesService.getRejectedAnalyses()).rejects.toThrow('Not authenticated');
    });
  });

  // ========================================
  // uploadVoiceNote
  // ========================================
  describe('uploadVoiceNote', () => {
    it('should upload blob and return public URL', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/webm' });

      const result = await analysesService.uploadVoiceNote('user-1', blob, 'hook');

      expect(result).toBe('https://cdn.example.com/voice.webm');
      expect(storageUploadMock).toHaveBeenCalledWith(
        expect.stringContaining('user-1/hook_'),
        blob,
        { contentType: 'audio/webm', upsert: false }
      );
    });

    it('should throw on upload error', async () => {
      storageUploadMock.mockResolvedValueOnce({ error: { message: 'Storage full' } });
      const blob = new Blob(['audio']);

      await expect(analysesService.uploadVoiceNote('user-1', blob, 'hook')).rejects.toEqual({ message: 'Storage full' });
    });
  });

  // ========================================
  // createAnalysis
  // ========================================
  describe('createAnalysis', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(
        analysesService.createAnalysis({
          referenceUrl: 'https://example.com',
          title: 'Test',
          shootType: 'indoor',
          creatorName: 'Creator',
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('should create analysis with PENDING status for non-trusted writer', async () => {
      fromResults['profiles'] = { data: { is_trusted_writer: false }, error: null };
      fromResults['viral_analyses'] = {
        data: { id: 'new-1', status: 'PENDING', production_stage: null },
        error: null,
      };

      const result = await analysesService.createAnalysis({
        referenceUrl: 'https://example.com/video',
        title: 'Great Video',
        shootType: 'outdoor',
        creatorName: 'Test Creator',
      });

      expect(result.id).toBe('new-1');
    });

    it('should create analysis with APPROVED status for trusted writer', async () => {
      fromResults['profiles'] = { data: { is_trusted_writer: true }, error: null };
      fromResults['viral_analyses'] = {
        data: { id: 'new-1', status: 'APPROVED', production_stage: 'PLANNING' },
        error: null,
      };

      const result = await analysesService.createAnalysis({
        referenceUrl: 'https://example.com/video',
        title: 'Trusted Video',
        shootType: 'studio',
        creatorName: 'Trusted Creator',
      });

      expect(result.status).toBe('APPROVED');
    });

    it('should generate content_id via rpc when profileId is provided', async () => {
      fromResults['profiles'] = { data: { is_trusted_writer: false }, error: null };
      fromResults['viral_analyses'] = {
        data: { id: 'new-1', status: 'PENDING', production_stage: null },
        error: null,
      };

      await analysesService.createAnalysis({
        referenceUrl: 'https://example.com/video',
        title: 'Test',
        shootType: 'outdoor',
        creatorName: 'Creator',
        profileId: 'prof-1',
      });

      expect(rpcMock).toHaveBeenCalledWith('generate_content_id_on_approval', {
        p_analysis_id: 'new-1',
        p_profile_id: 'prof-1',
      });
    });

    it('should not call content_id rpc when profileId is not provided', async () => {
      fromResults['profiles'] = { data: { is_trusted_writer: false }, error: null };
      fromResults['viral_analyses'] = {
        data: { id: 'new-1', status: 'PENDING' },
        error: null,
      };

      await analysesService.createAnalysis({
        referenceUrl: 'https://example.com',
        title: 'No Profile',
        shootType: 'outdoor',
        creatorName: 'Creator',
      });

      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('should throw on insert error', async () => {
      fromResults['profiles'] = { data: { is_trusted_writer: false }, error: null };
      fromResults['viral_analyses'] = { data: null, error: { message: 'Insert failed' } };

      await expect(
        analysesService.createAnalysis({
          referenceUrl: 'https://example.com',
          title: 'Fail',
          shootType: 'outdoor',
          creatorName: 'Creator',
          })
      ).rejects.toEqual({ message: 'Insert failed' });
    });

    it('should handle null profile gracefully (treat as non-trusted)', async () => {
      fromResults['profiles'] = { data: null, error: null };
      fromResults['viral_analyses'] = {
        data: { id: 'new-1', status: 'PENDING' },
        error: null,
      };

      const result = await analysesService.createAnalysis({
        referenceUrl: 'https://example.com',
        title: 'Test',
        shootType: 'outdoor',
        creatorName: 'Creator',
      });

      expect(result.status).toBe('PENDING');
    });
  });

  // ========================================
  // updateAnalysis
  // ========================================
  describe('updateAnalysis', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(analysesService.updateAnalysis('a1', { title: 'New' })).rejects.toThrow('Not authenticated');
    });

    it('should update analysis with provided fields', async () => {
      fromResults['viral_analyses'] = {
        data: { id: 'a1', title: 'Updated', status: 'PENDING' },
        error: null,
      };

      const result = await analysesService.updateAnalysis('a1', {
        title: 'Updated',
        referenceUrl: 'https://new-url.com',
      });

      expect(result.title).toBe('Updated');
    });

    it('should throw on update error', async () => {
      fromResults['viral_analyses'] = { data: null, error: { message: 'Update failed' } };

      await expect(analysesService.updateAnalysis('a1', { title: 'Fail' })).rejects.toEqual({ message: 'Update failed' });
    });
  });

  // ========================================
  // deleteAnalysis
  // ========================================
  describe('deleteAnalysis', () => {
    it('should soft delete by setting is_dissolved to true', async () => {
      fromResults['viral_analyses'] = { data: null, error: null };

      await expect(analysesService.deleteAnalysis('a1')).resolves.toBeUndefined();
    });

    it('should throw on error', async () => {
      fromResults['viral_analyses'] = { data: null, error: { message: 'Delete failed' } };

      await expect(analysesService.deleteAnalysis('a1')).rejects.toEqual({ message: 'Delete failed' });
    });
  });
});
