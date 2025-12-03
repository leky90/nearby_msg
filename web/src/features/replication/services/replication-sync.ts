/**
 * Replication Sync Service
 * Handles push/pull replication cycles with the backend for multiple collections
 */

import { post } from '@/shared/services/api';
import { getDatabase, getPendingMessageDocs } from '@/shared/services/db';
import {
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  discardMutationsForEntity,
} from '@/features/replication/services/mutation-queue';
import { isOnline } from '@/shared/services/network-status';
import { getDeviceId } from '@/features/device/services/device-storage';
import { log } from "@/shared/lib/logging/logger";
import type { Message } from "@/shared/domain/message";
import type { Group } from "@/shared/domain/group";
import type { FavoriteGroup } from "@/shared/domain/favorite_group";
import type { PinnedMessage } from "@/shared/domain/pinned_message";
import type { UserStatus } from "@/shared/domain/user_status";
import type { Collection as ReplicationCollection } from '@/shared/services/collections';
import type { Collection as MutationCollection } from "@/shared/domain/mutation";
import type { NearbyMsgDatabase } from '@/shared/services/db';

const MAX_RETRIES = 1; // Only retry once for network errors, not for API errors
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Legacy checkpoint key (for migration)
const LEGACY_CHECKPOINT_KEY = 'nearby_msg_messages_checkpoint';

let isSyncRunning = false;
let retryDelay = INITIAL_RETRY_DELAY;
let migrationCompleted = false; // Track migration status to run only once

type PushPayload = {
  id: string;
  group_id: string;
  content: string;
  message_type: Message['message_type'];
  sos_type?: Message['sos_type'];
  tags?: string[];
  created_at: string;
  device_sequence?: number;
};

type Document = {
  collection: string;
  document: Message | Group | FavoriteGroup | PinnedMessage | UserStatus;
};

type DeletionSignal = {
  collection: string;
  id: string;
  deleted_at: string;
};

type PullDocumentsResponse = {
  documents: Document[];
  deletions?: DeletionSignal[]; // NEW: Deletion signals
  checkpoint: string; // Legacy field for backward compatibility
  checkpoints?: Record<string, string>; // Per-collection checkpoints: collection -> ISO timestamp
  has_more: boolean;
};

/**
 * Gets checkpoint key for a specific collection
 */
function getCheckpointKey(collection: string): string {
  return `nearby_msg_replication_checkpoint_${collection}`;
}

/**
 * Gets checkpoint for a specific collection
 */
function getCheckpoint(collection: string): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(getCheckpointKey(collection));
}

/**
 * Sets checkpoint for a specific collection
 */
function setCheckpoint(collection: string, value: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(getCheckpointKey(collection), value);
}

/**
 * Gets checkpoints for multiple collections
 */
function getCheckpointForCollections(
  collections: string[]
): Record<string, string> {
  const checkpoints: Record<string, string> = {};
  for (const collection of collections) {
    const checkpoint = getCheckpoint(collection);
    if (checkpoint) {
      checkpoints[collection] = checkpoint;
    }
  }
  return checkpoints;
}

/**
 * Updates checkpoints for multiple collections using per-collection checkpoint map.
 * Each collection's checkpoint is updated independently based on its own latest document timestamp.
 * This eliminates the bug where all collections shared the same checkpoint, which could cause
 * data inconsistency (e.g., if only messages updated, groups checkpoint would incorrectly update).
 * @param checkpoints - Map of collection names to ISO timestamp strings (e.g., { "messages": "2025-01-28T10:00:00Z", "groups": "2025-01-28T09:30:00Z" })
 */
function updateCheckpointsForCollections(
  checkpoints: Record<string, string>
): void {
  for (const [collection, checkpoint] of Object.entries(checkpoints)) {
    setCheckpoint(collection, checkpoint);
  }
}

/**
 * Migrates legacy single checkpoint to per-collection format
 * This runs once on app startup to migrate existing checkpoint data
 * Uses migrationCompleted flag to ensure it only runs once per application session
 * Exported for use in replication.ts startup
 */
export function migrateLegacyCheckpoint(): void {
  // Return early if migration already completed
  if (migrationCompleted || typeof localStorage === 'undefined') {
    return;
  }

  const legacyCheckpoint = localStorage.getItem(LEGACY_CHECKPOINT_KEY);
  if (legacyCheckpoint) {
    // Migrate to messages collection checkpoint
    setCheckpoint('messages', legacyCheckpoint);
    // Also set for other collections (they'll update on first sync)
    const collections = ['groups', 'favorite_groups', 'pinned_messages', 'user_status'];
    for (const collection of collections) {
      if (!getCheckpoint(collection)) {
        setCheckpoint(collection, legacyCheckpoint);
      }
    }
    // Remove legacy key
    localStorage.removeItem(LEGACY_CHECKPOINT_KEY);
  }

  // Mark migration as completed
  migrationCompleted = true;
}

/**
 * Checks if an error is a network error (should retry) vs API error (should not retry)
 * Network errors: TypeError (fetch failed), connection errors, timeouts
 * API errors: 4xx, 5xx status codes - should not retry to avoid spam
 */
function isNetworkError(error: unknown): boolean {
  // If error has a status property, it's an API error (from api.ts)
  if (error && typeof error === 'object' && 'status' in error) {
    return false; // API error - don't retry
  }

  // TypeError usually means network error (fetch failed, connection refused, etc)
  if (error instanceof TypeError) {
    return true; // Network error - can retry
  }

  // Check error message for network-related keywords
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const networkKeywords = [
      'network',
      'fetch',
      'connection',
      'timeout',
      'failed to fetch',
      'networkerror',
      'network request failed',
    ];
    return networkKeywords.some((keyword) => message.includes(keyword));
  }

  // Unknown error type - assume it's not a network error to avoid spam
  return false;
}

/**
 * Retries a function with exponential backoff
 * Only retries network errors, not API errors (4xx, 5xx) to avoid spam
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  // Check network status before attempting
  if (!isOnline()) {
    throw new Error('Network offline - cannot sync');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check network status before each attempt
    if (!isOnline()) {
      throw new Error('Network offline - cannot sync');
    }

    try {
      const result = await fn();
      // Reset retry state on success
      retryDelay = INITIAL_RETRY_DELAY;
      return result;
    } catch (error) {
      lastError = error as Error;

      // If network goes offline during retry, stop immediately
      if (!isOnline()) {
        throw new Error('Network offline - cannot sync');
      }

      // Check if this is a network error (should retry) or API error (should not retry)
      const shouldRetry = isNetworkError(error);

      if (!shouldRetry) {
        // API error (4xx, 5xx) - don't retry to avoid spam
        throw error;
      }

      // Network error - can retry
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          retryDelay * Math.pow(2, attempt) + Math.random() * 1000,
          MAX_RETRY_DELAY
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

async function pushPendingMessages(): Promise<void> {
  // Check network status before attempting push
  if (!isOnline()) {
    return; // Silently skip when offline
  }

  const pendingDocs = await getPendingMessageDocs();
  if (!pendingDocs.length) {
    return;
  }

  // Filter out messages that were already synced via WebSocket
  // WebSocket messages have sync_status='synced' and should not be pushed again
  const messagesToPush = pendingDocs.filter((doc) => {
    const data = doc.toJSON() as Message;
    // Only push messages with sync_status='pending' or 'failed'
    // Skip messages that were synced via WebSocket (sync_status='synced')
    return data.sync_status === 'pending' || data.sync_status === 'failed';
  });

  if (!messagesToPush.length) {
    return;
  }

  const db = await getDatabase();
  
  // Filter messages: only push messages whose group_id exists on server
  // This prevents foreign key constraint errors when group hasn't been synced yet
  // A group is considered "synced" if:
  // 1. It exists in local DB AND
  // 2. It doesn't have a pending create_group mutation (not optimistic)
  const validMessages: typeof messagesToPush = [];
  for (const doc of messagesToPush) {
    const data = doc.toJSON() as Message;
    
    // Check if group exists in local DB
    const groupDoc = await db.groups.findOne(data.group_id).exec();
    if (!groupDoc) {
      // Group doesn't exist in local DB - skip this message
      log.warn('Skipping message: group not found in local DB', {
        messageId: data.id,
        groupId: data.group_id,
      });
      continue;
    }

    // Check if group has pending create_group mutation (optimistic group)
    // If it does, the group hasn't been created on server yet
    const createGroupMutation = await db.mutations
      .findOne({
        selector: {
          target_collection: 'groups',
          type: 'create_group',
          entity_id: data.group_id,
          sync_status: { $in: ['pending', 'syncing'] },
        },
      })
      .exec();

    if (createGroupMutation) {
      // Group is optimistic (has pending create mutation) - skip this message
      // It will be pushed after group is created on server
      log.warn('Skipping message: group is optimistic (pending creation)', {
        messageId: data.id,
        groupId: data.group_id,
      });
      continue;
    }

    // Additional check: if group has same creator_device_id as current device,
    // check if there's another group with different ID (server-created group)
    // This handles the case where server created group with different ID
    const deviceId = getDeviceId() || '';
    const groupCreatorId = groupDoc.toJSON().creator_device_id;
    // creator_device_id can be null when creator device is deleted
    if (groupCreatorId !== null && groupCreatorId === deviceId) {
      const serverGroup = await db.groups
        .findOne({
          selector: {
            creator_device_id: deviceId,
            id: { $ne: data.group_id },
          },
        })
        .exec();
      
      if (serverGroup) {
        // There's a server-created group with different ID
        // This means the current group_id is optimistic and should be updated
        // Skip this message - it will be updated when group is synced
        log.warn('Skipping message: group is optimistic (server group exists with different ID)', {
          messageId: data.id,
          groupId: data.group_id,
          serverGroupId: serverGroup.id,
        });
        continue;
      }
    }

    // Group exists and is synced (no pending create mutation) - safe to push
    validMessages.push(doc);
  }

  if (!validMessages.length) {
    return;
  }

  const payload: PushPayload[] = validMessages.map((doc) => {
    const data = doc.toJSON() as Message;
    return {
      id: data.id,
      group_id: data.group_id,
      content: data.content,
      message_type: data.message_type,
      sos_type: data.sos_type,
      tags: data.tags,
      created_at: data.created_at,
      device_sequence: data.device_sequence ?? undefined,
    };
  });

  try {
    await retryWithBackoff(() => post('/replicate/push', { messages: payload }));

    const syncedAt = new Date().toISOString();
    // Only mark successfully pushed messages as synced
    await Promise.all(
      validMessages.map((doc) =>
        doc.patch({
          sync_status: 'synced',
          synced_at: syncedAt,
        })
      )
    );
  } catch (error) {
    // Mark messages as failed after all retries exhausted
    const failedAt = new Date().toISOString();
    await Promise.all(
      validMessages.map((doc) =>
        doc.patch({
          sync_status: 'failed',
          synced_at: failedAt,
        })
      )
    );
    throw error;
  }
}

/**
 * Pushes pending mutations (groups, favorites, status, devices) to server
 */
async function pushPendingMutations(): Promise<void> {
  // Check network status before attempting push
  if (!isOnline()) {
    return; // Silently skip when offline
  }

  const pendingMutations = await getPendingMutations();
  if (!pendingMutations.length) {
    return;
  }

  // Group mutations by type
  const groups: Array<{
    id: string;
    mutation_type: 'create' | 'update';
    name?: string;
    type?: string;
    latitude?: number;
    longitude?: number;
    region_code?: string;
    creator_device_id?: string;
  }> = [];
  const favorites: Array<{
    mutation_type: 'add' | 'remove';
    group_id: string;
  }> = [];
  const status: Array<{
    status_type: string;
    description?: string;
  }> = [];
  const devices: Array<{
    nickname: string;
  }> = [];

  // Mark all mutations as syncing
  await Promise.all(
    pendingMutations.map((mut) => updateMutationStatus(mut.id, 'syncing'))
  );

  // Organize mutations by type
  for (const mut of pendingMutations) {
    switch (mut.type) {
      case 'create_group':
      case 'update_group':
        groups.push({
          id: mut.entity_id || mut.id, // Note: mut.collection -> mut.target_collection (collection is reserved in RxDB)
          mutation_type: mut.type === 'create_group' ? 'create' : 'update',
          ...(mut.payload as Record<string, unknown>),
        } as typeof groups[0]);
        break;
      case 'add_favorite':
      case 'remove_favorite':
        favorites.push({
          mutation_type: mut.type === 'add_favorite' ? 'add' : 'remove',
          group_id: (mut.payload as { group_id: string }).group_id,
        });
        break;
      case 'update_status':
        status.push(mut.payload as typeof status[0]);
        break;
      case 'update_nickname':
        devices.push(mut.payload as typeof devices[0]);
        break;
    }
  }

  // Build push payload
  const payload: Record<string, unknown> = {};
  if (groups.length > 0) payload.groups = groups;
  if (favorites.length > 0) payload.favorites = favorites;
  if (status.length > 0) payload.status = status;
  if (devices.length > 0) payload.devices = devices;

  if (Object.keys(payload).length === 0) {
    return;
  }

  try {
    await retryWithBackoff(() => post('/replicate/push', payload));

    // Mark all mutations as synced and remove from queue
    await Promise.all(
      pendingMutations.map(async (mut) => {
        await updateMutationStatus(mut.id, 'synced');
        await removeMutation(mut.id);
      })
    );
  } catch (error) {
    // Mark mutations as failed after all retries exhausted
    await Promise.all(
      pendingMutations.map((mut) =>
        updateMutationStatus(mut.id, 'failed', String(error))
      )
    );
    throw error;
  }
}

/**
 * Pulls documents from multiple collections
 */
async function pullDocuments(
  collections: string[],
  groupIds?: string[],
  location?: { latitude: number; longitude: number; radius: number }
): Promise<void> {
  // Check network status before attempting pull
  if (!isOnline()) {
    return; // Silently skip when offline
  }

  // Migration is now handled at app startup in replication.ts
  // No need to call migrateLegacyCheckpoint() here anymore

  const checkpoint = getCheckpointForCollections(collections);
  const body: Record<string, unknown> = {
    collections,
    checkpoint: Object.keys(checkpoint).length > 0 ? checkpoint : undefined,
  };

  if (groupIds && groupIds.length > 0) {
    body.group_ids = groupIds;
  }

  // Add location filter for groups collection if provided
  if (location && collections.includes('groups')) {
    body.latitude = location.latitude;
    body.longitude = location.longitude;
    body.radius = location.radius;
  }

  const response = await retryWithBackoff(() =>
    post<PullDocumentsResponse>('/replicate/pull', body)
  );
  if (!response || !response.documents) {
    return;
  }

  const db = await getDatabase();

  // Document processor map - replaces switch case for cleaner, extensible code.
  // This pattern eliminates duplication and makes adding new collections trivial (just add to map).
  type DocumentProcessor = (
    doc: Message | Group | FavoriteGroup | PinnedMessage | UserStatus,
    db: NearbyMsgDatabase
  ) => Promise<void>;

  const documentProcessors: Record<ReplicationCollection, DocumentProcessor> = {
    messages: async (doc, db) => {
      await db.messages.upsert({
        ...(doc as Message),
        sync_status: 'synced',
        synced_at: (doc as Message).synced_at ?? new Date().toISOString(),
      });
    },
    groups: async (doc, db) => {
      const group = doc as Group;
      
      // Check if there's an optimistic group with same creator_device_id but different ID
      // This happens when server creates group with different ID than client's optimistic ID
      // Only query by creator_device_id if it's not null
      // RxDB doesn't allow querying with null values (QU19 error)
      const optimisticGroup = group.creator_device_id
        ? await db.groups
            .findOne({
              selector: {
                creator_device_id: group.creator_device_id,
                id: { $ne: group.id },
              },
            })
            .exec()
        : null;
      
      if (optimisticGroup) {
        const optimistic = optimisticGroup.toJSON() as Group;
        // This is the server-created group replacing optimistic group
        // Update all messages with old (optimistic) group_id to new (server) group_id
        const messagesToUpdate = await db.messages
          .find({ selector: { group_id: optimistic.id } })
          .exec();
        
        await Promise.all(
          messagesToUpdate.map((msgDoc) =>
            msgDoc.patch({ group_id: group.id })
          )
        );
        
        // Remove old optimistic group
        await optimisticGroup.remove();
      }
      
      await db.groups.upsert(group);
    },
    favorite_groups: async (doc, db) => {
      await db.favorite_groups.upsert(doc as FavoriteGroup);
    },
    pinned_messages: async (doc, db) => {
      await db.pinned_messages.upsert(doc as PinnedMessage);
    },
    user_status: async (doc, db) => {
      await db.user_status.upsert(doc as UserStatus);
    },
  };

  // Process each document using processor map
  await Promise.all(
    response.documents.map(async (doc) => {
      try {
        const processor = documentProcessors[doc.collection as ReplicationCollection];
        if (processor) {
          await processor(doc.document, db);
        } else {
          log.warn('Unknown collection type', {
            collection: doc.collection,
            validCollections: ['messages', 'groups', 'favorite_groups', 'pinned_messages', 'user_status'],
          });
        }
      } catch (error) {
        // Log error but continue processing other documents (partial failure handling)
        log.error('Failed to process document from collection', error, {
          collection: doc.collection,
        });
      }
    })
  );

  // Process deletion signals
  if (response.deletions && response.deletions.length > 0) {
    await Promise.all(
      response.deletions.map(async (deletion) => {
        try {
          const collection = deletion.collection as ReplicationCollection;
          const entityId = deletion.id;

          // Remove entity from local database
          switch (collection) {
            case 'groups': {
              const groupDoc = await db.groups.findOne(entityId).exec();
              if (groupDoc) await groupDoc.remove();
              // Discard any pending mutations for this entity (conflict resolution: server wins)
              await discardMutationsForEntity('groups', entityId);
              break;
            }
            case 'favorite_groups': {
              const favDoc = await db.favorite_groups.findOne(entityId).exec();
              if (favDoc) await favDoc.remove();
              // Discard any pending mutations for this entity (conflict resolution: server wins)
              await discardMutationsForEntity('favorite_groups', entityId);
              break;
            }
            case 'messages': {
              const msgDoc = await db.messages.findOne(entityId).exec();
              if (msgDoc) await msgDoc.remove();
              // Messages don't have mutations, so no need to discard
              break;
            }
            case 'user_status': {
              const statusDoc = await db.user_status.findOne(entityId).exec();
              if (statusDoc) await statusDoc.remove();
              // Discard any pending mutations for this entity (conflict resolution: server wins)
              // Type assertion needed because MutationCollection is a subset of ReplicationCollection
              await discardMutationsForEntity('user_status' as MutationCollection, entityId);
              break;
            }
            case 'pinned_messages':
              // Pinned messages don't have deletion sync yet (not in scope)
              break;
            default:
              log.warn('Unknown collection for deletion', { collection });
          }
        } catch (error) {
          log.error('Failed to process deletion', error, {
            collection: deletion.collection,
            id: deletion.id,
          });
        }
      })
    );
  }

  // Handle pagination: if has_more is true, client can make another request with updated checkpoint
  if (response.has_more) {
    log.debug('More documents available - client can request next page with updated checkpoint');
  }

  // Update checkpoints per collection
  // Prefer per-collection checkpoints if available, fallback to legacy single checkpoint
  if (response.checkpoints && Object.keys(response.checkpoints).length > 0) {
    // New format: per-collection checkpoints
    updateCheckpointsForCollections(response.checkpoints);
  } else if (response.checkpoint) {
    // Legacy format: single checkpoint for all collections (backward compatibility)
    // Convert to per-collection format
    const legacyCheckpoints: Record<string, string> = {};
    for (const collection of collections) {
      legacyCheckpoints[collection] = response.checkpoint;
    }
    updateCheckpointsForCollections(legacyCheckpoints);
  }
}

async function syncCycle(): Promise<void> {
  if (isSyncRunning) {
    return;
  }

  // Check network status before starting sync cycle
  if (!isOnline()) {
    // Silently skip sync when offline - replication.ts handles pausing/resuming
    return;
  }

  isSyncRunning = true;
  try {
    // Push groups first, then messages
    // This ensures groups exist on server before messages reference them
    await pushPendingMutations();
    
    // After groups are synced, push messages
    // Messages with group_id that were just created will now be valid
    await pushPendingMessages();
    
    // Pull all collections
    await pullDocuments([
      'messages',
      'groups',
      'favorite_groups',
      'pinned_messages',
      'user_status',
    ]);
  } catch (error) {
    // Only log errors if we're still online (network errors when offline are expected)
    if (isOnline()) {
      log.warn('Replication sync failed', error);
    }
    // Silently skip errors when offline - they're expected
  } finally {
    isSyncRunning = false;
  }
}


/**
 * Forces an immediate sync attempt.
 */
export async function triggerImmediateSync(): Promise<void> {
  await syncCycle();
}


// Export pullDocuments for direct use
export { pullDocuments };
