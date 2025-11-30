/**
 * Mutation Queue Service
 * Manages pending mutations that need to be synchronized to the server
 */

import { getDatabase } from './db';
import type { Mutation, MutationType, SyncStatus, Collection } from '../domain/mutation';
import { generateId } from '../utils/id';

/**
 * Queues a mutation for synchronization
 */
export async function queueMutation(
  type: MutationType,
  collection: Collection,
  payload: Record<string, unknown>,
  entityId?: string
): Promise<Mutation> {
  const db = await getDatabase();
  const mutation: Mutation = {
    id: generateId(),
    type,
    target_collection: collection, // Use target_collection (collection is reserved in RxDB)
    entity_id: entityId ?? generateId(), // Required - use generated ID if not provided (for create operations)
    payload,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
    retry_count: 0,
  };

  await db.mutations.insert(mutation);
  return mutation;
}

/**
 * Gets all pending mutations (status: 'pending' or 'failed')
 */
export async function getPendingMutations(): Promise<Mutation[]> {
  const db = await getDatabase();
  const docs = await db.mutations
    .find({
      selector: {
        sync_status: {
          $in: ['pending', 'failed'],
        },
      },
      sort: [{ created_at: 'asc' }],
    })
    .exec();

  return docs.map((doc) => doc.toJSON() as Mutation);
}

/**
 * Gets pending mutations for a specific collection
 */
export async function getPendingMutationsForCollection(
  collection: Collection
): Promise<Mutation[]> {
  const db = await getDatabase();
  const docs = await db.mutations
    .find({
      selector: {
        target_collection: collection, // Use target_collection (collection is reserved in RxDB)
        sync_status: {
          $in: ['pending', 'failed'],
        },
      },
      sort: [{ created_at: 'asc' }],
    })
    .exec();

  return docs.map((doc) => doc.toJSON() as Mutation);
}

/**
 * Updates mutation sync status
 */
export async function updateMutationStatus(
  mutationId: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const db = await getDatabase();
  const doc = await db.mutations.findOne(mutationId).exec();
  if (!doc) {
    return;
  }

  const patch: Partial<Mutation> = {
    sync_status: status,
  };

  if (status === 'synced') {
    patch.synced_at = new Date().toISOString();
  }

  if (error) {
    patch.error_message = error; // Use error_message (error is reserved in RxDB)
  }

  if (status === 'syncing') {
    // Increment retry count when starting sync
    patch.retry_count = (doc.toJSON() as Mutation).retry_count + 1;
  }

  await doc.patch(patch);
}

/**
 * Removes a mutation from the queue (after successful sync)
 */
export async function removeMutation(mutationId: string): Promise<void> {
  const db = await getDatabase();
  const doc = await db.mutations.findOne(mutationId).exec();
  if (doc) {
    await doc.remove();
  }
}

/**
 * Discards mutations for a deleted entity (conflict resolution: server wins)
 */
export async function discardMutationsForEntity(
  collection: Collection,
  entityId: string
): Promise<void> {
  const db = await getDatabase();
  const docs = await db.mutations
    .find({
      selector: {
        target_collection: collection, // Use target_collection (collection is reserved in RxDB)
        entity_id: entityId,
        sync_status: {
          $in: ['pending', 'failed'],
        },
      },
    })
    .exec();

  // Remove all pending mutations for this entity
  await Promise.all(docs.map((doc) => doc.remove()));
}

/**
 * Gets mutation count by status
 */
export async function getMutationCounts(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
}> {
  const db = await getDatabase();
  const [pending, syncing, synced, failed] = await Promise.all([
    db.mutations.find({ selector: { sync_status: 'pending' } }).exec(),
    db.mutations.find({ selector: { sync_status: 'syncing' } }).exec(),
    db.mutations.find({ selector: { sync_status: 'synced' } }).exec(),
    db.mutations.find({ selector: { sync_status: 'failed' } }).exec(),
  ]);

  return {
    pending: pending.length,
    syncing: syncing.length,
    synced: synced.length,
    failed: failed.length,
  };
}
