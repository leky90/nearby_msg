/**
 * Data Clear Service
 * Handles clearing all user data from RxDB and localStorage
 * Single Responsibility: User data clearing
 */

import { closeDatabase } from './db';
import { stopReplication } from './replication';

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
  // Stop replication first
  stopReplication();

  // Clear RxDB - simply remove the entire database
  try {
    await closeDatabase(); // This removes the database
  } catch (error) {
    console.error('Failed to clear RxDB:', error);
    // Continue with localStorage clearing even if RxDB fails
  }

  // Clear all localStorage - simple and effective
  localStorage.clear();

  // Clear all sessionStorage - simple and effective
  sessionStorage.clear();
}
