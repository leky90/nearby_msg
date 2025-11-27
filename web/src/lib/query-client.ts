/**
 * TanStack Query Client Configuration
 * Provides PWA-optimized defaults for offline-first architecture
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes before considering it stale
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Automatic retry with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // PWA optimizations
      refetchOnWindowFocus: false, // Save battery - don't refetch on focus
      refetchOnReconnect: true, // Sync when coming back online
      refetchOnMount: true, // Refetch when component mounts
      
      // Error handling
      throwOnError: false, // Let components handle errors
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

