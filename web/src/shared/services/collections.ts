/**
 * Collection Constants
 * Centralized definitions of valid collection names and types
 * This file serves as the single source of truth for collection names in the frontend.
 * Backend equivalent: api/internal/service/replication_service.go ValidCollections map
 */

export const VALID_COLLECTIONS = [
  'messages',
  'groups',
  'favorite_groups',
  'pinned_messages',
  'user_status',
] as const;

export type Collection = (typeof VALID_COLLECTIONS)[number];

/**
 * Validates that a collection name is from the allowed set
 */
export function isValidCollection(collection: string): collection is Collection {
  return VALID_COLLECTIONS.includes(collection as Collection);
}
