/**
 * Mutation domain model
 * Represents a user action (create, update) that was performed offline and is waiting to be synchronized to the server
 */

export type MutationType =
  | 'create_group'
  | 'update_group'
  | 'add_favorite'
  | 'remove_favorite'
  | 'update_status'
  | 'update_nickname';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type Collection = 'groups' | 'favorite_groups' | 'user_status' | 'devices';

export interface Mutation {
  id: string; // Unique identifier (generated client-side)
  type: MutationType; // Type of mutation
  target_collection: Collection; // Target collection name (renamed from 'collection' - it's a reserved word in RxDB)
  entity_id: string; // ID of the entity being mutated (required - Dexie composite index requires all fields to be required)
  payload: Record<string, unknown>; // Mutation-specific data
  sync_status: SyncStatus; // Synchronization status
  created_at: string; // When mutation was created (ISO timestamp)
  synced_at?: string; // When mutation was successfully synced (ISO timestamp, optional)
  error_message?: string; // Error message if sync failed (optional, renamed from 'error' - it's a reserved word in RxDB)
  retry_count: number; // Number of retry attempts (default 0)
}

export interface GroupMutationPayload {
  mutation_type: 'create' | 'update';
  name?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  region_code?: string;
  creator_device_id?: string;
}

export interface FavoriteMutationPayload {
  mutation_type: 'add' | 'remove';
  group_id: string;
}

export interface StatusMutationPayload {
  status_type: string;
  description?: string;
}

export interface DeviceMutationPayload {
  nickname: string;
}

/**
 * Validates mutation type
 */
export function isValidMutationType(type: string): type is MutationType {
  return [
    'create_group',
    'update_group',
    'add_favorite',
    'remove_favorite',
    'update_status',
    'update_nickname',
  ].includes(type);
}

/**
 * Validates collection name
 */
export function isValidCollection(collection: string): collection is Collection {
  return ['groups', 'favorite_groups', 'user_status', 'devices'].includes(collection);
}

/**
 * Validates sync status
 */
export function isValidSyncStatus(status: string): status is SyncStatus {
  return ['pending', 'syncing', 'synced', 'failed'].includes(status);
}

/**
 * Validates mutation data
 */
export function validateMutation(mutation: Mutation): string | null {
  if (!isValidMutationType(mutation.type)) {
    return 'Invalid mutation type';
  }
  if (!isValidCollection(mutation.target_collection)) {
    return 'Invalid collection name';
  }
  if (!isValidSyncStatus(mutation.sync_status)) {
    return 'Invalid sync status';
  }
  if (mutation.retry_count < 0 || mutation.retry_count > 5) {
    return 'Retry count must be between 0 and 5';
  }
  if (!mutation.id || mutation.id.length === 0) {
    return 'Mutation ID is required';
  }
  if (!mutation.created_at) {
    return 'Created timestamp is required';
  }
  return null;
}
