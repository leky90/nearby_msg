/**
 * useGroupDetails Hook
 * Fetches additional details for groups (latest message, unread count, favorite status)
 * Single Responsibility: Group details aggregation
 */

import { useEffect, useState } from 'react';
import type { Group } from '@/domain/group';
import { getLatestMessage, getUnreadCount } from '@/services/message-service';
import { isFavorited } from '@/services/favorite-service';
import { getGroupStatusSummary } from '@/services/status-service';

export interface GroupDetail {
  group: Group;
  distance: number | null;
  latestMessagePreview: string | null;
  unreadCount: number;
  isFavorited: boolean;
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
  /** Whether details are loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
}

/**
 * useGroupDetails hook
 * Aggregates additional data for groups from RxDB
 */
export function useGroupDetails({
  groups,
  distances = [],
  enabled = true,
}: UseGroupDetailsOptions): UseGroupDetailsResult {
  const [groupDetails, setGroupDetails] = useState<GroupDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || groups.length === 0) {
      setGroupDetails([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const details = await Promise.all(
          groups.map(async (group, index) => {
            const [latestMessage, unreadCount, favorited, statusSummary] = await Promise.all([
              getLatestMessage(group.id).catch(() => null),
              getUnreadCount(group.id).catch(() => 0),
              isFavorited(group.id).catch(() => false),
              getGroupStatusSummary(group.id).catch(() => ({ total_count: 0 })),
            ]);

            return {
              group,
              distance: distances[index] ?? null,
              latestMessagePreview: latestMessage?.content
                ? latestMessage.content.substring(0, 50) +
                  (latestMessage.content.length > 50 ? '...' : '')
                : null,
              unreadCount,
              isFavorited: favorited,
              activeMemberCount: statusSummary.total_count || 0,
            };
          })
        );

        if (!cancelled) {
          setGroupDetails(details.filter(
            (detail): detail is GroupDetail => detail !== null
          ));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [groups, distances, enabled]);

  return {
    groupDetails,
    isLoading,
    error,
  };
}
