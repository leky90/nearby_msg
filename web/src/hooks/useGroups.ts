/**
 * useGroups Hook
 * Reactive hook for querying groups from RxDB
 * Uses RxDB subscriptions for real-time updates when groups change via replication
 */

import { useEffect, useState, useMemo } from 'react';
import type { Group } from '../domain/group';
import { getDatabase } from '../services/db';

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
 * Provides reactive group queries from RxDB
 * Automatically updates when replication sync adds/updates groups
 */
export function useGroups({ groupIds, reactive = true }: UseGroupsOptions): UseGroupsResult {
  // Memoize groupIds string for dependency array
  const groupIdsKey = useMemo(() => groupIds.join(','), [groupIds]);
  
  // Initialize state based on empty groupIds
  const [groups, setGroups] = useState<(Group | null)[]>(() => 
    groupIds.length === 0 ? [] : []
  );
  const [isLoading, setIsLoading] = useState(() => groupIds.length > 0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupReactive = async () => {
      if (groupIds.length === 0) {
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          if (isMounted) {
            setGroups([]);
            setIsLoading(false);
          }
        }, 0);
        return;
      }

      try {
        if (isMounted) {
          setIsLoading(true);
          setError(null);
        }

        const db = await getDatabase();

        // Initial load: fetch all groups
        const initialGroups = await Promise.all(
          groupIds.map(async (groupId) => {
            const doc = await db.groups.findOne(groupId).exec();
            return doc ? (doc.toJSON() as Group) : null;
          })
        );

        if (!isMounted) {
          return;
        }

        setGroups(initialGroups);
        setIsLoading(false);

        if (!reactive) {
          return;
        }

        // Subscribe to changes for real-time updates
        // Watch all groups in the list
        const subscriptions = groupIds.map((groupId) => {
          return db.groups
            .findOne(groupId)
            .$.subscribe((doc) => {
              if (!isMounted) {
                return;
              }
              // Update the specific group in the array
              setGroups((prev) => {
                const newGroups = [...prev];
                const index = groupIds.indexOf(groupId);
                if (index !== -1) {
                  newGroups[index] = doc ? (doc.toJSON() as Group) : null;
                }
                return newGroups;
              });
            });
        });

        unsubscribe = () => {
          subscriptions.forEach((sub) => sub.unsubscribe());
        };
      } catch (err) {
        if (isMounted) {
          console.error('Failed to setup reactive groups query:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    };

    void setupReactive();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdsKey, reactive]); // Re-run when groupIds change (groupIdsKey is memoized from groupIds)

  return {
    groups,
    isLoading,
    error,
  };
}
