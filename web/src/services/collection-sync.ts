/**
 * Collection Sync Service
 * Provides selective synchronization of specific collections
 */

import { pullDocumentsFromCollections } from './replication-sync';

const VALID_COLLECTIONS = [
  'messages',
  'groups',
  'favorite_groups',
  'pinned_messages',
  'user_status',
] as const;

type Collection = (typeof VALID_COLLECTIONS)[number];

/**
 * Validates that collection names are from the allowed set
 */
function validateCollections(collections: string[]): collections is Collection[] {
  return collections.every((c) =>
    VALID_COLLECTIONS.includes(c as Collection)
  );
}

/**
 * Syncs a single collection
 * @param collection Collection name to sync
 * @param groupIds Optional group IDs filter (for messages collection only)
 */
export async function syncCollection(
  collection: string,
  groupIds?: string[]
): Promise<void> {
  if (!VALID_COLLECTIONS.includes(collection as Collection)) {
    throw new Error(`Invalid collection: ${collection}`);
  }

  await pullDocumentsFromCollections([collection], groupIds);
}

/**
 * Syncs multiple collections
 * @param collections Array of collection names to sync
 * @param groupIds Optional group IDs filter (for messages collection only)
 */
export async function syncCollections(
  collections: string[],
  groupIds?: string[]
): Promise<void> {
  if (collections.length === 0) {
    throw new Error('At least one collection must be specified');
  }

  if (!validateCollections(collections)) {
    const invalid = collections.filter(
      (c) => !VALID_COLLECTIONS.includes(c as Collection)
    );
    throw new Error(`Invalid collections: ${invalid.join(', ')}`);
  }

  await pullDocumentsFromCollections(collections, groupIds);
}
