/**
 * Custom hook for managing network status
 */

import { useEffect } from "react";
import {
    getNetworkStatus,
    subscribeToNetworkStatus,
} from "@/services/network-status";
import { useAppStore } from "@/stores/app-store";

/**
 * Hook to initialize and sync network status to store
 */
export function useNetworkStatus() {
  const setNetworkStatus = useAppStore((state) => state.setNetworkStatus);

  useEffect(() => {
    setNetworkStatus(getNetworkStatus());
    const unsubscribe = subscribeToNetworkStatus((newStatus) => {
      setNetworkStatus(newStatus);
    });
    return unsubscribe;
  }, [setNetworkStatus]);
}

