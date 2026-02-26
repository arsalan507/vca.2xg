import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '@/lib/queryKeys';
import { videographerService } from '@/services/videographerService';
import { editorService } from '@/services/editorService';
import { adminService } from '@/services/adminService';
import type { ViralAnalysis } from '@/types';
import toast from 'react-hot-toast';

// ──────────────────────────────────────────────
// Videographer Mutations
// ──────────────────────────────────────────────

/** Pick an available project (videographer) — optimistically remove from list */
export function usePickProject() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  type AvailableData = { projects: ViralAnalysis[]; characterTags: unknown[] };

  return useMutation({
    mutationFn: (args: { analysisId: string; profileId?: string }) =>
      videographerService.pickProject(args),

    onMutate: async ({ analysisId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.videographer.availableProjects() });
      const prev = qc.getQueryData<AvailableData>(queryKeys.videographer.availableProjects());
      if (prev?.projects) {
        qc.setQueryData(queryKeys.videographer.availableProjects(), {
          ...prev,
          projects: prev.projects.filter((p) => p.id !== analysisId),
        });
      }
      return { prev };
    },

    onSuccess: (_data, { analysisId }) => {
      toast.success('Project picked successfully!');
      navigate(`/videographer/project/${analysisId}`);
    },

    onError: (err: any, { analysisId }, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.videographer.availableProjects(), ctx.prev);
      }
      const msg = err.message || 'Failed to pick project';
      toast.error(msg);
      // If project was already picked by someone else, keep it removed
      if (msg.includes('already been picked') || msg.includes('no longer available')) {
        const current = qc.getQueryData<AvailableData>(queryKeys.videographer.availableProjects());
        if (current?.projects) {
          qc.setQueryData(queryKeys.videographer.availableProjects(), {
            ...current,
            projects: current.projects.filter((p) => p.id !== analysisId),
          });
        }
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.videographer.all });
    },
  });
}

/** Reject/skip a project (videographer) — optimistically remove from list */
export function useRejectProject() {
  const qc = useQueryClient();

  type AvailableData = { projects: ViralAnalysis[]; characterTags: unknown[] };

  return useMutation({
    mutationFn: (projectId: string) => videographerService.rejectProject(projectId),

    onMutate: async (projectId) => {
      await qc.cancelQueries({ queryKey: queryKeys.videographer.availableProjects() });
      const prev = qc.getQueryData<AvailableData>(queryKeys.videographer.availableProjects());
      if (prev?.projects) {
        qc.setQueryData(queryKeys.videographer.availableProjects(), {
          ...prev,
          projects: prev.projects.filter((p) => p.id !== projectId),
        });
      }
      return { prev };
    },

    onSuccess: () => {
      toast.success('Project skipped');
    },

    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.videographer.availableProjects(), ctx.prev);
      }
      toast.error('Failed to skip project');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.videographer.availableProjects() });
    },
  });
}

/** Mark shooting complete — optimistically move from shooting to completed */
export function useMarkShootingComplete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => videographerService.markShootingComplete(projectId),

    onMutate: async (projectId) => {
      await qc.cancelQueries({ queryKey: queryKeys.videographer.myProjects() });
      const prev = qc.getQueryData<ViralAnalysis[]>(queryKeys.videographer.myProjects());
      if (prev) {
        qc.setQueryData(
          queryKeys.videographer.myProjects(),
          prev.map((p) =>
            p.id === projectId ? { ...p, production_stage: 'READY_FOR_EDIT' as const } : p,
          ),
        );
      }
      return { prev };
    },

    onSuccess: () => {
      toast.success('Shooting marked as complete!');
    },

    onError: (err: any, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.videographer.myProjects(), ctx.prev);
      }
      toast.error(err.message || 'Failed to mark complete');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.videographer.all });
    },
  });
}

// ──────────────────────────────────────────────
// Editor Mutations
// ──────────────────────────────────────────────

/** Pick a project (editor) — optimistically remove from available list */
export function useEditorPickProject() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (args: { analysisId: string }) => editorService.pickProject(args),

    onMutate: async ({ analysisId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.editor.availableProjects() });
      const prev = qc.getQueryData<ViralAnalysis[]>(queryKeys.editor.availableProjects());
      if (prev) {
        qc.setQueryData(
          queryKeys.editor.availableProjects(),
          prev.filter((p) => p.id !== analysisId),
        );
      }
      return { prev };
    },

    onSuccess: (_data, { analysisId }) => {
      toast.success('Project picked successfully!');
      navigate(`/editor/project/${analysisId}`);
    },

    onError: (err: any, _args, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.editor.availableProjects(), ctx.prev);
      }
      toast.error(err.message || 'Failed to pick project');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.editor.all });
    },
  });
}

/** Reject/skip a project (editor) — optimistically remove from available list */
export function useEditorRejectProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => editorService.rejectProject(projectId),

    onMutate: async (projectId) => {
      await qc.cancelQueries({ queryKey: queryKeys.editor.availableProjects() });
      const prev = qc.getQueryData<ViralAnalysis[]>(queryKeys.editor.availableProjects());
      if (prev) {
        qc.setQueryData(
          queryKeys.editor.availableProjects(),
          prev.filter((p) => p.id !== projectId),
        );
      }
      return { prev };
    },

    onSuccess: () => {
      toast.success('Project hidden from list');
    },

    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.editor.availableProjects(), ctx.prev);
      }
      toast.error('Failed to skip project');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.editor.availableProjects() });
    },
  });
}

// ──────────────────────────────────────────────
// Admin Mutations
// ──────────────────────────────────────────────

/** Approve an edited video — optimistically remove from review list */
export function useAdminApproveEdit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => adminService.approveEditedVideo(projectId),

    onMutate: async (projectId) => {
      await qc.cancelQueries({ queryKey: queryKeys.admin.editReview() });
      const prev = qc.getQueryData<ViralAnalysis[]>(queryKeys.admin.editReview());
      if (prev) {
        qc.setQueryData(
          queryKeys.admin.editReview(),
          prev.filter((p) => p.id !== projectId),
        );
      }
      return { prev };
    },

    onSuccess: () => {
      toast.success('Video approved!');
    },

    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.admin.editReview(), ctx.prev);
      }
      toast.error('Failed to approve video');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}

/** Reject an edited video — optimistically remove from review list */
export function useAdminRejectEdit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, reason }: { projectId: string; reason: string }) =>
      adminService.rejectEditedVideo(projectId, reason),

    onMutate: async ({ projectId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.admin.editReview() });
      const prev = qc.getQueryData<ViralAnalysis[]>(queryKeys.admin.editReview());
      if (prev) {
        qc.setQueryData(
          queryKeys.admin.editReview(),
          prev.filter((p) => p.id !== projectId),
        );
      }
      return { prev };
    },

    onSuccess: () => {
      toast.success('Video rejected');
    },

    onError: (_err, _args, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.admin.editReview(), ctx.prev);
      }
      toast.error('Failed to reject video');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}
