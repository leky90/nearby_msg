import { useCallback, useRef, useState } from "react";

import { useConnectivity } from "@/shared/hooks/useConnectivity";
import { logRefreshFailure, logRefreshStart, logRefreshSuccess } from "@/shared/refresh/refreshLogger";
import type { SyncErrorType, SyncTrigger } from "@/shared/refresh/types";

export interface UseScopedRefreshOptions {
  scope: string;
  trigger: SyncTrigger;
  /**
   * Asynchronous function that performs the actual refresh for the given scope.
   * This is typically wired to the existing replication/pull mechanism.
   */
  refresh: () => Promise<void>;
}

export interface UseScopedRefreshResult {
  isRefreshing: boolean;
  canRefresh: boolean;
  refreshOnce: () => Promise<void>;
}

/**
 * Hook that ensures only a single in-flight refresh per logical scope.
 */
export function useScopedRefresh({ scope, trigger, refresh }: UseScopedRefreshOptions): UseScopedRefreshResult {
  const { isOnline } = useConnectivity();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const refreshOnce = useCallback(async () => {
    if (inFlightRef.current) return;

    if (!isOnline) {
      // Offline handling and user-facing messaging are layered on top in
      // User Story 3; for now we just log and skip the network call.
      const offlineErrorType: SyncErrorType = "offline";
      logRefreshFailure(scope, offlineErrorType);
      return;
    }

    inFlightRef.current = true;
    setIsRefreshing(true);
    logRefreshStart(scope, trigger);

    try {
      await refresh();
      logRefreshSuccess(scope);
    } catch (error) {
      const errorType: SyncErrorType = "other";
      logRefreshFailure(scope, errorType, error);
      throw error;
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [isOnline, refresh, scope, trigger]);

  return {
    isRefreshing,
    canRefresh: isOnline && !isRefreshing,
    refreshOnce,
  };
}
