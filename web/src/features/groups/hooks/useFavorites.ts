/**
 * useFavorites Hook
 * Reactive hook for querying favorite groups from Redux store
 * Uses Redux selectors for real-time updates when RxDB listener updates store.
 * NO DIRECT RxDB ACCESS - all data comes from Redux store (synced via RxDB listener).
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { FavoriteGroup } from "@/shared/domain/favorite_group";
import type { Group } from "@/shared/domain/group";
import { selectFavoriteGroupIds, selectGroupsByIds } from "@/features/groups/store/slice";
import type { RootState } from "@/store";

export interface UseFavoritesResult {
  /** Favorite groups array */
  favorites: FavoriteGroup[];
  /** Whether favorites are loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
}

/**
 * useFavorites hook
 * Provides reactive favorite group queries from Redux store
 * Automatically updates when RxDB listener updates Redux store
 * NO DIRECT RxDB ACCESS - all data comes from Redux store (synced via RxDB listener)
 */
export function useFavorites(): UseFavoritesResult {
  // Read favorite group IDs from Redux store
  const favoriteGroupIds = useSelector((state: RootState) => selectFavoriteGroupIds(state));
  
  // Get favorite groups from Redux byId using memoized selector
  const favoriteGroups = useSelector((state: RootState) => 
    selectGroupsByIds(state, favoriteGroupIds)
  );

  // Convert groups to FavoriteGroup format (with created_at from favoriteGroupIds order)
  // Note: FavoriteGroup has group_id, device_id, created_at
  // For now, we return groups as FavoriteGroup[] with minimal data
  // If full FavoriteGroup data is needed, we'd need to sync favorite_groups collection to Redux
  const favorites: FavoriteGroup[] = useMemo(() => {
    return favoriteGroups
      .filter((g): g is Group => g !== null)
      .map((group) => ({
        id: `favorite_${group.id}`, // Synthetic ID
        group_id: group.id,
        device_id: '', // Would need to get from favorite_groups collection
        created_at: new Date().toISOString(), // Would need to get from favorite_groups collection
      } as FavoriteGroup));
  }, [favoriteGroups]);

  // Favorites are loaded from Redux (no loading state needed)
  // Error state: not applicable (Redux store is source of truth, errors handled by saga)
  return {
    favorites,
    isLoading: false, // Favorites are loaded from Redux (no loading state needed)
    error: null, // Errors handled by saga, not hook
  };
}
