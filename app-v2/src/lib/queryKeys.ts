// Centralized React Query cache key factory
// Every query key lives here so invalidation is easy and typo-free.

export const queryKeys = {
  admin: {
    all: ['admin'] as const,
    dashboardStats: () => [...queryKeys.admin.all, 'dashboardStats'] as const,
    pendingAnalyses: () => [...queryKeys.admin.all, 'pendingAnalyses'] as const,
    production: () => [...queryKeys.admin.all, 'production'] as const,
    editReview: () => [...queryKeys.admin.all, 'editReview'] as const,
    project: (id: string) => [...queryKeys.admin.all, 'project', id] as const,
    team: () => [...queryKeys.admin.all, 'team'] as const,
  },
  videographer: {
    all: ['videographer'] as const,
    homepageData: () => [...queryKeys.videographer.all, 'homepageData'] as const,
    availableProjects: () => [...queryKeys.videographer.all, 'availableProjects'] as const,
    myProjects: () => [...queryKeys.videographer.all, 'myProjects'] as const,
    myScripts: () => [...queryKeys.videographer.all, 'myScripts'] as const,
    project: (id: string) => [...queryKeys.videographer.all, 'project', id] as const,
    profiles: () => [...queryKeys.videographer.all, 'profiles'] as const,
  },
  editor: {
    all: ['editor'] as const,
    homepageData: () => [...queryKeys.editor.all, 'homepageData'] as const,
    availableProjects: () => [...queryKeys.editor.all, 'availableProjects'] as const,
    myProjects: () => [...queryKeys.editor.all, 'myProjects'] as const,
    completedProjects: () => [...queryKeys.editor.all, 'completedProjects'] as const,
    project: (id: string) => [...queryKeys.editor.all, 'project', id] as const,
  },
  posting: {
    all: ['posting'] as const,
    stats: () => [...queryKeys.posting.all, 'stats'] as const,
    readyProjects: () => [...queryKeys.posting.all, 'readyProjects'] as const,
    toPost: () => [...queryKeys.posting.all, 'toPost'] as const,
    calendar: (start: string, end: string) =>
      [...queryKeys.posting.all, 'calendar', start, end] as const,
    scheduledPosts: (start: string, end: string) =>
      [...queryKeys.posting.all, 'scheduledPosts', start, end] as const,
    post: (id: string) => [...queryKeys.posting.all, 'post', id] as const,
    posted: () => [...queryKeys.posting.all, 'posted'] as const,
  },
  writer: {
    all: ['writer'] as const,
    homepageData: () => [...queryKeys.writer.all, 'homepageData'] as const,
    myScripts: () => [...queryKeys.writer.all, 'myScripts'] as const,
  },
};
