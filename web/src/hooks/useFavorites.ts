/**
 * useFavorites Hook
 * Reactive hook for querying favorite groups from RxDB
 * Uses RxDB subscriptions for real-time updates when favorites change
 */

import { useEffect, useState } from 'react';
import type { FavoriteGroup } from '../domain/favorite_group';
import { getDatabase } from '../services/db';
import { getOrCreateDeviceId } from '../services/device-storage';

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
 * Provides reactive favorite group queries from RxDB
 * Automatically updates when replication sync adds/removes favorites
 */
export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<FavoriteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupReactive = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const db = await getDatabase();
        const deviceId = getOrCreateDeviceId();

        // Initial load
        const initialFavorites = await db.favorite_groups
          .find({
            selector: {
              device_id: deviceId,
            },
            sort: [{ created_at: 'desc' }],
          })
          .exec();

        setFavorites(initialFavorites.map((doc) => doc.toJSON() as FavoriteGroup));
        setIsLoading(false);

        // Subscribe to changes for real-time updates
        const subscription = db.favorite_groups
          .find({
            selector: {
              device_id: deviceId,
            },
            sort: [{ created_at: 'desc' }],
          })
          .$.subscribe((docs) => {
            setFavorites(docs.map((doc) => doc.toJSON() as FavoriteGroup));
          });
        
        unsubscribe = () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Failed to setup reactive favorites query:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    };

    void setupReactive();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return {
    favorites,
    isLoading,
    error,
  };
}
