import { describe, it, expect, vi, beforeEach } from 'vitest';
import { videographerService } from '../videographerService';

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

const rpcMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
let fromResultsQueue: Record<string, Array<{ data: unknown; error: unknown; count?: number }>> = {};

function getNextResult(table: string) {
  const queue = fromResultsQueue[table];
  if (!queue || queue.length === 0) return { data: null, error: null };
  if (queue.length === 1) return queue[0]; // keep returning last one
  return queue.shift()!;
}

vi.mock('../../lib/api', () => {
  const from = vi.fn((table: string) => {
    const result = getNextResult(table);
    return createQueryBuilder(result);
  });

  rpcMock.mockResolvedValue({ data: null, error: null });
  getUserMock.mockResolvedValue({ data: { user: { id: 'vg-1', email: 'vg@test.com' } }, error: null });

  return {
    supabase: {
      from,
      rpc: rpcMock,
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

describe('videographerService', () => {
  // ========================================
  // getAvailableProjects
  // ========================================
  describe('getAvailableProjects', () => {
    it('should filter out projects that already have a videographer assigned', async () => {
      // 1st call: project_assignments
      fromResultsQueue['project_assignments'] = [
        { data: [{ analysis_id: 'assigned-1' }], error: null },
      ];
      // 2nd call: viral_analyses
      fromResultsQueue['viral_analyses'] = [
        {
          data: [
            {
              id: 'assigned-1',
              status: 'APPROVED',
              production_stage: 'PLANNING',
              profiles: { email: 'w@test.com', full_name: 'W', avatar_url: null },
            },
            {
              id: 'available-1',
              status: 'APPROVED',
              production_stage: 'PLANNING',
              profiles: { email: 'w2@test.com', full_name: 'W2', avatar_url: null },
            },
          ],
          error: null,
        },
      ];
      // 3rd call: project_skips
      fromResultsQueue['project_skips'] = [
        { data: [], error: null },
      ];

      const result = await videographerService.getAvailableProjects();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('available-1');
      expect(result[0].email).toBe('w2@test.com');
    });

    it('should filter out projects with non-planning stages', async () => {
      fromResultsQueue['project_assignments'] = [
        { data: [], error: null },
      ];
      fromResultsQueue['viral_analyses'] = [
        {
          data: [
            { id: 'a1', production_stage: 'PLANNING', profiles: { email: 'a', full_name: 'A' } },
            { id: 'a2', production_stage: 'SHOOTING', profiles: { email: 'b', full_name: 'B' } },
            { id: 'a3', production_stage: null, profiles: { email: 'c', full_name: 'C' } },
          ],
          error: null,
        },
      ];
      fromResultsQueue['project_skips'] = [
        { data: [], error: null },
      ];

      const result = await videographerService.getAvailableProjects();

      // a1 (PLANNING) and a3 (null stage) should be available, a2 (SHOOTING) should not
      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.id)).toContain('a1');
      expect(result.map((r: any) => r.id)).toContain('a3');
    });

    it('should filter out skipped projects', async () => {
      fromResultsQueue['project_assignments'] = [
        { data: [], error: null },
      ];
      fromResultsQueue['viral_analyses'] = [
        {
          data: [
            { id: 'a1', production_stage: 'PLANNING', profiles: { email: 'a' } },
            { id: 'a2', production_stage: 'PLANNING', profiles: { email: 'b' } },
          ],
          error: null,
        },
      ];
      fromResultsQueue['project_skips'] = [
        { data: [{ analysis_id: 'a1' }], error: null },
      ];

      const result = await videographerService.getAvailableProjects();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a2');
    });

    it('should throw on viral_analyses query error', async () => {
      fromResultsQueue['project_assignments'] = [
        { data: [], error: null },
      ];
      fromResultsQueue['viral_analyses'] = [
        { data: null, error: { message: 'Query error' } },
      ];

      await expect(videographerService.getAvailableProjects()).rejects.toEqual({ message: 'Query error' });
    });

    it('should return empty array when no projects available', async () => {
      fromResultsQueue['project_assignments'] = [
        { data: [], error: null },
      ];
      fromResultsQueue['viral_analyses'] = [
        { data: [], error: null },
      ];
      fromResultsQueue['project_skips'] = [
        { data: [], error: null },
      ];

      const result = await videographerService.getAvailableProjects();
      expect(result).toEqual([]);
    });
  });

  // ========================================
  // getMyProjects
  // ========================================
  describe('getMyProjects', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(videographerService.getMyProjects()).rejects.toThrow('Not authenticated');
    });

    it('should return empty array when no assignments', async () => {
      fromResultsQueue['project_assignments'] = [
        { data: [], error: null },
      ];

      const result = await videographerService.getMyProjects();
      expect(result).toEqual([]);
    });

    it('should return projects with flattened profile and assignment data', async () => {
      fromResultsQueue['project_assignments'] = [
        { data: [{ analysis_id: 'a1' }], error: null },
      ];
      fromResultsQueue['viral_analyses'] = [
        {
          data: [
            {
              id: 'a1',
              profiles: { email: 'w@test.com', full_name: 'Writer', avatar_url: null },
              assignments: [
                { id: 'asgn1', role: 'VIDEOGRAPHER', user: { id: 'vg-1', email: 'vg@test.com' } },
                { id: 'asgn2', role: 'EDITOR', user: { id: 'ed-1', email: 'ed@test.com' } },
              ],
            },
          ],
          error: null,
        },
      ];

      const result = await videographerService.getMyProjects();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('w@test.com');
      expect(result[0].videographer).toEqual({ id: 'vg-1', email: 'vg@test.com' });
      expect(result[0].editor).toEqual({ id: 'ed-1', email: 'ed@test.com' });
    });

    it('should throw on assignments query error', async () => {
      fromResultsQueue['project_assignments'] = [
        { data: null, error: { message: 'Assignment query failed' } },
      ];

      await expect(videographerService.getMyProjects()).rejects.toEqual({ message: 'Assignment query failed' });
    });
  });

  // ========================================
  // getMyScripts
  // ========================================
  describe('getMyScripts', () => {
    it('should return scripts created by the current user', async () => {
      fromResultsQueue['viral_analyses'] = [
        {
          data: [{ id: 'a1', user_id: 'vg-1', title: 'My Script' }],
          error: null,
        },
      ];

      const result = await videographerService.getMyScripts();
      expect(result).toHaveLength(1);
    });

    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(videographerService.getMyScripts()).rejects.toThrow('Not authenticated');
    });
  });

  // ========================================
  // getProjectById
  // ========================================
  describe('getProjectById', () => {
    it('should return project with flattened data', async () => {
      fromResultsQueue['viral_analyses'] = [
        {
          data: {
            id: 'a1',
            profiles: { email: 'w@test.com', full_name: 'Writer', avatar_url: null },
            assignments: [
              { id: 'asgn1', role: 'VIDEOGRAPHER', user: { id: 'v1', email: 'v@test.com' } },
              { id: 'asgn2', role: 'POSTING_MANAGER', user: { id: 'pm1', email: 'pm@test.com' } },
            ],
          },
          error: null,
        },
      ];

      const result = await videographerService.getProjectById('a1');

      expect(result.email).toBe('w@test.com');
      expect(result.videographer).toBeDefined();
      expect(result.posting_manager).toBeDefined();
      expect(result.editor).toBeUndefined();
    });

    it('should throw on error', async () => {
      fromResultsQueue['viral_analyses'] = [
        { data: null, error: { message: 'Not found' } },
      ];

      await expect(videographerService.getProjectById('nonexistent')).rejects.toEqual({ message: 'Not found' });
    });
  });

  // ========================================
  // pickProject
  // ========================================
  describe('pickProject', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(videographerService.pickProject({ analysisId: 'a1' })).rejects.toThrow('Not authenticated');
    });

    it('should throw if project is not in planning stage', async () => {
      fromResultsQueue['viral_analyses'] = [
        { data: { id: 'a1', production_stage: 'SHOOTING' }, error: null },
      ];

      await expect(videographerService.pickProject({ analysisId: 'a1' })).rejects.toThrow('This project is no longer available');
    });

    it('should throw if project already has a videographer', async () => {
      fromResultsQueue['viral_analyses'] = [
        { data: { id: 'a1', production_stage: 'PLANNING' }, error: null },
      ];
      fromResultsQueue['project_assignments'] = [
        { data: { id: 'existing-assignment' }, error: null },
      ];

      await expect(videographerService.pickProject({ analysisId: 'a1' })).rejects.toThrow('This project has already been picked');
    });

    it('should accept project in PLANNING stage with no existing assignment', async () => {
      // 1: fetch project
      fromResultsQueue['viral_analyses'] = [
        { data: { id: 'a1', production_stage: 'PLANNING', content_id: null, profile_id: null }, error: null },
        // update call
        { data: null, error: null },
        // getProjectById refetch
        {
          data: {
            id: 'a1',
            production_stage: 'SHOOTING',
            profiles: { email: 'w@test.com', full_name: 'W', avatar_url: null },
            assignments: [{ id: 'new-asgn', role: 'VIDEOGRAPHER', user: { id: 'vg-1' } }],
          },
          error: null,
        },
      ];
      // assignment check: no existing
      fromResultsQueue['project_assignments'] = [
        { data: null, error: null },
        // insert assignment
        { data: null, error: null },
      ];

      const result = await videographerService.pickProject({ analysisId: 'a1' });

      expect(result.id).toBe('a1');
    });

    it('should accept project with null production_stage (treated as planning)', async () => {
      fromResultsQueue['viral_analyses'] = [
        { data: { id: 'a1', production_stage: null, content_id: null, profile_id: null }, error: null },
        { data: null, error: null },
        {
          data: {
            id: 'a1',
            production_stage: 'SHOOTING',
            profiles: { email: 'w@test.com', full_name: 'W', avatar_url: null },
            assignments: [],
          },
          error: null,
        },
      ];
      fromResultsQueue['project_assignments'] = [
        { data: null, error: null },
        { data: null, error: null },
      ];

      const result = await videographerService.pickProject({ analysisId: 'a1' });
      expect(result).toBeDefined();
    });

    it('should call rpc to generate content_id when profileId is provided', async () => {
      fromResultsQueue['viral_analyses'] = [
        { data: { id: 'a1', production_stage: 'PLANNING', content_id: null, profile_id: null }, error: null },
        { data: null, error: null },
        {
          data: {
            id: 'a1',
            profiles: { email: 'w@test.com', full_name: 'W', avatar_url: null },
            assignments: [],
          },
          error: null,
        },
      ];
      fromResultsQueue['project_assignments'] = [
        { data: null, error: null },
        { data: null, error: null },
      ];

      await videographerService.pickProject({ analysisId: 'a1', profileId: 'prof-1' });

      expect(rpcMock).toHaveBeenCalledWith('generate_content_id_on_approval', {
        p_analysis_id: 'a1',
        p_profile_id: 'prof-1',
      });
    });
  });

  // ========================================
  // markShootingComplete
  // ========================================
  describe('markShootingComplete', () => {
    it('should throw if not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(videographerService.markShootingComplete('a1')).rejects.toThrow('Not authenticated');
    });

    it('should throw if no files uploaded', async () => {
      fromResultsQueue['production_files'] = [
        { data: null, error: null, count: 0 },
      ];

      await expect(videographerService.markShootingComplete('a1')).rejects.toThrow('Please upload at least one file before marking as complete');
    });

    it('should throw on file count query error', async () => {
      fromResultsQueue['production_files'] = [
        { data: null, error: { message: 'Count error' }, count: undefined },
      ];

      await expect(videographerService.markShootingComplete('a1')).rejects.toThrow('Failed to verify files');
    });

    it('should update stage to READY_FOR_EDIT when files exist', async () => {
      fromResultsQueue['production_files'] = [
        { data: null, error: null, count: 3 },
      ];
      fromResultsQueue['viral_analyses'] = [
        // update call
        { data: null, error: null },
        // getProjectById refetch
        {
          data: {
            id: 'a1',
            production_stage: 'READY_FOR_EDIT',
            profiles: { email: 'w@test.com', full_name: 'W', avatar_url: null },
            assignments: [],
          },
          error: null,
        },
      ];

      const result = await videographerService.markShootingComplete('a1');
      expect(result.production_stage).toBe('READY_FOR_EDIT');
    });

    it('should append production notes when provided', async () => {
      fromResultsQueue['production_files'] = [
        { data: null, error: null, count: 2 },
      ];
      fromResultsQueue['viral_analyses'] = [
        // fetch current notes
        { data: { production_notes: 'Existing notes' }, error: null },
        // update call
        { data: null, error: null },
        // getProjectById refetch
        {
          data: {
            id: 'a1',
            production_stage: 'READY_FOR_EDIT',
            profiles: { email: 'w@test.com', full_name: 'W', avatar_url: null },
            assignments: [],
          },
          error: null,
        },
      ];

      const result = await videographerService.markShootingComplete('a1', 'New notes from videographer');
      expect(result).toBeDefined();
    });
  });

  // ========================================
  // getProfiles
  // ========================================
  describe('getProfiles', () => {
    it('should return active profiles', async () => {
      fromResultsQueue['profile_list'] = [
        {
          data: [
            { id: 'p1', name: 'Profile A', is_active: true },
            { id: 'p2', name: 'Profile B', is_active: true },
          ],
          error: null,
        },
      ];

      const result = await videographerService.getProfiles();
      expect(result).toHaveLength(2);
    });

    it('should throw on error', async () => {
      fromResultsQueue['profile_list'] = [
        { data: null, error: { message: 'Query failed' } },
      ];

      await expect(videographerService.getProfiles()).rejects.toEqual({ message: 'Query failed' });
    });
  });

  // ========================================
  // createProfile
  // ========================================
  describe('createProfile', () => {
    it('should create and return new profile', async () => {
      fromResultsQueue['profile_list'] = [
        { data: { id: 'new-p', name: 'New Profile', code: 'NP' }, error: null },
      ];

      const result = await videographerService.createProfile('New Profile', 'NP');
      expect(result.name).toBe('New Profile');
    });

    it('should throw on error', async () => {
      fromResultsQueue['profile_list'] = [
        { data: null, error: { message: 'Duplicate name' } },
      ];

      await expect(videographerService.createProfile('Dup', 'DUP')).rejects.toEqual({ message: 'Duplicate name' });
    });
  });

  // ========================================
  // deleteProfile
  // ========================================
  describe('deleteProfile', () => {
    it('should soft delete profile by setting is_active to false', async () => {
      fromResultsQueue['profile_list'] = [
        { data: null, error: null },
      ];

      await expect(videographerService.deleteProfile('p1')).resolves.toBeUndefined();
    });

    it('should throw on error', async () => {
      fromResultsQueue['profile_list'] = [
        { data: null, error: { message: 'Delete failed' } },
      ];

      await expect(videographerService.deleteProfile('p1')).rejects.toEqual({ message: 'Delete failed' });
    });
  });

  // ========================================
  // rejectProject / unrejectProject
  // ========================================
  describe('rejectProject', () => {
    it('should upsert skip record for the user', async () => {
      fromResultsQueue['project_skips'] = [
        { data: null, error: null },
      ];

      await expect(videographerService.rejectProject('a1')).resolves.toBeUndefined();
    });

    it('should do nothing if user is not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      // Should not throw, just return
      await expect(videographerService.rejectProject('a1')).resolves.toBeUndefined();
    });
  });

  describe('unrejectProject', () => {
    it('should delete skip record for the user', async () => {
      fromResultsQueue['project_skips'] = [
        { data: null, error: null },
      ];

      await expect(videographerService.unrejectProject('a1')).resolves.toBeUndefined();
    });

    it('should do nothing if user is not authenticated', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(videographerService.unrejectProject('a1')).resolves.toBeUndefined();
    });
  });
});
