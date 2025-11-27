/**
 * Favorite Group domain model
 * Represents a user's bookmark of a group
 */

export interface FavoriteGroup {
  id: string; // NanoID (21 chars)
  device_id: string; // NanoID (21 chars)
  group_id: string; // NanoID (21 chars)
  created_at: string; // ISO timestamp
}

export interface FavoriteGroupCreateRequest {
  group_id: string; // NanoID (21 chars)
}

