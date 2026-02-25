import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
    },
  },
});
