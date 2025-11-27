/**
 * Replication Orchestrator
 * Coordinates foreground/background sync for messages
 */

import { startMessageSync, stopMessageSync, triggerImmediateSync } from './message-sync';

const DEFAULT_VISIBILITY_SYNC_DELAY = 1000;

let replicationStarted = false;
let visibilityHandler: (() => void) | null = null;

export type ReplicationOptions = {
  intervalMs?: number;
};

/**
 * Initializes replication once per session.
 */
export function startReplication(options: ReplicationOptions = {}): void {
  if (replicationStarted) {
    return;
  }

  replicationStarted = true;
  startMessageSync(options.intervalMs);

  visibilityHandler = async () => {
    if (document.visibilityState === 'visible') {
      setTimeout(() => {
        void triggerImmediateSync();
      }, DEFAULT_VISIBILITY_SYNC_DELAY);
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
  replicationStarted = false;
}

