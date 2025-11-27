/**
 * RxDB database setup and initialization
 * Provides offline-first data storage using IndexedDB
 */

import { createRxDatabase, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import type { Subscription } from 'rxjs';
import type { Device } from '../domain/device';
import type { Group } from '../domain/group';
import type { Message } from '../domain/message';
import type { FavoriteGroup } from '../domain/favorite_group';
import type { PinnedMessage } from '../domain/pinned_message';
import type { UserStatus } from '../domain/user_status';

// Define collection schemas
const deviceSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    nickname: { type: 'string', maxLength: 50 },
    public_key: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['id', 'nickname', 'created_at', 'updated_at'],
  indexes: ['id'],
} as const;

const groupSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string', maxLength: 100 },
    type: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    region_code: { type: 'string' },
    creator_device_id: { type: 'string', maxLength: 100 },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['id', 'name', 'type', 'latitude', 'longitude', 'creator_device_id', 'created_at', 'updated_at'],
  indexes: ['id', 'creator_device_id'],
} as const;

const messageSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    group_id: { type: 'string', maxLength: 100 },
    device_id: { type: 'string', maxLength: 100 },
    content: { type: 'string', maxLength: 500 },
    message_type: { type: 'string' },
    sos_type: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    pinned: { type: 'boolean' },
    created_at: { type: 'string' },
    device_sequence: { type: 'number' },
    synced_at: { type: 'string' },
    sync_status: { type: 'string' },
  },
  required: ['id', 'group_id', 'device_id', 'content', 'message_type', 'pinned', 'created_at'],
  indexes: ['id', 'group_id', 'device_id', ['group_id', 'created_at']],
} as const;

const favoriteGroupSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    device_id: { type: 'string', maxLength: 100 },
    group_id: { type: 'string', maxLength: 100 },
    created_at: { type: 'string' },
  },
  required: ['id', 'device_id', 'group_id', 'created_at'],
  indexes: ['id', 'device_id', 'group_id'],
} as const;

const pinnedMessageSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    message_id: { type: 'string', maxLength: 100 },
    group_id: { type: 'string', maxLength: 100 },
    device_id: { type: 'string', maxLength: 100 },
    pinned_at: { type: 'string' },
    tag: { type: 'string', maxLength: 50 },
  },
  required: ['id', 'message_id', 'group_id', 'device_id', 'pinned_at'],
  indexes: ['id', 'message_id', 'group_id', 'device_id'],
} as const;

const userStatusSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    device_id: { type: 'string', maxLength: 100 },
    status_type: { type: 'string' },
    description: { type: 'string', maxLength: 200 },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['id', 'device_id', 'status_type', 'created_at', 'updated_at'],
  indexes: ['id', 'device_id'],
} as const;

// Database type definition
export type NearbyMsgDatabase = RxDatabase<{
  devices: RxCollection<Device>;
  groups: RxCollection<Group>;
  messages: RxCollection<Message>;
  favorite_groups: RxCollection<FavoriteGroup>;
  pinned_messages: RxCollection<PinnedMessage>;
  user_status: RxCollection<UserStatus>;
}>;

let dbInstance: NearbyMsgDatabase | null = null;
let initPromise: Promise<NearbyMsgDatabase> | null = null;

/**
 * Initializes the RxDB database
 * Uses promise-based singleton pattern to prevent race conditions
 * when multiple components call initDatabase() simultaneously
 * @returns Promise resolving to the database instance
 */
export async function initDatabase(): Promise<NearbyMsgDatabase> {
  // Return existing instance if already initialized
  if (dbInstance) {
    return dbInstance;
  }

  // If initialization is in progress, return the existing promise
  // This prevents multiple simultaneous initialization attempts
  if (initPromise) {
    return initPromise;
  }

  // Start initialization and store the promise
  initPromise = (async () => {
    try {
      // Note: We're not using dev-mode plugin because it requires validators
      // which adds complexity. The promise-based singleton pattern ensures
      // only one initialization occurs, preventing duplicate database errors.

      const database = await createRxDatabase({
        name: 'nearby_msg',
        storage: getRxStorageDexie(),
        // Don't use ignoreDuplicate - handle initialization via singleton pattern instead
      });

      // Create collections
      await database.addCollections({
        devices: {
          schema: deviceSchema,
        },
        groups: {
          schema: groupSchema,
        },
        messages: {
          schema: messageSchema,
        },
        favorite_groups: {
          schema: favoriteGroupSchema,
        },
        pinned_messages: {
          schema: pinnedMessageSchema,
        },
        user_status: {
          schema: userStatusSchema,
        },
      });

      // Store instance and clear promise
      // Type assertion needed because TypeScript can't infer the exact collection types
      // The database has the correct collections, but TypeScript sees them as generic
      dbInstance = database as unknown as NearbyMsgDatabase;
      initPromise = null;
      return database as unknown as NearbyMsgDatabase;
    } catch (err) {
      // If database already exists or other error, clear promise and rethrow
      initPromise = null;
      // If it's a duplicate database error, try to get existing instance
      if (err && typeof err === 'object' && 'message' in err && 
          String(err.message).includes('already exists')) {
        // Database might already exist from previous session
        // Try to initialize again (will get existing instance)
        return initDatabase();
      }
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Gets the database instance (initializes if needed)
 * @returns Promise resolving to the database instance
 */
export async function getDatabase(): Promise<NearbyMsgDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  return initDatabase();
}

/**
 * Closes the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.remove();
    dbInstance = null;
  }
}

/**
 * Fetches pending messages that need to be synced.
 * @returns Array of RxDB message documents with sync_status !== 'synced'
 */
export async function getPendingMessageDocs() {
  const db = await getDatabase();
  return db.messages
    .find({
      selector: {
        sync_status: {
          $ne: 'synced',
        },
      },
      sort: [{ created_at: 'asc' }],
    })
    .exec();
}

/**
 * Watches messages for a specific group and streams updates via callback.
 * @param groupId Group identifier
 * @param callback Callback invoked with ordered message list
 * @returns Unsubscribe function
 */
export async function watchGroupMessages(
  groupId: string,
  callback: (messages: Message[]) => void
): Promise<() => void> {
  const db = await getDatabase();
  const query = db.messages.find({
    selector: {
      group_id: groupId,
    },
    sort: [{ created_at: 'asc' }],
  });

  const subscription: Subscription = query.$?.subscribe((docs) => {
    const payload = docs.map((doc) => doc.toJSON() as Message);
    callback(payload);
  });

  return () => {
    subscription?.unsubscribe();
  };
}

/**
 * Marks message sync status locally.
 * @param messageId Message identifier
 * @param status Sync status value
 */
export async function updateMessageSyncStatus(
  messageId: string,
  status: Message['sync_status'],
  syncedAt?: string
): Promise<void> {
  const db = await getDatabase();
  const doc = await db.messages.findOne(messageId).exec();
  if (!doc) {
    return;
  }
  const patch: Partial<Message> = {
    sync_status: status,
  };
  if (syncedAt) {
    patch.synced_at = syncedAt;
  }
  await doc.patch(patch);
}

