/**
 * RxDB database setup and initialization
 * Provides offline-first data storage using IndexedDB
 */

import { createRxDatabase, type RxDatabase, type RxCollection, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import type { Subscription } from 'rxjs';
import { log } from '../lib/logging/logger';
import type { Device } from '../domain/device';
import type { Group } from '../domain/group';
import type { Message } from '../domain/message';
import type { FavoriteGroup } from '../domain/favorite_group';
import type { PinnedMessage } from '../domain/pinned_message';
import type { UserStatus } from '../domain/user_status';
import type { Mutation } from '../domain/mutation';

// Enable dev-mode plugin in development for better error messages
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
}

// Get storage with validation when dev-mode is enabled
function getStorage() {
  const dexieStorage = getRxStorageDexie();
  // Wrap with validation when in dev mode (required by dev-mode plugin)
  if (import.meta.env.DEV) {
    return wrappedValidateAjvStorage({
      storage: dexieStorage,
    });
  }
  return dexieStorage;
}

// Define collection schemas
const deviceSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    nickname: { type: 'string', maxLength: 50 },
    public_key: { type: 'string' },
    created_at: { type: 'string', maxLength: 100 },
    updated_at: { type: 'string', maxLength: 100 },
  },
  required: ['id', 'nickname', 'created_at', 'updated_at'],
  // Primary key is automatically indexed, don't include it in indexes array
  indexes: [],
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
    created_at: { type: 'string', maxLength: 100 },
    updated_at: { type: 'string', maxLength: 100 },
  },
  required: ['id', 'name', 'type', 'latitude', 'longitude', 'creator_device_id', 'created_at', 'updated_at'],
  // Primary key is automatically indexed, don't include it in indexes array
  indexes: ['creator_device_id'],
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
    created_at: { type: 'string', maxLength: 100 }, // Required maxLength for index
    device_sequence: { type: 'number' },
    synced_at: { type: 'string', maxLength: 100 },
    sync_status: { type: 'string', maxLength: 50 }, // Required maxLength for index
  },
  required: ['id', 'group_id', 'device_id', 'content', 'message_type', 'pinned', 'created_at'],
  // Primary key is automatically indexed, don't include it in indexes array
  indexes: ['group_id', 'device_id', ['group_id', 'created_at']],
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
  // Primary key is automatically indexed, don't include it in indexes array
  indexes: ['device_id', 'group_id'],
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
    pinned_at: { type: 'string', maxLength: 100 },
    tag: { type: 'string', maxLength: 50 },
  },
  required: ['id', 'message_id', 'group_id', 'device_id', 'pinned_at'],
  // Primary key is automatically indexed, don't include it in indexes array
  indexes: ['message_id', 'group_id', 'device_id'],
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
    created_at: { type: 'string', maxLength: 100 },
    updated_at: { type: 'string', maxLength: 100 },
  },
  required: ['id', 'device_id', 'status_type', 'created_at', 'updated_at'],
  // Primary key is automatically indexed, don't include it in indexes array
  indexes: ['device_id'],
} as const;

const mutationSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    type: { type: 'string', maxLength: 50 },
    target_collection: { type: 'string', maxLength: 50 }, // Renamed from 'collection' - it's a reserved word in RxDB
    entity_id: { type: 'string', maxLength: 100 },
    payload: { type: 'object' },
    sync_status: { type: 'string', maxLength: 50 }, // Required maxLength for index
    created_at: { type: 'string', maxLength: 100 },
    synced_at: { type: 'string', maxLength: 100 },
    error_message: { type: 'string', maxLength: 500 }, // Renamed from 'error' - it's a reserved word in RxDB
    retry_count: { type: 'number' },
  },
  // entity_id must be required because RxDB creates composite index ["_deleted", "entity_id", "id"]
  // Dexie storage requires all fields in composite indexes to be required
  required: ['id', 'type', 'target_collection', 'entity_id', 'sync_status', 'created_at', 'retry_count'],
  // Primary key is automatically indexed, don't include it in indexes array
  indexes: ['target_collection', 'sync_status'],
} as const;

// Database type definition
export type NearbyMsgDatabase = RxDatabase<{
  devices: RxCollection<Device>;
  groups: RxCollection<Group>;
  messages: RxCollection<Message>;
  favorite_groups: RxCollection<FavoriteGroup>;
  pinned_messages: RxCollection<PinnedMessage>;
  user_status: RxCollection<UserStatus>;
  mutations: RxCollection<Mutation>;
}>;

// Database schema version - increment this when schema structure changes
// This version tracks overall database schema changes, not individual collection versions
// Incremented to 8 to force delete old databases with DXE1 errors (made entity_id required for Dexie composite index)
const DATABASE_SCHEMA_VERSION = 8;

const DB_VERSION_KEY = 'nearby_msg_db_version';

let dbInstance: NearbyMsgDatabase | null = null;
let initPromise: Promise<NearbyMsgDatabase> | null = null;

/**
 * Initializes the RxDB database
 * Uses promise-based singleton pattern to prevent race conditions
 * when multiple components call initDatabase() simultaneously
 * @returns Promise resolving to the database instance
 */
// Track retry count to prevent infinite loops
let retryCount = 0;
const MAX_RETRIES = 2;

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
    // Check if database version has changed - if so, delete old database
    const storedVersion = localStorage.getItem(DB_VERSION_KEY);
    const currentVersion = String(DATABASE_SCHEMA_VERSION);
    
    if (!storedVersion || storedVersion !== currentVersion) {
      if (storedVersion) {
        log.info('Database schema version changed, deleting old database', {
          oldVersion: storedVersion,
          newVersion: currentVersion,
        });
      } else {
        log.info('No stored database version found, initializing', {
          version: currentVersion,
        });
      }
      // Delete database directly via IndexedDB first (before any RxDB operations)
      // This avoids DXE1 errors when trying to remove corrupted databases
      // Must delete ALL possible database names that RxDB/Dexie might use
      try {
        const dbName = 'nearby_msg';
        if (typeof indexedDB !== 'undefined') {
          // Try all possible database names that RxDB/Dexie might create
          const possibleNames = [
            `rxdb-${dbName}`,
            `rxdb-${dbName}-0`,
            `rxdb-${dbName}-1`,
            `rxdb-${dbName}-2`,
            `rxdb-${dbName}-3`,
            dbName,
            `${dbName}-0`,
            `${dbName}-1`,
          ];
          
          // Delete all databases in parallel and wait for all to complete
          await Promise.all(
            possibleNames.map(async (name) => {
              try {
                const deleteReq = indexedDB.deleteDatabase(name);
                await new Promise<void>((resolve) => {
                  deleteReq.onsuccess = () => {
                    log.debug('Deleted IndexedDB database', { name });
                    resolve();
                  };
                  deleteReq.onerror = (event) => {
                    // Don't fail - database might not exist
                    log.warn('IndexedDB delete request failed (may not exist)', event, { name });
                    resolve();
                  };
                  deleteReq.onblocked = () => {
                    // If blocked, wait longer and resolve anyway
                    log.warn('IndexedDB delete blocked, waiting', { name });
                    setTimeout(() => resolve(), 1000);
                  };
                });
              } catch (nameErr) {
                // Ignore errors for individual names - database might not exist
                log.warn('Failed to delete database (ignored)', nameErr, { name });
              }
            })
          );
          
          // Wait additional time to ensure IndexedDB deletion is fully processed
          // IndexedDB deletion is async and browser needs time to process
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        // Remove version key
        localStorage.removeItem(DB_VERSION_KEY);
        log.info('Old database deletion completed, ready to create new database');
      } catch (deleteErr) {
        log.warn('Failed to delete old database during version migration', deleteErr);
        // Continue anyway - might still work, or will be handled by DB6 retry logic
      }
    }
    try {
      // Note: We're not using dev-mode plugin because it requires validators
      // which adds complexity. The promise-based singleton pattern ensures
      // only one initialization occurs, preventing duplicate database errors.

      // Try to create database with closeDuplicates to handle existing instances
      // Use multiInstance: false for single-window apps to avoid coordination overhead
      let database: RxDatabase;
      try {
        database = await createRxDatabase({
          name: 'nearby_msg',
          storage: getStorage(),
          // Close any existing instances with the same name to prevent DB9 errors
          // This is better than ignoreDuplicate as it ensures only one instance exists
          closeDuplicates: true,
          // Set multiInstance: false for single-window apps (reduces overhead)
          multiInstance: false,
        });
      } catch (createErr) {
        // If DB9 or DXE1 error persists, it might be a schema/index mismatch
        // Only delete and recreate if version changed (already checked above)
        const errCode = createErr && typeof createErr === 'object' && 'code' in createErr
          ? String(createErr.code)
          : '';
        const errMessage = createErr && typeof createErr === 'object' && 'message' in createErr
          ? String(createErr.message)
          : String(createErr);
        
        // DXE1 is Dexie index error - usually means schema mismatch
        if (errCode === 'DB9' || errCode === 'DXE1' || errMessage.includes('DB9') || errMessage.includes('DXE1')) {
          // Only delete if version changed (already handled above) or if it's a persistent error
          // For DXE1, we need to delete to fix index conflicts
          if (errCode === 'DXE1' || errMessage.includes('DXE1')) {
            log.warn('DXE1 index error detected, deleting database to fix index conflicts');
            try {
              await deleteDatabase();
              await new Promise(resolve => setTimeout(resolve, 200));
              // Try creating again
              database = await createRxDatabase({
                name: 'nearby_msg',
                storage: getStorage(),
                closeDuplicates: true,
                multiInstance: false,
              });
            } catch (recreateErr) {
              log.error('Failed to recreate database after DXE1 error', recreateErr);
              throw createErr; // Throw original error
            }
          } else {
            // For DB9, only delete if version changed
            throw createErr;
          }
        } else {
          throw createErr;
        }
      }

      // Create collections
      try {
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
          mutations: {
            schema: mutationSchema,
          },
        });
      } catch (addCollectionsErr) {
        // DXE1 and DB6 can occur when adding collections if schema/index conflicts exist
        const addErrCode = addCollectionsErr && typeof addCollectionsErr === 'object' && 'code' in addCollectionsErr
          ? String(addCollectionsErr.code)
          : '';
        const addErrMessage = addCollectionsErr && typeof addCollectionsErr === 'object' && 'message' in addCollectionsErr
          ? String(addCollectionsErr.message)
          : String(addCollectionsErr);
        
        // DB6 = schema mismatch (another instance created collection with different schema)
        // DXE1 = index conflict
        if (addErrCode === 'DXE1' || addErrCode === 'DB6' || addErrMessage.includes('DXE1') || addErrMessage.includes('DB6')) {
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            log.error(`${addErrCode} error persists after multiple retries. Giving up.`);
            retryCount = 0; // Reset for next attempt
            throw new Error(`Failed to initialize database after multiple attempts due to schema conflicts (${addErrCode}). Please clear browser data manually.`);
          }
          
          log.warn(`${addErrCode} error when adding collections, deleting database to fix schema conflicts`, {
            retryCount,
            maxRetries: MAX_RETRIES,
            errorCode: addErrCode,
          });
          // Close current database instance (may fail with DXE1/DB6, handled in closeDatabase)
          try {
            dbInstance = database as unknown as NearbyMsgDatabase;
            await closeDatabase();
          } catch (removeErr) {
            // Ignore errors when removing - database may be corrupted
            log.warn('Error closing database instance (ignored)', removeErr);
            dbInstance = null;
          }
          // Delete and recreate - this will handle schema conflicts gracefully
          await deleteDatabase();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait longer for IndexedDB cleanup
          // IMPORTANT: Don't reset initPromise here - keep it to prevent race conditions
          // Instead, retry within the same promise by restarting the initialization logic
          dbInstance = null;
          
          // Retry by restarting the initialization process within the same promise
          // This avoids calling initDatabase() recursively which would return the same promise
          // Restart from the beginning of the async function
          const currentVersion = String(DATABASE_SCHEMA_VERSION);
          
          // Skip version check on retry (already handled in first attempt)
          // Go directly to creating the database
          database = await createRxDatabase({
            name: 'nearby_msg',
            storage: getStorage(),
            closeDuplicates: true,
            multiInstance: false,
          });
          
          // Try adding collections again
          await database.addCollections({
            devices: { schema: deviceSchema },
            groups: { schema: groupSchema },
            messages: { schema: messageSchema },
            favorite_groups: { schema: favoriteGroupSchema },
            pinned_messages: { schema: pinnedMessageSchema },
            user_status: { schema: userStatusSchema },
            mutations: { schema: mutationSchema },
          });
          
          // Success - continue with normal flow
          dbInstance = database as unknown as NearbyMsgDatabase;
          localStorage.setItem(DB_VERSION_KEY, currentVersion);
          retryCount = 0;
          initPromise = null;
          return database as unknown as NearbyMsgDatabase;
        }
        throw addCollectionsErr;
      }

      // Store instance and clear promise
      // Type assertion needed because TypeScript can't infer the exact collection types
      // The database has the correct collections, but TypeScript sees them as generic
      dbInstance = database as unknown as NearbyMsgDatabase;
      
      // Save current database version to localStorage
      localStorage.setItem(DB_VERSION_KEY, currentVersion);
      
      // Reset retry count on successful initialization
      retryCount = 0;
      // Clear initPromise only after successful initialization
      // This ensures other waiting calls will get the instance
      initPromise = null;
      return database as unknown as NearbyMsgDatabase;
    } catch (err) {
      // If database already exists or other error, clear promise and rethrow
      // IMPORTANT: Only clear initPromise after we're done with this attempt
      // Don't clear it here - let the caller handle it
      const errMessage = err && typeof err === 'object' && 'message' in err 
        ? String(err.message) 
        : String(err);
      const errCode = err && typeof err === 'object' && 'code' in err
        ? String(err.code)
        : '';
      
      if (errMessage.includes('already exists') || 
          errMessage.includes('DB8') ||
          errMessage.includes('DB9') ||
          errCode === 'DB8' ||
          errCode === 'DB9') {
        // Database might already exist from previous session
        // Try to get existing database instance
        // IMPORTANT: Check if another call already created the instance
        if (dbInstance) {
          return dbInstance;
        }
        try {
          // Try to get existing database by creating a new connection
          // This will work if database already exists
          // Use closeDuplicates to ensure we don't create multiple instances
          const existingDb = await createRxDatabase({
            name: 'nearby_msg',
            storage: getStorage(),
            closeDuplicates: true,
            multiInstance: false,
          });
          
          // Add collections if they don't exist
          if (!existingDb.devices) {
            await existingDb.addCollections({
              devices: { schema: deviceSchema },
              groups: { schema: groupSchema },
              messages: { schema: messageSchema },
              favorite_groups: { schema: favoriteGroupSchema },
              pinned_messages: { schema: pinnedMessageSchema },
              user_status: { schema: userStatusSchema },
              mutations: { schema: mutationSchema },
            });
          }
          
          // Store instance before returning
          dbInstance = existingDb as unknown as NearbyMsgDatabase;
          // Save version to prevent re-initialization
          localStorage.setItem(DB_VERSION_KEY, String(DATABASE_SCHEMA_VERSION));
          return existingDb as unknown as NearbyMsgDatabase;
        } catch (retryErr) {
          // If retry also fails, throw original error
          log.error('Failed to recover from duplicate database error', retryErr);
          throw err;
        }
      }
      throw err;
    } finally {
      // Only clear initPromise after successful completion or final failure
      // This ensures we don't have race conditions
      if (!dbInstance) {
        // Only clear if we didn't successfully create an instance
        // This allows retries to work correctly
      }
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
  try {
    return await initDatabase();
  } catch (err) {
    // If initialization fails, try to recover
    // Clear instance and promise to allow retry
    dbInstance = null;
    initPromise = null;
    
    // Check if it's a duplicate database error
    const errMessage = err && typeof err === 'object' && 'message' in err 
      ? String(err.message) 
      : String(err);
    const errCode = err && typeof err === 'object' && 'code' in err
      ? String(err.code)
      : '';
    
    if (errMessage.includes('already exists') || 
        errMessage.includes('DB8') ||
        errMessage.includes('DB9') ||
        errCode === 'DB8' ||
        errCode === 'DB9') {
      // Check if another call already created the instance
      if (dbInstance) {
        return dbInstance;
      }
      // Try one more time with closeDuplicates
      try {
        const recoveredDb = await createRxDatabase({
          name: 'nearby_msg',
          storage: getStorage(),
          closeDuplicates: true,
          multiInstance: false,
        });
        
        // Add collections if needed
        if (!recoveredDb.devices) {
          await recoveredDb.addCollections({
            devices: { schema: deviceSchema },
            groups: { schema: groupSchema },
            messages: { schema: messageSchema },
            favorite_groups: { schema: favoriteGroupSchema },
            pinned_messages: { schema: pinnedMessageSchema },
            user_status: { schema: userStatusSchema },
            mutations: { schema: mutationSchema },
          });
        }
        
          // Store instance and save version
          dbInstance = recoveredDb as unknown as NearbyMsgDatabase;
          localStorage.setItem(DB_VERSION_KEY, String(DATABASE_SCHEMA_VERSION));
          return recoveredDb as unknown as NearbyMsgDatabase;
      } catch (recoveryErr) {
        log.error('Failed to recover database', recoveryErr);
        throw err; // Throw original error
      }
    }
    throw err;
  }
}

/**
 * Closes the database connection
 * Handles DXE1 errors gracefully when database schema is corrupted
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.remove();
    } catch (removeErr) {
      // DXE1 can occur when removing corrupted databases - ignore and continue
      const errCode = removeErr && typeof removeErr === 'object' && 'code' in removeErr
        ? String(removeErr.code)
        : '';
      const errMessage = removeErr && typeof removeErr === 'object' && 'message' in removeErr
        ? String(removeErr.message)
        : String(removeErr);
      
      if (errCode === 'DXE1' || errCode === 'DB6' || errMessage.includes('DXE1') || errMessage.includes('DB6')) {
        log.warn('Error removing database instance (schema mismatch, will use direct IndexedDB deletion)', removeErr);
      } else {
        // Re-throw non-schema errors
        throw removeErr;
      }
    }
    dbInstance = null;
  }
  initPromise = null;
}

/**
 * Deletes the database completely (removes all data)
 * Use with caution - this will delete all local data
 * Uses direct IndexedDB deletion to avoid DXE1 errors with corrupted databases
 */
export async function deleteDatabase(): Promise<void> {
  // Clear instance references first (don't try to close - may fail with DXE1)
  dbInstance = null;
  initPromise = null;
  
  // Delete the database from IndexedDB directly (bypass RxDB completely to avoid DXE1)
  // This is more reliable when database is corrupted
  try {
    const dbName = 'nearby_msg';
    if (typeof indexedDB !== 'undefined') {
      // Try to delete all possible database names that RxDB/Dexie might use
      const possibleNames = [
        `rxdb-${dbName}`,
        `rxdb-${dbName}-0`,
        `rxdb-${dbName}-1`,
        `rxdb-${dbName}-2`,
        dbName,
      ];
      
      // Delete all databases in parallel for faster cleanup
      await Promise.all(
        possibleNames.map(async (name) => {
          try {
            const deleteReq = indexedDB.deleteDatabase(name);
            await new Promise<void>((resolve) => {
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => resolve(); // Don't fail - just continue
              deleteReq.onblocked = () => {
                // If blocked, wait longer and resolve anyway
                setTimeout(() => resolve(), 500);
              };
            });
          } catch (nameErr) {
            // Ignore errors for individual names
            log.warn('Failed to delete database (ignored)', nameErr, { name });
          }
        })
      );
    }
    
    // Also remove version key from localStorage
    localStorage.removeItem(DB_VERSION_KEY);
  } catch (err) {
    // Don't throw - just log. Direct IndexedDB deletion should work even if RxDB fails
    log.warn('Error during database deletion (non-critical)', err);
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

