/**
 * Custom hook for managing user status
 */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStatus } from "@/services/status-service";
import { useAppStore } from "@/stores/app-store";

/**
 * Hook to fetch and sync user status to store
 */
export function useUserStatus() {
  const setUserStatus = useAppStore((state) => state.setUserStatus);

  const { data: userStatus } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (userStatus) {
      setUserStatus(userStatus);
    }
  }, [userStatus, setUserStatus]);
}

