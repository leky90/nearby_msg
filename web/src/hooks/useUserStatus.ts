/**
 * Custom hook for managing user status
 */

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectUserStatus } from "@/store/slices/appSlice";
import { fetchUserStatusAction } from "@/store/sagas/statusSaga";
import type { RootState } from "@/store";

/**
 * Hook to fetch and sync user status to Redux store
 */
export function useUserStatus() {
  const dispatch = useDispatch();
  const userStatus = useSelector((state: RootState) => selectUserStatus(state));

  // Fetch status on mount if not already in Redux
  useEffect(() => {
    if (!userStatus) {
      dispatch(fetchUserStatusAction());
    }
  }, [userStatus, dispatch]);

  return userStatus;
}

