/**
 * Sync Status Indicator Component
 * Shows message sync status (online/offline/syncing/pending)
 * Uses Redux state managed by syncStatusSaga
 */

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { selectGroupSyncStatus } from "@/features/status/store/slice";
import {
  startGroupSyncStatusAction,
  stopGroupSyncStatusAction,
} from "@/features/status/store/syncStatusSaga";
import { t } from "@/shared/lib/i18n";
import type { RootState } from "@/store";

export interface SyncStatusIndicatorProps {
  groupId: string;
}

export function SyncStatusIndicator({ groupId }: SyncStatusIndicatorProps) {
  const dispatch = useDispatch();
  const groupStatus = useSelector((state: RootState) =>
    selectGroupSyncStatus(state, groupId)
  );

  useEffect(() => {
    // Start monitoring for this group
    dispatch(startGroupSyncStatusAction(groupId));

    // Cleanup: stop monitoring on unmount
    return () => {
      dispatch(stopGroupSyncStatusAction(groupId));
    };
  }, [groupId, dispatch]);

  const getSyncIcon = () => {
    switch (groupStatus.messageStatus) {
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
    switch (groupStatus.messageStatus) {
      case "offline":
        return t("component.chatHeader.offline");
      case "syncing":
        return t("component.chatHeader.syncing");
      case "pending":
        return t("component.chatHeader.pending", {
          count: groupStatus.pendingCount,
        });
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
