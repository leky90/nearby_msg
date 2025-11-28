/**
 * Replication Orchestrator
 * Coordinates foreground/background sync for messages
 * Network-aware: pauses sync when offline, resumes when online
 */

import {
  startMessageSync,
  stopMessageSync,
  triggerImmediateSync,
} from './replication-sync';
import { migrateLegacyCheckpoint } from './replication-sync';
import { getNetworkStatus, subscribeToNetworkStatus } from './network-status';

const DEFAULT_VISIBILITY_SYNC_DELAY = 1000;

let replicationStarted = false;
let visibilityHandler: (() => void) | null = null;
let networkStatusUnsubscribe: (() => void) | null = null;

export type ReplicationOptions = {
  intervalMs?: number;
};

/**
 * Initializes replication once per session.
 * Only starts if device has been registered (has token).
 */
export function startReplication(options: ReplicationOptions = {}): void {
  if (replicationStarted) {
    return;
  }

  // Check if device is registered (has token)
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    console.log('Replication not started: Device not registered yet');
    return;
  }

  // Run checkpoint migration once at app startup
  migrateLegacyCheckpoint();

  replicationStarted = true;

  // Network-aware sync: only start if online
  const currentNetworkStatus = getNetworkStatus();
  if (currentNetworkStatus === 'online') {
    startMessageSync(options.intervalMs);
  }

  // Monitor network status changes
  networkStatusUnsubscribe = subscribeToNetworkStatus((status) => {
    if (status === 'offline') {
      // Pause sync when offline
      stopMessageSync();
      console.log('Replication paused: Network offline');
    } else if (status === 'online') {
      // Resume sync when online
      startMessageSync(options.intervalMs);
      // Trigger immediate sync when network comes back
      setTimeout(() => {
        void triggerImmediateSync();
      }, 100); // Small delay to ensure network is stable
      console.log('Replication resumed: Network online');
    }
  });

  visibilityHandler = async () => {
    if (document.visibilityState === 'visible') {
      // Only sync if online
      if (getNetworkStatus() === 'online') {
        setTimeout(() => {
          void triggerImmediateSync();
        }, DEFAULT_VISIBILITY_SYNC_DELAY);
      }
    }
  };

  document.addEventListener('visibilitychange', visibilityHandler);
}

/**
 * Stops replication and cleans up listeners.
 */
export function stopReplication(): void {
  if (!replicationStarted) {
    return;
  }

  stopMessageSync();
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (networkStatusUnsubscribe) {
    networkStatusUnsubscribe();
    networkStatusUnsubscribe = null;
  }
  replicationStarted = false;
}

