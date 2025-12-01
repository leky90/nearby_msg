/**
 * Hook to check sync status for a group
 * Returns whether the group has pending mutations
 * Uses Redux state managed by syncStatusSaga
 */

import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { selectGroupSyncStatus } from "@/features/status/store/slice";
import { startGroupSyncStatusAction, stopGroupSyncStatusAction } from "@/features/status/store/syncStatusSaga";
import type { RootState } from "@/store";

export interface GroupSyncStatus {
  hasPendingMutations: boolean;
  mutationStatus: "synced" | "pending" | "syncing" | "failed" | null;
  mutationCount: number;
}

export function useGroupSyncStatus(groupId: string): GroupSyncStatus {
  const dispatch = useDispatch();
  const groupStatus = useSelector((state: RootState) => selectGroupSyncStatus(state, groupId));

  useEffect(() => {
    // Start monitoring for this group
    dispatch(startGroupSyncStatusAction(groupId));
    
    // Cleanup: stop monitoring on unmount
    return () => {
      dispatch(stopGroupSyncStatusAction(groupId));
    };
  }, [groupId, dispatch]);

  // Map groupStatus to GroupSyncStatus interface
  const hasPendingMutations = groupStatus.pendingCount > 0 || groupStatus.syncingCount > 0 || groupStatus.failedCount > 0;
  
  let mutationStatus: GroupSyncStatus["mutationStatus"] = null;
  if (groupStatus.failedCount > 0) {
    mutationStatus = "failed";
  } else if (groupStatus.syncingCount > 0) {
    mutationStatus = "syncing";
  } else if (groupStatus.pendingCount > 0) {
    mutationStatus = "pending";
  } else {
    mutationStatus = "synced";
  }

  return {
    hasPendingMutations,
    mutationStatus,
    mutationCount: groupStatus.pendingCount + groupStatus.syncingCount + groupStatus.failedCount,
  };
}
