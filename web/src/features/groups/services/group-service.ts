/**
 * Group Service
 * Handles group discovery and operations
 */

import type { Group, NearbyGroupsRequest, NearbyGroupsResponse } from "@/shared/domain/group";
import { calculateDistance } from "@/shared/domain/group";
import { get, post } from '@/shared/services/api';
import { getDatabase } from '@/shared/services/db';
import { queueMutation } from '@/features/replication/services/mutation-queue';
import { generateId } from "@/shared/utils/id";
import { isOnline } from '@/shared/services/network-status';
import { getDeviceId } from '@/features/device/services/device-storage';

/**
 * Discovers nearby groups using cache-first approach.
 * Reads from RxDB first (groups already synced via replication), only calls API if needed.
 * @param request - Nearby groups request with location and radius
 * @returns Promise resolving to nearby groups with distances
 */
export async function discoverNearbyGroups(
  request: NearbyGroupsRequest
): Promise<NearbyGroupsResponse> {
  // Cache-first: Try RxDB first (groups already synced via replication)
  const cachedResult = await getCachedNearbyGroups(request);
  
  // If we have groups in cache, use them (no API call needed)
  // Replication sync keeps cache fresh (every 5 seconds), so cached groups are up-to-date
  if (cachedResult.groups.length > 0) {
    return cachedResult;
  }
  
  // Cache miss or empty: Fallback to API to discover new groups
  // This happens on first load or when no groups in area yet
  try {
    const response = await get<Array<{ group: Group; distance: number; activity: number }>>(
      `/groups/nearby?latitude=${request.latitude}&longitude=${request.longitude}&radius=${request.radius}`
    );

    const groups = response.map((item) => item.group);
    const distances = response.map((item) => item.distance);
    
    // Store newly discovered groups in RxDB for future cache hits
    const db = await getDatabase();
    await Promise.all(groups.map((group) => db.groups.upsert(group)));

    return { groups, distances };
  } catch {
    // If API fails, return empty result (already tried cache)
    return { groups: [], distances: [] };
  }
}

/**
 * Gets cached nearby groups from RxDB.
 * Filters groups by location and radius, calculates distances locally.
 * This eliminates API calls when groups are already synced via replication.
 * @param request - Nearby groups request
 * @returns Cached groups with calculated distances
 */
async function getCachedNearbyGroups(
  request: NearbyGroupsRequest
): Promise<NearbyGroupsResponse> {
  const db = await getDatabase();

  // Get all groups from cache (already synced via replication)
  const allGroups = await db.groups.find().exec();
  const groups = allGroups.map((doc) => doc.toJSON() as Group);

  // Calculate distances and filter by radius locally
  // No API call needed - all calculation done client-side
  const results = groups
    .map((group) => {
      const distance = calculateDistance(
        request.latitude,
        request.longitude,
        group.latitude,
        group.longitude
      );
      return { group, distance };
    })
    .filter((result) => result.distance <= request.radius)
    .sort((a, b) => a.distance - b.distance);

  return {
    groups: results.map((r) => r.group),
    distances: results.map((r) => r.distance),
  };
}

/**
 * Creates a new group
 * Supports offline-first: queues mutation when offline, calls API when online
 * Checks if device already has a group before creating (prevents duplicate groups)
 * @param group - Group creation data
 * @returns Created group (optimistic when offline)
 * @throws Error if device already has a group
 */
export async function createGroup(group: {
  name: string;
  type: Group['type'];
  latitude: number;
  longitude: number;
  region_code?: string;
}): Promise<Group> {
  const db = await getDatabase();
  const deviceId = getDeviceId() || '';

  // Check if device already has a group (prevent duplicate creation)
  const existingGroup = await db.groups
    .findOne({ selector: { creator_device_id: deviceId } })
    .exec();
  
  if (existingGroup) {
    throw new Error('device has already created a group');
  }

  // Generate temporary ID for optimistic group
  const tempGroupId = generateId();
  const now = new Date().toISOString();

  // Create optimistic group in RxDB immediately
  const optimisticGroup: Group = {
    id: tempGroupId,
    name: group.name,
    type: group.type,
    latitude: group.latitude,
    longitude: group.longitude,
    region_code: group.region_code,
    creator_device_id: deviceId,
    created_at: now,
    updated_at: now,
  };

  // Store optimistic group in RxDB
  await db.groups.upsert(optimisticGroup);

  // Check if online
  if (isOnline()) {
    try {
      // Online: Call API directly
      const response = await post<Group>('/groups', group);

      // Replace optimistic group with server response
      await db.groups.upsert(response);

      // Remove optimistic group if ID changed
      if (response.id !== tempGroupId) {
        await db.groups.findOne(tempGroupId).remove();
      }

      return response;
    } catch (err) {
      // Check if error is "already created group" (409 Conflict)
      const isApiError = err && typeof err === 'object' && 'status' in err;
      const status = isApiError ? (err as { status: number }).status : undefined;
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      if (
        status === 409 ||
        errorMessage.includes('already created') ||
        errorMessage.includes('409') ||
        errorMessage.includes('Conflict')
      ) {
        // Remove optimistic group on conflict
        try {
          const optimisticDoc = await db.groups.findOne(tempGroupId).exec();
          if (optimisticDoc) {
            await optimisticDoc.remove();
          }
        } catch {
          // Ignore removal errors
        }
        throw new Error('device has already created a group');
      }

      // Other API errors: queue mutation for retry
      await queueMutation(
        'create_group',
        'groups',
        {
          name: group.name,
          type: group.type,
          latitude: group.latitude,
          longitude: group.longitude,
          region_code: group.region_code,
          creator_device_id: deviceId,
        },
        tempGroupId
      );
      // Return optimistic group
      return optimisticGroup;
    }
  } else {
    // Offline: Queue mutation for sync when online
    await queueMutation(
      'create_group',
      'groups',
      {
        name: group.name,
        type: group.type,
        latitude: group.latitude,
        longitude: group.longitude,
        region_code: group.region_code,
        creator_device_id: deviceId,
      },
      tempGroupId
    );
    // Return optimistic group
    return optimisticGroup;
  }
}

/**
 * Checks if the current device has already created a group
 * @returns The group created by current device, or null if none exists
 */
export async function getDeviceCreatedGroup(): Promise<Group | null> {
  const db = await getDatabase();
  const deviceId = getDeviceId();
  
  if (!deviceId) {
    return null;
  }
  
  const groupDoc = await db.groups
    .findOne({ selector: { creator_device_id: deviceId } })
    .exec();
  
  return groupDoc ? (groupDoc.toJSON() as Group) : null;
}

/**
 * Gets a group by ID from RxDB (synced via replication).
 * RxDB-first approach: reads from local cache, only falls back to API on cache miss.
 * 
 * Performance: Eliminates unnecessary API calls when groups are already synced.
 * Replication sync keeps cache fresh (every 5 seconds), so cached groups are up-to-date.
 * 
 * @param groupId - Group ID
 * @returns Group or null if not found
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  // RxDB-first: Read from cache (synced via replication mechanism)
  const db = await getDatabase();
  const cached = await db.groups.findOne(groupId).exec();
  
  if (cached) {
    // Group found in cache, return immediately (no API call)
    // Cache is kept fresh by replication sync (every 5 seconds)
    return cached.toJSON() as Group;
  }
  
  // Cache miss: Fallback to API only if group not in local DB
  // This happens on first load or if group was deleted locally
  try {
    const response = await get<Group>(`/groups/${groupId}`);
    // Store in RxDB for future cache hits
    await db.groups.upsert(response);
    return response;
  } catch {
    // API failed or group not found
    return null;
  }
}

/**
 * Group suggestion response
 */
export interface GroupSuggestion {
  suggested_name: string;
  suggested_type: Group['type'];
}

/**
 * Gets group name and type suggestions based on location
 * @param latitude - Latitude
 * @param longitude - Longitude
 * @returns Promise resolving to suggestion
 */
export async function suggestGroupNameAndType(
  latitude: number,
  longitude: number
): Promise<GroupSuggestion> {
  try {
    const response = await get<GroupSuggestion>(
      `/groups/suggest?latitude=${latitude}&longitude=${longitude}`
    );
    return response;
  } catch {
    // Fallback to default suggestion
    return {
      suggested_name: '',
      suggested_type: 'village',
    };
  }
}

/**
 * Updates a group's name
 * Supports offline-first: queues mutation when offline, calls API when online
 * @param groupId - Group ID
 * @param name - New name
 * @returns Updated group (optimistic when offline)
 */
export async function updateGroupName(groupId: string, name: string): Promise<Group> {
  const db = await getDatabase();

  // Get existing group for optimistic update
  const existingGroup = await db.groups.findOne(groupId).exec();
  if (!existingGroup) {
    throw new Error('Group not found');
  }

  const existing = existingGroup.toJSON() as Group;
  const now = new Date().toISOString();

  // Create optimistic update in RxDB immediately
  const optimisticGroup: Group = {
    ...existing,
    name,
    updated_at: now,
  };

  // Store optimistic update in RxDB
  await db.groups.upsert(optimisticGroup);

  // Queue mutation for sync (replication mechanism handles API call)
  // No direct API call - replication sync will push mutation to server
  await queueMutation(
    'update_group',
    'groups',
    {
      name,
    },
    groupId
  );
  
  // Return optimistic update
  return optimisticGroup;
}

