/**
 * Collection Sync Service
 * Provides selective synchronization of specific collections
 */

import { pullDocuments } from './replication-sync';
import { type Collection, isValidCollection } from '@/shared/services/collections';

/**
 * Validates that collection names are from the allowed set
 */
function validateCollections(collections: string[]): collections is Collection[] {
  return collections.every((c) => isValidCollection(c));
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
  if (!isValidCollection(collection)) {
    throw new Error(`Invalid collection: ${collection}`);
  }

  await pullDocuments([collection], groupIds);
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
    const invalid = collections.filter((c) => !isValidCollection(c));
    throw new Error(`Invalid collections: ${invalid.join(', ')}`);
  }

  await pullDocuments(collections, groupIds);
}
