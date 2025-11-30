/**
 * Sync Status Section
 * Displays synchronization status for all data types
 * Uses Redux state managed by syncStatusSaga
 */

import { useEffect, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import {
  selectMutationSyncStatus,
  selectMessageSyncStatus,
  selectOverallSyncStatus,
} from "@/store/slices/syncStatusSlice";
import { refreshSyncStatusAction, triggerManualSyncAction } from "@/store/sagas/syncStatusSaga";
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
import type { RootState } from "@/store";

export function SyncStatusSection() {
  const dispatch = useDispatch();
  const mutationStatus = useSelector((state: RootState) => selectMutationSyncStatus(state));
  const messageStatus = useSelector((state: RootState) => selectMessageSyncStatus(state));
  const overallStatus = useSelector((state: RootState) => selectOverallSyncStatus(state));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh status on mount (monitoring is auto-started by saga)
  useEffect(() => {
    dispatch(refreshSyncStatusAction());
  }, [dispatch]);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    try {
      dispatch(triggerManualSyncAction());
      // Wait a bit for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      dispatch(refreshSyncStatusAction());
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalPending = mutationStatus.pending + messageStatus.pending;
  const totalSyncing = mutationStatus.syncing + messageStatus.syncing;
  const totalFailed = mutationStatus.failed + messageStatus.failed;
  const hasPending = totalPending > 0 || totalSyncing > 0 || totalFailed > 0;

  const getOverallIcon = () => {
    switch (overallStatus.status) {
      case "synced":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "syncing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "offline":
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getOverallLabel = () => {
    switch (overallStatus.status) {
      case "synced":
        return "Đã đồng bộ";
      case "syncing":
        return "Đang đồng bộ";
      case "pending":
        return "Đang chờ";
      case "failed":
        return "Lỗi đồng bộ";
      case "offline":
        return "Offline";
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
                overallStatus.status === "synced" && "text-green-600",
                overallStatus.status === "syncing" && "text-blue-600",
                overallStatus.status === "pending" && "text-yellow-600",
                overallStatus.status === "failed" && "text-red-600",
                overallStatus.status === "offline" && "text-gray-600"
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
            {(mutationStatus.pending > 0 ||
              mutationStatus.syncing > 0 ||
              mutationStatus.failed > 0) && (
              <div className="flex items-center gap-2">
                {mutationStatus.pending > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {mutationStatus.pending} chờ
                  </Badge>
                )}
                {mutationStatus.syncing > 0 && (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    {mutationStatus.syncing} đang sync
                  </Badge>
                )}
                {mutationStatus.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {mutationStatus.failed} lỗi
                  </Badge>
                )}
              </div>
            )}
          </div>
          {mutationStatus.pending === 0 &&
            mutationStatus.syncing === 0 &&
            mutationStatus.failed === 0 && (
              <p className="text-xs text-muted-foreground">
                Không có thay đổi nào đang chờ
              </p>
            )}
        </div>

        {/* Messages Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tin nhắn đang chờ</span>
            {(messageStatus.pending > 0 ||
              messageStatus.syncing > 0 ||
              messageStatus.failed > 0) && (
              <div className="flex items-center gap-2">
                {messageStatus.pending > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {messageStatus.pending} chờ
                  </Badge>
                )}
                {messageStatus.syncing > 0 && (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    {messageStatus.syncing} đang sync
                  </Badge>
                )}
                {messageStatus.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {messageStatus.failed} lỗi
                  </Badge>
                )}
              </div>
            )}
          </div>
          {messageStatus.pending === 0 &&
            messageStatus.syncing === 0 &&
            messageStatus.failed === 0 && (
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
