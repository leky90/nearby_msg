/**
 * useGroupDetails Hook
 * Aggregates additional data for groups from Redux store
 * Single Responsibility: Group details aggregation from Redux
 */

import { useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { Group } from "@/shared/domain/group";
import { selectGroupsDetailsMetadata, selectGroupById } from "@/features/groups/store/slice";
import { fetchGroupsDetailsAction } from "@/features/groups/store/groupSaga";
import type { RootState } from "@/store";

export interface GroupDetail {
  group: Group;
  distance: number | null;
  latestMessagePreview: string | null;
  unreadCount: number;
  activeMemberCount: number;
}

export interface UseGroupDetailsOptions {
  /** Groups to fetch details for */
  groups: Group[];
  /** Distances for each group (optional) */
  distances?: (number | null)[];
  /** Whether query is enabled */
  enabled?: boolean;
}

export interface UseGroupDetailsResult {
  /** Group details array */
  groupDetails: GroupDetail[];
  /** Whether details are loading (always false - data comes from Redux) */
  isLoading: boolean;
  /** Error if any (always null - errors come from Redux) */
  error: Error | null;
}

/**
 * useGroupDetails hook
 * Aggregates additional data for groups from Redux store
 * All data comes from Redux - no local state, no direct service calls
 * Dispatches action to fetch details if not available in Redux
 */
export function useGroupDetails({
  groups,
  distances = [],
  enabled = true,
}: UseGroupDetailsOptions): UseGroupDetailsResult {
  const dispatch = useDispatch();

  // Get group IDs
  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);

  // Get details metadata from Redux store
  const memoizedGroupIds = useMemo(() => groupIds, [groupIds]);
  const detailsMetadata = useSelector((state: RootState) =>
    selectGroupsDetailsMetadata(state, memoizedGroupIds)
  );

  // Get groups from Redux to ensure we have the group objects
  const groupsFromRedux = useSelector((state: RootState) => {
    return groupIds.map((id) => selectGroupById(state, id)).filter((g): g is Group => g !== null);
  });

  // Dispatch action to fetch details if not available
  // Saga will handle debouncing and duplicate prevention
  useEffect(() => {
    if (!enabled || groups.length === 0) {
      return;
    }

    // Check if we need to fetch details for any groups
    const groupsNeedingDetails = groupIds.filter((groupId) => {
      const metadata = detailsMetadata.find((d) => d.groupId === groupId);
      // Fetch if metadata is missing
      return !metadata;
    });

    if (groupsNeedingDetails.length > 0) {
      dispatch(fetchGroupsDetailsAction(groupsNeedingDetails));
    }
  }, [enabled, groups.length, groupIds, detailsMetadata, dispatch]);

  // Combine groups with their details metadata
  const groupDetails = useMemo(() => {
    if (!enabled || groups.length === 0) {
      return [];
    }

    // Use groups from Redux if available, otherwise use provided groups
    const groupsToUse = groupsFromRedux.length > 0 ? groupsFromRedux : groups;

    return groupsToUse.map((group, index) => {
      const metadata = detailsMetadata.find((d) => d.groupId === group.id);
      
      return {
        group,
        distance: distances[index] ?? null,
        latestMessagePreview: metadata?.latestMessagePreview || null,
        unreadCount: metadata?.unreadCount || 0,
        activeMemberCount: metadata?.activeMemberCount || 0,
      };
    });
  }, [enabled, groups, groupsFromRedux, distances, detailsMetadata]);

  // No loading state - data comes from Redux (already loaded or loading state is in Redux)
  // No error state - errors come from Redux slices
  return {
    groupDetails,
    isLoading: false,
    error: null,
  };
}
