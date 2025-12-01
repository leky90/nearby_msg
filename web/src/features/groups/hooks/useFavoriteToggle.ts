/**
 * useFavoriteToggle Hook
 * Handles optimistic favorite toggle with rollback on error
 * Single Responsibility: Favorite toggle logic
 */

import { useDispatch } from 'react-redux';
import { toggleFavoriteAction } from '@/features/groups/store/groupSaga';
import { showToast } from "@/shared/utils/toast";
import { log } from "@/shared/lib/logging/logger";

export interface UseFavoriteToggleResult {
  /** Toggle favorite status for a group */
  toggleFavorite: (groupId: string, shouldFavorite: boolean) => Promise<void>;
}

/**
 * useFavoriteToggle hook
 * Provides optimistic favorite toggle with error handling
 */
export function useFavoriteToggle(): UseFavoriteToggleResult {
  const dispatch = useDispatch();

  const toggleFavorite = async (groupId: string, shouldFavorite: boolean) => {
    try {
      // Dispatch Redux action (saga handles optimistic update and API call)
      // Note: toggleFavoriteAction toggles based on current state, so we just dispatch it
      // The saga will check current state and toggle accordingly
      dispatch(toggleFavoriteAction(groupId));
    } catch (error) {
      log.error('Failed to toggle favorite', error, { groupId, shouldFavorite });
      showToast('Không thể cập nhật trạng thái quan tâm', 'error');
    }
  };

  return { toggleFavorite };
}
