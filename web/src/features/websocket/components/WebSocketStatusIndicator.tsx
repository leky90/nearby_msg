/**
 * WebSocket Status Indicator Component
 * Displays WebSocket connection status to users
 */

import { useSelector } from "react-redux";
import {
  selectWebSocketStatus,
  selectWebSocketError,
  selectReconnectAttempts,
} from "@/features/websocket/store/slice";
import type { RootState } from "@/store";
import { Wifi, WifiOff, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipTrigger } from "@/shared/components/ui/tooltip";

export interface WebSocketStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * WebSocket Status Indicator
 * Shows connection status with icon and optional label
 */
export function WebSocketStatusIndicator({
  className,
  showLabel = false,
}: WebSocketStatusIndicatorProps) {
  const status = useSelector((state: RootState) =>
    selectWebSocketStatus(state)
  );
  const error = useSelector((state: RootState) => selectWebSocketError(state));
  const reconnectAttempts = useSelector((state: RootState) =>
    selectReconnectAttempts(state)
  );

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Wifi,
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
          icon: WifiOff,
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
    <Tooltip>
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
          {showLabel && (
            <span className={cn("text-xs font-medium", config.color)}>
              {config.label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <Tooltip>{tooltipText}</Tooltip>
    </Tooltip>
  );
}
