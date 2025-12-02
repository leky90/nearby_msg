/**
 * Replication Orchestrator
 * Coordinates foreground/background sync for messages
 * Network-aware: pauses sync when offline, resumes when online
 */

import { triggerImmediateSync } from './replication-sync';
import { migrateLegacyCheckpoint } from './replication-sync';
import { getNetworkStatus, subscribeToNetworkStatus } from '@/shared/services/network-status';
import { log } from "@/shared/lib/logging/logger";

const DEFAULT_VISIBILITY_SYNC_DELAY = 1000;

let replicationStarted = false;
let visibilityHandler: (() => void) | null = null;
let networkStatusUnsubscribe: (() => void) | null = null;

/**
 * Initializes replication once per session.
 * Only starts if device has been registered (has token).
 */
export function startReplication(): void {
  if (replicationStarted) {
    return;
  }

  // Check if device is registered (has token)
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    log.debug('Replication not started: Device not registered yet');
    return;
  }

  // Run checkpoint migration once at app startup
  migrateLegacyCheckpoint();

  replicationStarted = true;

  // Network-aware behavior: if online on startup, perform a one-shot sync.
  const currentNetworkStatus = getNetworkStatus();
  if (currentNetworkStatus === 'online') {
    void triggerImmediateSync();
  }

  // Monitor network status changes
  networkStatusUnsubscribe = subscribeToNetworkStatus((status) => {
    if (status === 'offline') {
      // Sync is handled via WebSocket, no action needed when offline
      log.debug('Network offline - WebSocket will handle reconnection');
    } else if (status === 'online') {
      // Trigger a one-shot sync when network comes back
      setTimeout(() => {
        void triggerImmediateSync();
      }, 100); // Small delay to ensure network is stable
      log.debug('Replication resumed: Network online (single sync)');
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
  log.info('[STOP_REPLICATION] Starting replication stop', { replicationStarted });
  if (!replicationStarted) {
    log.info('[STOP_REPLICATION] Replication not started, skipping');
    return;
  }

  if (visibilityHandler) {
    log.info('[STOP_REPLICATION] Removing visibility change handler');
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (networkStatusUnsubscribe) {
    log.info('[STOP_REPLICATION] Unsubscribing from network status');
    networkStatusUnsubscribe();
    networkStatusUnsubscribe = null;
  }
  replicationStarted = false;
  log.info('[STOP_REPLICATION] Replication stopped successfully');
}

