/**
 * Favorite Service
 * Handles favorite group operations
 */

import type { FavoriteGroup } from '../domain/favorite_group';
import { post, del } from './api';
import { getDatabase } from './db';
import { getOrCreateDeviceId } from './device-storage';

/**
 * Adds a group to favorites
 * @param groupId - Group ID to favorite
 * @returns Created favorite group
 */
export async function addFavorite(groupId: string): Promise<FavoriteGroup> {
  const response = await post<FavoriteGroup>(`/groups/${groupId}/favorite`, {});

  // Store in RxDB
  const db = await getDatabase();
  await db.favorite_groups.upsert(response);

  return response;
}

/**
 * Removes a group from favorites
 * @param groupId - Group ID to unfavorite
 */
export async function removeFavorite(groupId: string): Promise<void> {
  await del(`/groups/${groupId}/favorite`);

  // Remove from RxDB
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

  if (favorite) {
    await favorite.remove();
  }
}

/**
 * Gets all favorite groups for current device
 * Note: This endpoint doesn't exist yet, so we use cached favorites
 * @returns Array of favorite groups
 */
export async function getFavorites(): Promise<FavoriteGroup[]> {
  // For now, use cached favorites
  // TODO: Add GET /favorites endpoint when needed
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

