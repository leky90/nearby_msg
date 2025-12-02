/**
 * Data Clear Service
 * Handles clearing all user data from RxDB and localStorage
 * Single Responsibility: User data clearing
 */

import { closeDatabase } from '@/shared/services/db';
import { stopReplication } from './replication';
import { log } from "@/shared/lib/logging/logger";

/**
 * Clears all user data from RxDB and localStorage
 * This includes:
 * - All RxDB collections (messages, groups, favorites, etc.)
 * - All localStorage data (checkpoints, device data, tokens, etc.)
 * - Stops replication
 * 
 * WARNING: This will delete ALL local data. User will need to re-register.
 */
export async function clearAllUserData(): Promise<void> {
  log.info('[CLEAR_ALL_USER_DATA] Step 1: Stopping replication');
  // Stop replication first
  stopReplication();
  log.info('[CLEAR_ALL_USER_DATA] Step 1: Replication stopped');

  // Clear RxDB - simply remove the entire database
  log.info('[CLEAR_ALL_USER_DATA] Step 2: Closing RxDB database');
  try {
    await closeDatabase(); // This removes the database
    log.info('[CLEAR_ALL_USER_DATA] Step 2: RxDB database closed successfully');
  } catch (error) {
    log.error('[CLEAR_ALL_USER_DATA] Step 2: Failed to clear RxDB (continuing)', error);
    // Continue with localStorage clearing even if RxDB fails
  }

  // Clear all localStorage - simple and effective
  log.info('[CLEAR_ALL_USER_DATA] Step 3: Clearing localStorage');
  localStorage.clear();
  log.info('[CLEAR_ALL_USER_DATA] Step 3: localStorage cleared');

  // Clear all sessionStorage - simple and effective
  log.info('[CLEAR_ALL_USER_DATA] Step 4: Clearing sessionStorage');
  sessionStorage.clear();
  log.info('[CLEAR_ALL_USER_DATA] Step 4: sessionStorage cleared');
  
  log.info('[CLEAR_ALL_USER_DATA] Step 5: All user data cleared - PROCESS COMPLETE');
}
