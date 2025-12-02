/**
 * useChatGroup Hook
 * Manages group fetching and state for chat page
 * Single Responsibility: Group data management
 */

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchGroupDetailsAction } from "@/features/groups/store/groupSaga";
import {
  selectGroupById,
  selectGroupDetails,
} from "@/features/groups/store/slice";
import type { RootState } from "@/store";
import type { Group } from "@/shared/domain/group";

export interface UseChatGroupResult {
  /** Group data */
  group: Group | null;
  /** Whether group is loading */
  isLoading: boolean;
  /** Error if any */
  error: string | null;
  /** Refresh group data */
  refresh: () => void;
}

/**
 * useChatGroup hook
 * Provides group data and manages fetching
 */
export function useChatGroup(groupId: string | null): UseChatGroupResult {
  const dispatch = useDispatch();

  // Read group from Redux store
  const group = useSelector((state: RootState) =>
    groupId ? selectGroupById(state, groupId) : null
  );
  const groupDetails = useSelector((state: RootState) =>
    groupId ? selectGroupDetails(state, groupId) : { isLoading: false, error: null }
  );

  // Fetch group if not in Redux store
  useEffect(() => {
    if (!groupId) return;

    // If group is not in Redux store and not loading, fetch it
    if (!group && !groupDetails.isLoading) {
      dispatch(fetchGroupDetailsAction(groupId));
    }
  }, [groupId, group, groupDetails.isLoading, dispatch]);

  const refresh = () => {
    if (groupId) {
      dispatch(fetchGroupDetailsAction(groupId));
    }
  };

  return {
    group,
    isLoading: groupDetails.isLoading,
    error: groupDetails.error,
    refresh,
  };
}
