import { useEffect } from "react";

import { triggerImmediateSync } from "@/features/replication/services/replication-sync";
import type { RefreshScope } from "@/shared/refresh/refreshScopes";
import { useScopedRefresh } from "@/shared/refresh/useScopedRefresh";

/**
 * Hook to trigger a single refresh when a screen becomes active.
 *
 * This is intentionally simple: it relies on the existing replication
 * service to push/pull all relevant collections.
 */
export function useScreenEnterRefresh(scope: RefreshScope) {
  const { isRefreshing, canRefresh, refreshOnce } = useScopedRefresh({
    scope,
    trigger: "onEnter",
    refresh: async () => {
      await triggerImmediateSync();
    },
  });

  useEffect(() => {
    // Fire-and-forget; internal guard prevents overlapping refreshes.
    void refreshOnce();
    // We only want this on initial mount for the given scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isRefreshing, canRefresh, refreshOnce };
}
