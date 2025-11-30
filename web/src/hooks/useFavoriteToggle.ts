/**
 * useFavoriteToggle Hook
 * Handles optimistic favorite toggle with rollback on error
 * Single Responsibility: Favorite toggle logic
 */

import { useQueryClient } from '@tanstack/react-query';
import { addFavorite, removeFavorite } from '@/services/favorite-service';
import { showToast } from '@/utils/toast';
import { log } from '@/lib/logging/logger';
import type { GroupDetail } from '@/hooks/useGroupDetails';

export interface UseFavoriteToggleResult {
  /** Toggle favorite status for a group */
  toggleFavorite: (groupId: string, shouldFavorite: boolean) => Promise<void>;
}

/**
 * useFavoriteToggle hook
 * Provides optimistic favorite toggle with error handling
 */
export function useFavoriteToggle(): UseFavoriteToggleResult {
  const queryClient = useQueryClient();

  const toggleFavorite = async (groupId: string, shouldFavorite: boolean) => {
    // Optimistic update: immediately update UI
    queryClient.setQueryData<GroupDetail[]>(['group-details'], (old) => {
      if (!old) return old;
      return old.map((detail) => {
        if (detail.group.id === groupId) {
          return { ...detail, isFavorited: shouldFavorite };
        }
        return detail;
      });
    });

    queryClient.setQueryData<GroupDetail[]>(['favorite-groups'], (old) => {
      if (!old) return old;
      if (shouldFavorite) {
        // Add favorite (will be added by reactive hook, but update immediately)
        return old;
      } else {
        // Remove favorite immediately
        return old.filter((detail) => detail.group.id !== groupId);
      }
    });

    try {
      if (shouldFavorite) {
        await addFavorite(groupId);
      } else {
        await removeFavorite(groupId);
      }
      // Invalidate to sync with server
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch (error) {
      // Rollback on error
      await queryClient.invalidateQueries({ queryKey: ['group-details'] });
      await queryClient.invalidateQueries({ queryKey: ['favorite-groups'] });
      log.error('Failed to toggle favorite', error, { groupId, shouldFavorite });
      showToast('Không thể cập nhật trạng thái quan tâm', 'error');
    }
  };

  return { toggleFavorite };
}
