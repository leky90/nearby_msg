import { useMemo } from "react";
import { useSelector } from "react-redux";

import { selectNetworkStatus } from "@/features/navigation/store/appSlice";
import type { ConnectivityState } from "@/shared/refresh/types";
import type { RootState } from "@/store";

/**
 * Hook to read current connectivity information from the app state.
 *
 * It assumes that `useNetworkStatus` is mounted somewhere high in the tree
 * to keep `networkStatus` in sync with the underlying browser APIs.
 */
export function useConnectivity(): ConnectivityState {
  const status = useSelector((state: RootState) => selectNetworkStatus(state));

  return useMemo(
    () => ({
      status,
      isOnline: status === "online",
    }),
    [status],
  );
}
