/**
 * Storage Quota Service
 * Monitors and manages offline storage quota for IndexedDB
 */

type QuotaStatus = "ok" | "warning" | "critical" | "exceeded";

interface StorageQuotaInfo {
  usage: number;
  quota: number;
  percentage: number;
  status: QuotaStatus;
}

const QUOTA_WARNING_THRESHOLD = 0.8; // 80%
const QUOTA_CRITICAL_THRESHOLD = 0.95; // 95%

/**
 * Gets storage quota information
 * @returns Storage quota info or null if not available
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo | null> {
  if (!("storage" in navigator) || !("estimate" in navigator.storage)) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;

    if (quota === 0) {
      return null;
    }

    const percentage = usage / quota;
    let status: QuotaStatus = "ok";

    if (percentage >= 1) {
      status = "exceeded";
    } else if (percentage >= QUOTA_CRITICAL_THRESHOLD) {
      status = "critical";
    } else if (percentage >= QUOTA_WARNING_THRESHOLD) {
      status = "warning";
    }

    return {
      usage,
      quota,
      percentage,
      status,
    };
  } catch (error) {
    console.error("Failed to get storage quota:", error);
    return null;
  }
}

/**
 * Formats bytes to human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Checks if storage quota is available
 * @returns True if storage is available
 */
export async function isStorageAvailable(): Promise<boolean> {
  const quota = await getStorageQuota();
  if (!quota) {
    return true; // Assume available if we can't check
  }
  return quota.status !== "exceeded";
}

/**
 * Gets storage quota status message
 * @returns Status message or null
 */
export async function getQuotaStatusMessage(): Promise<string | null> {
  const quota = await getStorageQuota();
  if (!quota) {
    return null;
  }

  const usageStr = formatBytes(quota.usage);
  const quotaStr = formatBytes(quota.quota);
  const percentage = Math.round(quota.percentage * 100);

  switch (quota.status) {
    case "exceeded":
      return `Storage quota exceeded (${usageStr} / ${quotaStr})`;
    case "critical":
      return `Storage almost full: ${percentage}% used (${usageStr} / ${quotaStr})`;
    case "warning":
      return `Storage ${percentage}% full (${usageStr} / ${quotaStr})`;
    default:
      return null;
  }
}

/**
 * Clears old data to free up storage space
 * @param targetPercentage - Target usage percentage (0-1)
 * @returns Number of items cleared
 */
export async function clearOldData(targetPercentage: number = 0.5): Promise<number> {
  const quota = await getStorageQuota();
  if (!quota || quota.percentage <= targetPercentage) {
    return 0;
  }

  try {
    const { getDatabase } = await import("./db");
    const db = await getDatabase();

    // Get all messages sorted by created_at (oldest first)
    const messages = await db.messages
      .find({
        sort: [{ created_at: "asc" }],
      })
      .exec();

    const targetUsage = quota.quota * targetPercentage;
    const bytesToFree = quota.usage - targetUsage;
    const bytesPerMessage = quota.usage / messages.length;
    const messagesToDelete = Math.ceil(bytesToFree / bytesPerMessage);

    // Delete oldest messages
    let deleted = 0;
    for (let i = 0; i < Math.min(messagesToDelete, messages.length); i++) {
      await messages[i].remove();
      deleted++;
    }

    return deleted;
  } catch (error) {
    console.error("Failed to clear old data:", error);
    return 0;
  }
}

/**
 * Monitors storage quota and triggers cleanup if needed
 * @param callback - Callback when quota status changes
 * @returns Cleanup function
 */
export function monitorStorageQuota(
  callback: (status: QuotaStatus, message: string | null) => void
): () => void {
  let lastStatus: QuotaStatus | null = null;

  const checkQuota = async () => {
    const quota = await getStorageQuota();
    if (!quota) {
      return;
    }

    if (quota.status !== lastStatus) {
      lastStatus = quota.status;
      const message = await getQuotaStatusMessage();
      callback(quota.status, message);

      // Auto-cleanup if critical or exceeded
      if (quota.status === "critical" || quota.status === "exceeded") {
        await clearOldData(0.7); // Free up to 70%
      }
    }
  };

  // Check immediately
  void checkQuota();

  // Check every 5 minutes
  const interval = setInterval(checkQuota, 5 * 60 * 1000);

  return () => clearInterval(interval);
}

