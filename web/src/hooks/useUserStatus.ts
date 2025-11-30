/**
 * Custom hook for managing user status
 */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { fetchStatus } from "@/services/status-service";
import { selectUserStatus, setUserStatus } from "@/store/slices/appSlice";
import { fetchUserStatusAction } from "@/store/sagas/statusSaga";
import type { RootState } from "@/store";

/**
 * Hook to fetch and sync user status to Redux store
 */
export function useUserStatus() {
  const dispatch = useDispatch();
  const userStatus = useSelector((state: RootState) => selectUserStatus(state));

  const { data: queryStatus } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000,
  });

  // Sync query result to Redux
  useEffect(() => {
    if (queryStatus) {
      dispatch(setUserStatus(queryStatus));
    } else if (queryStatus === null) {
      // Explicitly set to null if query returns null
      dispatch(setUserStatus(null));
    }
  }, [queryStatus, dispatch]);

  // Fetch status on mount if not already in Redux
  useEffect(() => {
    if (!userStatus) {
      dispatch(fetchUserStatusAction());
    }
  }, [dispatch]); // Only run once on mount

  return userStatus;
}

