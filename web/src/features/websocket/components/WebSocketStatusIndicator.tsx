/**
 * WebSocket Status Indicator Component
 * Displays WebSocket connection status to users
 * Manages WebSocket connection and group subscription for chat
 */

import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  selectWebSocketStatus,
  selectWebSocketError,
  selectReconnectAttempts,
  selectIsWebSocketConnected,
} from "@/features/websocket/store/slice";
import {
  connectWebSocketAction,
  subscribeToGroupsAction,
} from "@/features/websocket/store/saga";
import { selectJWTToken } from "@/features/device/store/slice";
import type { RootState } from "@/store";
import { Radio, AlertCircle, Loader2, CircleDot } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { log } from "@/shared/lib/logging/logger";

export interface WebSocketStatusIndicatorProps {
  className?: string;
  /** Optional groupId - if not provided, will try to get from route params */
  groupId?: string | null;
}

/**
 * WebSocket Status Indicator
 * Shows connection status with icon and optional label
 * Manages WebSocket connection and group subscription for chat
 */
export function WebSocketStatusIndicator({
  className,
  groupId: propGroupId,
}: WebSocketStatusIndicatorProps) {
  const dispatch = useDispatch();
  const params = useParams<{ groupId?: string }>();

  // Get groupId from props or route params
  const groupId = propGroupId ?? params.groupId ?? null;

  const status = useSelector((state: RootState) =>
    selectWebSocketStatus(state)
  );
  const error = useSelector((state: RootState) => selectWebSocketError(state));
  const reconnectAttempts = useSelector((state: RootState) =>
    selectReconnectAttempts(state)
  );
  const isWebSocketConnected = useSelector((state: RootState) =>
    selectIsWebSocketConnected(state)
  );
  const jwtToken = useSelector((state: RootState) => selectJWTToken(state));

  // Connect WebSocket if not already connected
  useEffect(() => {
    if (!jwtToken || !groupId) {
      log.debug("WebSocketStatusIndicator: Skipping connection", {
        hasJWT: !!jwtToken,
        hasGroupId: !!groupId,
      });
      return;
    }

    // Connect WebSocket if not already connected
    if (!isWebSocketConnected) {
      log.debug("WebSocketStatusIndicator: Dispatching connect action", {
        groupId,
      });
      dispatch(connectWebSocketAction());
    } else {
      log.debug("WebSocketStatusIndicator: WebSocket already connected", {
        groupId,
      });
    }
  }, [groupId, jwtToken, isWebSocketConnected, dispatch]);

  // Subscribe to group when WebSocket becomes connected
  useEffect(() => {
    if (isWebSocketConnected && groupId) {
      log.debug("WebSocketStatusIndicator: Dispatching subscribe action", {
        groupId,
        isConnected: isWebSocketConnected,
      });
      dispatch(subscribeToGroupsAction([groupId]));
    } else {
      log.debug("WebSocketStatusIndicator: Skipping subscription", {
        groupId,
        isConnected: isWebSocketConnected,
      });
    }
  }, [isWebSocketConnected, groupId, dispatch]);

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Radio,
          label: "Đã kết nối",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          tooltip: "Kết nối WebSocket đang hoạt động",
        };
      case "connecting":
        return {
          icon: Loader2,
          label: "Đang kết nối...",
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          tooltip: "Đang kết nối WebSocket...",
        };
      case "error":
        return {
          icon: AlertCircle,
          label: "Lỗi kết nối",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          tooltip: error || "Lỗi kết nối WebSocket",
        };
      case "disconnected":
      default:
        return {
          icon: CircleDot,
          label: "Ngắt kết nối",
          color: "text-gray-500",
          bgColor: "bg-gray-500/10",
          tooltip:
            reconnectAttempts > 0
              ? `Đang thử kết nối lại (${reconnectAttempts} lần)`
              : "WebSocket đã ngắt kết nối",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const tooltipText =
    reconnectAttempts > 0 && status !== "connected"
      ? `${config.tooltip}\nĐã thử ${reconnectAttempts} lần`
      : config.tooltip;

  return (
    <TooltipTrigger>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md transition-colors cursor-default",
          config.bgColor,
          className
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            config.color,
            status === "connecting" && "animate-spin"
          )}
        />
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      </div>
      <Tooltip>{tooltipText}</Tooltip>
    </TooltipTrigger>
  );
}
