/**
 * Network Status Service
 * Detects and monitors network connectivity status
 */

export type NetworkStatus = 'online' | 'offline' | 'slow';

let currentStatus: NetworkStatus = navigator.onLine ? 'online' : 'offline';
const listeners = new Set<(status: NetworkStatus) => void>();

/**
 * Gets current network status
 */
export function getNetworkStatus(): NetworkStatus {
  return currentStatus;
}

/**
 * Checks if device is online
 */
export function isOnline(): boolean {
  return currentStatus === 'online';
}

/**
 * Subscribes to network status changes
 * @param callback - Function called when status changes
 * @returns Unsubscribe function
 */
export function subscribeToNetworkStatus(
  callback: (status: NetworkStatus) => void
): () => void {
  listeners.add(callback);
  callback(currentStatus); // Call immediately with current status

  return () => {
    listeners.delete(callback);
  };
}

/**
 * Updates network status and notifies listeners
 */
function updateStatus(status: NetworkStatus): void {
  if (currentStatus !== status) {
    currentStatus = status;
    listeners.forEach((listener) => listener(status));
  }
}

/**
 * Network connection interface (Network Information API)
 */
interface NetworkConnection {
  effectiveType?: string;
  addEventListener?: (event: string, handler: () => void) => void;
}

/**
 * Detects slow connection using Network Information API
 */
function detectSlowConnection(): boolean {
  if ('connection' in navigator) {
    const nav = navigator as Navigator & {
      connection?: NetworkConnection;
      mozConnection?: NetworkConnection;
      webkitConnection?: NetworkConnection;
    };
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && conn.effectiveType) {
      // Consider slow if effectiveType is '2g' or 'slow-2g'
      return conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
    }
  }
  return false;
}

// Initialize network status listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateStatus(detectSlowConnection() ? 'slow' : 'online');
  });

  window.addEventListener('offline', () => {
    updateStatus('offline');
  });

  // Monitor connection changes (Network Information API)
  if ('connection' in navigator) {
    const nav = navigator as Navigator & {
      connection?: NetworkConnection;
      mozConnection?: NetworkConnection;
      webkitConnection?: NetworkConnection;
    };
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', () => {
        if (!navigator.onLine) {
          updateStatus('offline');
        } else if (detectSlowConnection()) {
          updateStatus('slow');
        } else {
          updateStatus('online');
        }
      });
    }
  }

  // Initial status check
  if (navigator.onLine) {
    updateStatus(detectSlowConnection() ? 'slow' : 'online');
  }
}

