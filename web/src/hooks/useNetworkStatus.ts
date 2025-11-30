/**
 * Custom hook for managing network status
 */

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import {
    getNetworkStatus,
    subscribeToNetworkStatus,
} from "@/services/network-status";
import { setNetworkStatus } from "@/store/slices/appSlice";

/**
 * Hook to initialize and sync network status to Redux store
 */
export function useNetworkStatus() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setNetworkStatus(getNetworkStatus()));
    const unsubscribe = subscribeToNetworkStatus((newStatus) => {
      dispatch(setNetworkStatus(newStatus));
    });
    return unsubscribe;
  }, [dispatch]);
}

