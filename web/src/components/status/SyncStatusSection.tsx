/**
 * Sync Status Section
 * Displays synchronization status for all data types
 */

import { useState, useEffect } from "react";
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getMutationCounts } from "@/services/mutation-queue";
import { getDatabase } from "@/services/db";
import { triggerImmediateSync } from "@/services/replication-sync";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { log } from "@/lib/logging/logger";

interface SyncStatus {
  mutations: {
    pending: number;
    syncing: number;
    failed: number;
  };
  messages: {
    pending: number;
    syncing: number;
    failed: number;
  };
  overall: "synced" | "pending" | "syncing" | "failed";
}

export function SyncStatusSection() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadSyncStatus = async () => {
    try {
      const db = await getDatabase();

      // Get mutation counts
      const mutationCounts = await getMutationCounts();

      // Get message counts
      const [pendingMessages, syncingMessages, failedMessages] =
        await Promise.all([
          db.messages.find({ selector: { sync_status: "pending" } }).exec(),
          db.messages.find({ selector: { sync_status: "syncing" } }).exec(),
          db.messages.find({ selector: { sync_status: "failed" } }).exec(),
        ]);

      const status: SyncStatus = {
        mutations: {
          pending: mutationCounts.pending,
          syncing: mutationCounts.syncing,
          failed: mutationCounts.failed,
        },
        messages: {
          pending: pendingMessages.length,
          syncing: syncingMessages.length,
          failed: failedMessages.length,
        },
        overall: "synced",
      };

      // Determine overall status
      const totalPending = status.mutations.pending + status.messages.pending;
      const totalSyncing = status.mutations.syncing + status.messages.syncing;
      const totalFailed = status.mutations.failed + status.messages.failed;

      if (totalFailed > 0) {
        status.overall = "failed";
      } else if (totalSyncing > 0) {
        status.overall = "syncing";
      } else if (totalPending > 0) {
        status.overall = "pending";
      } else {
        status.overall = "synced";
      }

      setSyncStatus(status);
    } catch (err) {
      log.error("Failed to load sync status", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSyncStatus();

    // Refresh every 3 seconds
    const interval = setInterval(() => {
      void loadSyncStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    try {
      await triggerImmediateSync();
      // Wait a bit for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadSyncStatus();
    } catch (err) {
      log.error("Failed to trigger sync", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trạng thái đồng bộ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!syncStatus) {
    return null;
  }

  const totalPending =
    syncStatus.mutations.pending + syncStatus.messages.pending;
  const totalSyncing =
    syncStatus.mutations.syncing + syncStatus.messages.syncing;
  const totalFailed = syncStatus.mutations.failed + syncStatus.messages.failed;
  const hasPending = totalPending > 0 || totalSyncing > 0 || totalFailed > 0;

  const getOverallIcon = () => {
    switch (syncStatus.overall) {
      case "synced":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "syncing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getOverallLabel = () => {
    switch (syncStatus.overall) {
      case "synced":
        return "Đã đồng bộ";
      case "syncing":
        return "Đang đồng bộ";
      case "pending":
        return "Đang chờ";
      case "failed":
        return "Lỗi đồng bộ";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Trạng thái đồng bộ</CardTitle>
            <CardDescription className="mt-1">
              Theo dõi quá trình đồng bộ dữ liệu với server
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getOverallIcon()}
            <span
              className={cn(
                "text-sm font-medium",
                syncStatus.overall === "synced" && "text-green-600",
                syncStatus.overall === "syncing" && "text-blue-600",
                syncStatus.overall === "pending" && "text-yellow-600",
                syncStatus.overall === "failed" && "text-red-600"
              )}
            >
              {getOverallLabel()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mutations Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Thay đổi đang chờ</span>
            {(syncStatus.mutations.pending > 0 ||
              syncStatus.mutations.syncing > 0 ||
              syncStatus.mutations.failed > 0) && (
              <div className="flex items-center gap-2">
                {syncStatus.mutations.pending > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {syncStatus.mutations.pending} chờ
                  </Badge>
                )}
                {syncStatus.mutations.syncing > 0 && (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    {syncStatus.mutations.syncing} đang sync
                  </Badge>
                )}
                {syncStatus.mutations.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {syncStatus.mutations.failed} lỗi
                  </Badge>
                )}
              </div>
            )}
          </div>
          {syncStatus.mutations.pending === 0 &&
            syncStatus.mutations.syncing === 0 &&
            syncStatus.mutations.failed === 0 && (
              <p className="text-xs text-muted-foreground">
                Không có thay đổi nào đang chờ
              </p>
            )}
        </div>

        {/* Messages Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tin nhắn đang chờ</span>
            {(syncStatus.messages.pending > 0 ||
              syncStatus.messages.syncing > 0 ||
              syncStatus.messages.failed > 0) && (
              <div className="flex items-center gap-2">
                {syncStatus.messages.pending > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {syncStatus.messages.pending} chờ
                  </Badge>
                )}
                {syncStatus.messages.syncing > 0 && (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    {syncStatus.messages.syncing} đang sync
                  </Badge>
                )}
                {syncStatus.messages.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {syncStatus.messages.failed} lỗi
                  </Badge>
                )}
              </div>
            )}
          </div>
          {syncStatus.messages.pending === 0 &&
            syncStatus.messages.syncing === 0 &&
            syncStatus.messages.failed === 0 && (
              <p className="text-xs text-muted-foreground">
                Tất cả tin nhắn đã được đồng bộ
              </p>
            )}
        </div>

        {/* Manual Sync Button */}
        {hasPending && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            isDisabled={isRefreshing}
            className="w-full"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang đồng bộ...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Đồng bộ ngay
              </>
            )}
          </Button>
        )}

        {/* Summary */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>
            Tổng cộng:{" "}
            {totalPending > 0 && (
              <span className="text-yellow-600">{totalPending} đang chờ</span>
            )}
            {totalPending > 0 && totalSyncing > 0 && ", "}
            {totalSyncing > 0 && (
              <span className="text-blue-600">{totalSyncing} đang đồng bộ</span>
            )}
            {(totalPending > 0 || totalSyncing > 0) && totalFailed > 0 && ", "}
            {totalFailed > 0 && (
              <span className="text-red-600">{totalFailed} lỗi</span>
            )}
            {!hasPending && (
              <span className="text-green-600">Tất cả đã đồng bộ</span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
