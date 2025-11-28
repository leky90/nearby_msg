/**
 * Group Service
 * Handles group discovery and operations
 */

import type { Group, NearbyGroupsRequest, NearbyGroupsResponse } from '../domain/group';
import { calculateDistance } from '../domain/group';
import { get, post, put } from './api';
import { getDatabase } from './db';

/**
 * Discovers nearby groups
 * @param request - Nearby groups request with location and radius
 * @returns Promise resolving to nearby groups with distances
 */
export async function discoverNearbyGroups(
  request: NearbyGroupsRequest
): Promise<NearbyGroupsResponse> {
  try {
    const response = await get<Array<{ group: Group; distance: number; activity: number }>>(
      `/groups/nearby?latitude=${request.latitude}&longitude=${request.longitude}&radius=${request.radius}`
    );

    return {
      groups: response.map((item) => item.group),
      distances: response.map((item) => item.distance),
    };
  } catch {
    // Fallback to cached groups if API fails
    return getCachedNearbyGroups(request);
  }
}

/**
 * Gets cached nearby groups from RxDB
 * @param request - Nearby groups request
 * @returns Cached groups with calculated distances
 */
async function getCachedNearbyGroups(
  request: NearbyGroupsRequest
): Promise<NearbyGroupsResponse> {
  const db = await getDatabase();

  // Get all groups from cache
  const allGroups = await db.groups.find().exec();
  const groups = allGroups.map((doc) => doc.toJSON() as Group);

  // Calculate distances and filter by radius
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
 * @param group - Group creation data
 * @returns Created group
 */
export async function createGroup(group: {
  name: string;
  type: Group['type'];
  latitude: number;
  longitude: number;
  region_code?: string;
}): Promise<Group> {
  const response = await post<Group>('/groups', group);

  // Store in RxDB
  const db = await getDatabase();
  await db.groups.upsert(response);

  return response;
}

/**
 * Gets a group by ID
 * @param groupId - Group ID
 * @returns Group or null if not found
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  try {
    // Use path parameter instead of query parameter: /groups/{id}
    const response = await get<Group>(`/groups/${groupId}`);

    // Store in RxDB
    const db = await getDatabase();
    await db.groups.upsert(response);

    return response;
  } catch {
    // Try to get from cache
    const db = await getDatabase();
    const cached = await db.groups.findOne(groupId).exec();
    return cached ? (cached.toJSON() as Group) : null;
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
 * @param groupId - Group ID
 * @param name - New name
 * @returns Updated group
 */
export async function updateGroupName(groupId: string, name: string): Promise<Group> {
  const response = await put<Group>(`/groups/${groupId}`, { name });

  // Update in RxDB
  const db = await getDatabase();
  await db.groups.upsert(response);

  return response;
}

