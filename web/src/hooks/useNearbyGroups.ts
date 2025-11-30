/**
 * useNearbyGroups Hook
 * Reactive hook for querying nearby groups from RxDB
 * Filters groups by location and radius, calculates distances locally.
 * Uses RxDB subscriptions for real-time updates when replication syncs groups.
 * NO API CALLS - all data comes from RxDB (already synced via replication).
 */

import { useEffect, useState, useMemo } from 'react';
import type { Group } from '../domain/group';
import { calculateDistance } from '../domain/group';
import { getDatabase } from '../services/db';
import { log } from '../lib/logging/logger';

export interface UseNearbyGroupsOptions {
  /** Latitude for filtering */
  latitude: number;
  /** Longitude for filtering */
  longitude: number;
  /** Radius in meters */
  radius: number;
  /** Whether to enable reactive updates */
  reactive?: boolean;
}

export interface UseNearbyGroupsResult {
  /** Nearby groups array */
  groups: Group[];
  /** Distances array (corresponding to groups) */
  distances: number[];
  /** Whether groups are loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
}

/**
 * useNearbyGroups hook
 * Provides reactive nearby group queries from RxDB
 * Automatically updates when replication sync adds/updates groups
 * NO API CALLS - all filtering and distance calculation done client-side
 */
export function useNearbyGroups({
  latitude,
  longitude,
  radius,
  reactive = true,
}: UseNearbyGroupsOptions): UseNearbyGroupsResult {
  const [groups, setGroups] = useState<Group[]>([]);
  const [distances, setDistances] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize location key for dependency array
  const locationKey = useMemo(
    () => `${latitude.toFixed(4)},${longitude.toFixed(4)},${radius}`,
    [latitude, longitude, radius]
  );

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupReactive = async () => {
      try {
        if (isMounted) {
          setIsLoading(true);
          setError(null);
        }

        const db = await getDatabase();

        // Initial load: get all groups and filter by location/radius
        const allGroupsDocs = await db.groups.find().exec();
        const allGroups = allGroupsDocs.map((doc) => doc.toJSON() as Group);

        // Calculate distances and filter by radius
        const results = allGroups
          .map((group) => {
            const distance = calculateDistance(
              latitude,
              longitude,
              group.latitude,
              group.longitude
            );
            return { group, distance };
          })
          .filter((result) => result.distance <= radius)
          .sort((a, b) => a.distance - b.distance);

        if (!isMounted) {
          return;
        }

        setGroups(results.map((r) => r.group));
        setDistances(results.map((r) => r.distance));
        setIsLoading(false);

        if (!reactive) {
          return;
        }

        // Subscribe to ALL groups for real-time updates
        // When any group changes (via replication), recalculate nearby groups
        const query = db.groups.find();
        if (query.$) {
          const subscription = query.$.subscribe((docs) => {
            if (!isMounted) {
              return;
            }

            const updatedGroups = docs.map((doc) => doc.toJSON() as Group);

            // Recalculate distances and filter by radius
            const updatedResults = updatedGroups
              .map((group) => {
                const distance = calculateDistance(
                  latitude,
                  longitude,
                  group.latitude,
                  group.longitude
                );
                return { group, distance };
              })
              .filter((result) => result.distance <= radius)
              .sort((a, b) => a.distance - b.distance);

            setGroups(updatedResults.map((r) => r.group));
            setDistances(updatedResults.map((r) => r.distance));
          });

          unsubscribe = () => {
            subscription.unsubscribe();
          };
        }
      } catch (err) {
        if (isMounted) {
          log.error('Failed to setup reactive nearby groups query', err);
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
  }, [locationKey, reactive]); // Re-run when location/radius changes

  return {
    groups,
    distances,
    isLoading,
    error,
  };
}
