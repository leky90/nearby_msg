/**
 * useGroups Hook
 * Reactive hook for querying groups from Redux store
 * Uses Redux selectors for real-time updates when RxDB listener updates store.
 * NO DIRECT RxDB ACCESS - all data comes from Redux store (synced via RxDB listener).
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { Group } from "@/shared/domain/group";
import {
    selectNearbyGroupsLoading,
    selectGroupsByIds
} from "@/features/groups/store/slice";
import type { RootState } from "@/store";

export interface UseGroupsOptions {
  /** Group IDs to fetch */
  groupIds: string[];
  /** Whether to enable reactive updates */
  reactive?: boolean;
}

export interface UseGroupsResult {
  /** Groups array (may contain nulls if group not found) */
  groups: (Group | null)[];
  /** Whether groups are loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
}

/**
 * useGroups hook
 * Provides reactive group queries from Redux store
 * Automatically updates when RxDB listener updates Redux store
 * NO DIRECT RxDB ACCESS - all data comes from Redux store (synced via RxDB listener)
 */
export function useGroups({ groupIds }: UseGroupsOptions): UseGroupsResult {
  // Memoize groupIds array to prevent infinite loops
  const groupIdsKey = groupIds.join(',');
  const memoizedGroupIds = useMemo(() => groupIds, [groupIdsKey]);
  
  // Redux selectors - get groups from Redux store
  const isLoading = useSelector((state: RootState) => selectNearbyGroupsLoading(state));
  
  // Get groups from Redux byId using memoized selector
  const groups = useSelector((state: RootState) => 
    selectGroupsByIds(state, memoizedGroupIds)
  );

  // Groups are loaded from Redux (no loading state needed if groups exist)
  // Error state: not applicable (Redux store is source of truth, errors handled by saga)
  return {
    groups,
    isLoading: isLoading && groups.length === 0, // Only loading if no groups yet
    error: null, // Errors handled by saga, not hook
  };
}
