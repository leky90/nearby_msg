import { useMemo } from "react";
import { useSelector } from "react-redux";

import { selectNetworkStatus } from "@/features/navigation/store/appSlice";
import type { NetworkStatus } from "@/shared/services/network-status";
import type { ConnectivityState } from "@/shared/refresh/types";

/**
 * Hook to read current connectivity information from the app state.
 *
 * It assumes that `useNetworkStatus` is mounted somewhere high in the tree
 * to keep `networkStatus` in sync with the underlying browser APIs.
 */
export function useConnectivity(): ConnectivityState {
  const status = useSelector<{ app: { networkStatus: NetworkStatus } }, NetworkStatus>(
    selectNetworkStatus,
  );

  return useMemo(
    () => ({
      status,
      isOnline: status === "online",
    }),
    [status],
  );
}
