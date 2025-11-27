/**
 * Service Worker for Background Sync
 * Handles offline message synchronization when connection is restored
 */

const CACHE_NAME = "nearby-msg-v1";
const SYNC_TAG = "sync-messages";

// Install event: Cache offline fallback
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  self.skipWaiting(); // Activate immediately
});

// Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("[Service Worker] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Background Sync: Sync pending messages when online
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    console.log("[Service Worker] Background sync triggered");
    event.waitUntil(syncPendingMessages());
  }
});

/**
 * Sync pending messages to server
 */
async function syncPendingMessages() {
  try {
    // Get pending messages from IndexedDB
    const db = await openIndexedDB();
    const pendingMessages = await getPendingMessages(db);

    if (pendingMessages.length === 0) {
      console.log("[Service Worker] No pending messages to sync");
      return;
    }

    console.log(
      `[Service Worker] Syncing ${pendingMessages.length} pending messages`
    );

    // Get device ID from storage
    const deviceId = await getDeviceId();

    // Sync each message
    const results = await Promise.allSettled(
      pendingMessages.map((message) => syncMessage(message, deviceId))
    );

    // Count successes and failures
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `[Service Worker] Sync complete: ${successful} succeeded, ${failed} failed`
    );

    // Update sync status in IndexedDB
    await updateSyncStatus(db, results);

    // Show notification if there were failures
    if (failed > 0) {
      self.registration.showNotification("Message Sync", {
        body: `${failed} message(s) failed to sync. They will be retried automatically.`,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: "sync-failed",
      });
    }
  } catch (error) {
    console.error("[Service Worker] Error syncing messages:", error);
  }
}

/**
 * Sync a single message to the server
 */
async function syncMessage(message, deviceId) {
  const response = await fetch("/v1/replication/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify({
      device_id: deviceId,
      messages: [
        {
          id: message.id,
          group_id: message.group_id,
          content: message.content,
          message_type: message.message_type,
          sos_type: message.sos_type,
          tags: message.tags,
          device_sequence: message.device_sequence,
          created_at: message.created_at,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Open IndexedDB connection
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rxdb-nearby-msg", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get pending messages from IndexedDB
 */
async function getPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["messages"], "readonly");
    const store = transaction.objectStore("messages");
    const index = store.index("sync_status");
    const request = index.getAll("pending");

    request.onsuccess = () => {
      const messages = request.result.filter(
        (msg) => msg.sync_status === "pending" || msg.sync_status === "failed"
      );
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update sync status in IndexedDB
 */
async function updateSyncStatus(db, results) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["messages"], "readwrite");
    const store = transaction.objectStore("messages");

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        // Mark as synced
        const message = result.value;
        const updateRequest = store.put({
          ...message,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
        });
        updateRequest.onsuccess = () => {
          if (index === results.length - 1) resolve();
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        // Mark as failed for retry
        const updateRequest = store.put({
          ...message,
          sync_status: "failed",
        });
        updateRequest.onsuccess = () => {
          if (index === results.length - 1) resolve();
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      }
    });
  });
}

/**
 * Get device ID from localStorage (via postMessage)
 */
async function getDeviceId() {
  return new Promise((resolve) => {
    // Request device ID from client
    self.clients.matchAll().then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage({ type: "GET_DEVICE_ID" });
        // Wait for response
        self.addEventListener("message", function handler(event) {
          if (event.data.type === "DEVICE_ID_RESPONSE") {
            self.removeEventListener("message", handler);
            resolve(event.data.deviceId);
          }
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Get auth token from storage
 */
async function getAuthToken() {
  // In a real implementation, get from secure storage
  // For now, return empty (API should handle unauthenticated requests)
  return "";
}

// Listen for messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data && event.data.type === "SYNC_MESSAGES") {
    // Trigger background sync
    self.registration.sync.register(SYNC_TAG).catch((err) => {
      console.error("[Service Worker] Failed to register sync:", err);
    });
  }
});
