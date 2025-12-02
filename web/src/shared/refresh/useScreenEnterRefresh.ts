import { useEffect, useCallback, useRef } from "react";

import { triggerImmediateSync } from "@/features/replication/services/replication-sync";
import type { RefreshScope } from "@/shared/refresh/refreshScopes";
import { useScopedRefresh } from "@/shared/refresh/useScopedRefresh";

/**
 * Hook to trigger a single refresh when a screen becomes active.
 *
 * This is intentionally simple: it relies on the existing replication
 * service to push/pull all relevant collections.
 * 
 * Prevents infinite loops by:
 * 1. Memoizing the refresh function (stable reference)
 * 2. Using ref to track if refresh has been called (persists across re-renders)
 * 3. Only depending on scope in useEffect (not refreshOnce)
 */
export function useScreenEnterRefresh(scope: RefreshScope) {
  // Track if we've already triggered refresh for this scope in this component instance
  const hasRefreshedRef = useRef(false);
  const currentScopeRef = useRef<RefreshScope | null>(null);

  // Memoize refresh function to prevent refreshOnce from changing unnecessarily
  const refresh = useCallback(async () => {
    await triggerImmediateSync();
  }, []);

  const { isRefreshing, canRefresh, refreshOnce } = useScopedRefresh({
    scope,
    trigger: "onEnter",
    refresh,
  });

  useEffect(() => {
    // Reset if scope changed (component switched to different screen)
    if (currentScopeRef.current !== scope) {
      hasRefreshedRef.current = false;
      currentScopeRef.current = scope;
    }

    // Only refresh once per scope, even if component re-renders
    if (hasRefreshedRef.current) {
      return;
    }

    // Mark as refreshed
    hasRefreshedRef.current = true;

    // Fire-and-forget; internal guard in useScopedRefresh prevents overlapping refreshes.
    void refreshOnce();
    // Note: We intentionally don't include refreshOnce in deps to prevent loops
    // refreshOnce is stable because refresh is memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]); // Only depend on scope

  return { isRefreshing, canRefresh, refreshOnce };
}
