/**
 * Sync Status Indicator Component
 * Shows message sync status (online/offline/syncing/pending)
 */

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getDatabase } from "@/services/db";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logging/logger";

export interface SyncStatusIndicatorProps {
  groupId: string;
}

type SyncStatus = "online" | "offline" | "syncing" | "pending";

export function SyncStatusIndicator({ groupId }: SyncStatusIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("online");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkSyncStatus = async () => {
      const isOnline = navigator.onLine;
      if (!isOnline) {
        setSyncStatus("offline");
        return;
      }

      try {
        const db = await getDatabase();
        const pending = await db.messages
          .find({
            selector: {
              group_id: groupId,
              sync_status: { $ne: "synced" },
            },
          })
          .exec();

        const count = pending.length;
        setPendingCount(count);

        if (count > 0) {
          const syncing = pending.some((doc) => {
            const data = doc.toJSON();
            return data.sync_status === "syncing";
          });
          setSyncStatus(syncing ? "syncing" : "pending");
        } else {
          setSyncStatus("online");
        }
      } catch (err) {
        log.error("Failed to check sync status", err, { groupId });
        setSyncStatus("offline");
      }
    };

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 2000);
    return () => clearInterval(interval);
  }, [groupId]);

  const getSyncIcon = () => {
    switch (syncStatus) {
      case "offline":
        return <WifiOff className="size-3.5 text-muted-foreground" />;
      case "syncing":
        return <Loader2 className="size-3.5 animate-spin text-primary" />;
      case "pending":
        return <WifiOff className="size-3.5 text-warning" />;
      default:
        return <Wifi className="size-3.5 text-safety" />;
    }
  };

  const getSyncLabel = () => {
    switch (syncStatus) {
      case "offline":
        return t("component.chatHeader.offline");
      case "syncing":
        return t("component.chatHeader.syncing");
      case "pending":
        return t("component.chatHeader.pending", { count: pendingCount });
      default:
        return t("component.chatHeader.synced");
    }
  };

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      {getSyncIcon()}
      <span className="truncate">{getSyncLabel()}</span>
    </div>
  );
}
