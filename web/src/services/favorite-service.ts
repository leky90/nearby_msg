/**
 * Favorite Service
 * Handles favorite group operations
 */

import type { FavoriteGroup } from '../domain/favorite_group';
import { getDatabase } from './db';
import { getOrCreateDeviceId } from './device-storage';
import { queueMutation } from './mutation-queue';
import { generateId } from '../utils/id';

/**
 * Adds a group to favorites
 * Supports offline-first: queues mutation when offline, calls API when online
 * @param groupId - Group ID to favorite
 * @returns Created favorite group (optimistic when offline)
 */
export async function addFavorite(groupId: string): Promise<FavoriteGroup> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();

  // Create optimistic favorite in RxDB immediately
  const optimisticFavorite: FavoriteGroup = {
    id: generateId(),
    device_id: deviceId,
    group_id: groupId,
    created_at: now,
  };

  // Store optimistic favorite in RxDB
  await db.favorite_groups.upsert(optimisticFavorite);

  // Queue mutation for sync (replication mechanism handles API call)
  // No direct API call - replication sync will push mutation to server
  await queueMutation(
    'add_favorite',
    'favorite_groups',
    {
      group_id: groupId,
    },
    optimisticFavorite.id
  );
  
  // Return optimistic favorite
  return optimisticFavorite;
}

/**
 * Removes a group from favorites
 * Supports offline-first: queues mutation when offline, calls API when online
 * @param groupId - Group ID to unfavorite
 */
export async function removeFavorite(groupId: string): Promise<void> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();

  // Optimistically remove from RxDB immediately
  const favorite = await db.favorite_groups
    .findOne({
      selector: {
        device_id: deviceId,
        group_id: groupId,
      },
    })
    .exec();

  const favoriteId = favorite?.toJSON()?.id;
  if (favorite) {
    await favorite.remove();
  }

  // Queue mutation for sync (replication mechanism handles API call)
  // No direct API call - replication sync will push mutation to server
  if (favoriteId) {
    await queueMutation(
      'remove_favorite',
      'favorite_groups',
      {
        group_id: groupId,
      },
      favoriteId
    );
  }
}

/**
 * Query function for fetching favorites (for TanStack Query)
 * Reads from RxDB first (since API endpoint doesn't exist yet)
 * @returns Array of favorite groups
 */
export async function fetchFavorites(): Promise<FavoriteGroup[]> {
  // For now, use cached favorites only
  // Note: GET /favorites endpoint can be added in the future if server-side filtering/sorting is needed
  // Current implementation works well with RxDB caching and replication
  return getCachedFavorites();
}

/**
 * Gets cached favorite groups from RxDB
 * @returns Array of cached favorite groups
 */
export async function getCachedFavorites(): Promise<FavoriteGroup[]> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const favorites = await db.favorite_groups
    .find({
      selector: {
        device_id: deviceId,
      },
      sort: [{ created_at: 'desc' }],
    })
    .exec();
  return favorites.map((doc) => doc.toJSON() as FavoriteGroup);
}

/**
 * Checks if a group is favorited
 * @param groupId - Group ID to check
 * @returns True if favorited
 */
export async function isFavorited(groupId: string): Promise<boolean> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const favorite = await db.favorite_groups
    .findOne({
      selector: {
        device_id: deviceId,
        group_id: groupId,
      },
    })
    .exec();
  return favorite !== null;
}

