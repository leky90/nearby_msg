/**
 * Replication Sync Service
 * Handles push/pull replication cycles with the backend for multiple collections
 */

import { post } from './api';
import { getDatabase, getPendingMessageDocs } from './db';
import type { Message } from '../domain/message';
import type { Group } from '../domain/group';
import type { FavoriteGroup } from '../domain/favorite_group';
import type { PinnedMessage } from '../domain/pinned_message';
import type { UserStatus } from '../domain/user_status';
import type { Collection } from './collections';
import type { NearbyMsgDatabase } from './db';

const DEFAULT_SYNC_INTERVAL = 5000;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Legacy checkpoint key (for migration)
const LEGACY_CHECKPOINT_KEY = 'nearby_msg_messages_checkpoint';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
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

type PullDocumentsResponse = {
  documents: Document[];
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
 * Retries a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      // Reset retry state on success
      retryDelay = INITIAL_RETRY_DELAY;
      return result;
    } catch (error) {
      lastError = error as Error;

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
  const pendingDocs = await getPendingMessageDocs();
  if (!pendingDocs.length) {
    return;
  }

  const payload: PushPayload[] = pendingDocs.map((doc) => {
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
    await Promise.all(
      pendingDocs.map((doc) =>
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
      pendingDocs.map((doc) =>
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
 * Pulls documents from multiple collections
 */
async function pullDocuments(
  collections: string[],
  groupIds?: string[]
): Promise<void> {
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

  const documentProcessors: Record<Collection, DocumentProcessor> = {
    messages: async (doc, db) => {
      await db.messages.upsert({
        ...(doc as Message),
        sync_status: 'synced',
        synced_at: (doc as Message).synced_at ?? new Date().toISOString(),
      });
    },
    groups: async (doc, db) => {
      await db.groups.upsert(doc as Group);
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
        const processor = documentProcessors[doc.collection as Collection];
        if (processor) {
          await processor(doc.document, db);
        } else {
          console.warn(
            `Unknown collection type: ${doc.collection}. Valid collections: messages, groups, favorite_groups, pinned_messages, user_status`
          );
        }
      } catch (error) {
        // Log error but continue processing other documents (partial failure handling)
        console.error(
          `Failed to process document from collection ${doc.collection}:`,
          error
        );
      }
    })
  );

  // Handle pagination: if has_more is true, client can make another request with updated checkpoint
  if (response.has_more) {
    console.log('More documents available - client can request next page with updated checkpoint');
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
  isSyncRunning = true;
  try {
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
    console.warn('Replication sync failed', error);
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Starts the recurring sync loop.
 * @param intervalMs Sync interval in milliseconds
 */
export function startMessageSync(intervalMs: number = DEFAULT_SYNC_INTERVAL): void {
  if (syncTimer) {
    return;
  }

  const run = async () => {
    await syncCycle();
    syncTimer = setTimeout(run, intervalMs);
  };

  void run();
}

/**
 * Stops the recurring sync loop.
 */
export function stopMessageSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

/**
 * Forces an immediate sync attempt.
 */
export async function triggerImmediateSync(): Promise<void> {
  await syncCycle();
}

/**
 * Pulls documents from specific collections
 * @param collections Array of collection names to sync
 * @param groupIds Optional array of group IDs to filter messages
 * @deprecated Use pullDocuments directly instead
 */
export async function pullDocumentsFromCollections(
  collections: string[],
  groupIds?: string[]
): Promise<void> {
  await pullDocuments(collections, groupIds);
}

// Export pullDocuments for direct use
export { pullDocuments };
