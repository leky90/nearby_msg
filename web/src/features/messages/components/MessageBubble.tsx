/**
 * Message Bubble Component
 * Simple chat message bubble with distance and time
 */

import { useEffect, useMemo, memo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Pin,
  PinOff,
  Check,
  CheckCheck,
  Clock,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { Message } from "@/shared/domain/message";
import { cn } from "@/shared/lib/utils";
import {
  pinMessage,
  unpinMessage,
} from "@/features/messages/services/pin-service";
import { fetchPinnedMessagesAction } from "@/features/messages/store/saga";
import { Button } from "@/shared/components/ui/button";
import type { Device } from "@/shared/domain/device";
import { calculateDistance } from "@/shared/domain/group";
import { formatDistance as formatDistanceUtil } from "@/shared/utils/distance";
import { selectDeviceLocation } from "@/features/navigation/store/appSlice";
import { selectDeviceById } from "@/features/device/store/slice";
import { fetchDevicesByIdsAction } from "@/features/device/store/saga";
import { selectPinnedMessagesByGroupId } from "@/features/messages/store/slice";
import { selectGroupById } from "@/features/groups/store/slice";
import { log } from "@/shared/lib/logging/logger";
import type { RootState } from "@/store";
import { MessageContent } from "@/shared/components/ui/message";

export interface MessageBubbleProps {
  /** Message to display */
  message: Message;
  /** Whether this message is from current user */
  isOwn?: boolean;
  /** Callback when message is clicked */
  onClick?: (message: Message) => void;
  /** Custom className */
  className?: string;
  /** Whether this is the first message in a group */
  isFirstInGroup?: boolean;
  /** Device info for displaying sender name */
  device?: Device | null;
}

/**
 * Formats message timestamp for display using date-fns
 */
function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return format(date, "HH:mm");
}

/**
 * Message Bubble component
 * Simple chat message with distance and time
 */
export const MessageBubble = memo(
  function MessageBubble({
    message,
    isOwn = false,
    onClick,
    className = "",
    isFirstInGroup = true,
    device,
  }: MessageBubbleProps) {
    const dispatch = useDispatch();

    // Read device from Redux store (updated by Devices RxDB listener)
    const senderDevice = useSelector((state: RootState) => {
      if (device) return device; // Use provided device if available
      if (isOwn || !message.device_id) return null;
      return selectDeviceById(state, message.device_id);
    });

    // Dispatch action to fetch device if not in Redux store
    useEffect(() => {
      if (!device && !isOwn && message.device_id && !senderDevice) {
        // Dispatch action to fetch device
        // This will trigger saga to fetch from RxDB, which triggers listener to update Redux
        dispatch(fetchDevicesByIdsAction([message.device_id]));
      }
    }, [device, isOwn, message.device_id, senderDevice, dispatch]);

    // Get device location from Redux state
    const deviceLocation = useSelector((state: RootState) =>
      selectDeviceLocation(state)
    );

    // Get group from Redux state (for location)
    const group = useSelector((state: RootState) =>
      selectGroupById(state, message.group_id)
    );

    // Get pinned messages for this group from Redux
    const pinnedMessages = useSelector((state: RootState) =>
      selectPinnedMessagesByGroupId(state, message.group_id)
    );

    // Check if this message is pinned (from Redux state)
    const pinned = useMemo(() => {
      return pinnedMessages.some((pin) => pin.message_id === message.id);
    }, [pinnedMessages, message.id]);

    // Calculate distance from sender using useMemo (no async needed)
    const distance = useMemo(() => {
      if (isOwn || !group || !deviceLocation) {
        return null;
      }

      try {
        // Calculate distance from group location to device location
        const dist = calculateDistance(
          deviceLocation.latitude,
          deviceLocation.longitude,
          group.latitude,
          group.longitude
        );
        return dist;
      } catch (err) {
        log.error("Failed to calculate distance", err, {
          messageId: message.id,
        });
        return null;
      }
    }, [isOwn, group, deviceLocation, message.id]);

    const handleClick = () => {
      onClick?.(message);
    };

    const handlePinClick = async (e: React.MouseEvent) => {
      e.stopPropagation();

      try {
        if (pinned) {
          await unpinMessage(message.id);
        } else {
          await pinMessage(message.id, message.group_id);
        }
        // Refresh pinned messages for this group so UI updates immediately
        dispatch(fetchPinnedMessagesAction(message.group_id));
      } catch (err) {
        log.error("Failed to toggle pin", err, {
          messageId: message.id,
          pinned,
        });
      }
    };

    const senderName =
      senderDevice?.nickname || `Device ${message.device_id.substring(0, 6)}`;

    return (
      <div
        className={cn(
          "group",
          "max-w-4/5",
          "w-max",
          // Đưa role vào wrapper để dùng group-[.is-user] trong UI component
          isOwn ? "is-user ml-auto" : "is-assistant items-start",
          !isFirstInGroup && "mt-0.5",
          className
        )}
      >
        {/* Sender name and distance - only for others and first in group */}
        {!isOwn && isFirstInGroup && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs text-muted-foreground font-medium">
              {senderName}
            </span>
            {distance !== null && (
              <span className="text-xs text-muted-foreground/70">
                • {formatDistanceUtil(distance)}
              </span>
            )}
          </div>
        )}

        {/* Message wrapper with pin button outside */}
        <div className={cn("flex items-start gap-2", isOwn && "justify-end")}>
          {/* Pin button for owner - on the left */}
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-5 w-5 p-0 shrink-0 transition-colors mt-1",
                pinned
                  ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              onClick={handlePinClick}
              aria-label={pinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
            >
              {pinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {/* Message content bubble */}
          <MessageContent
            className={cn(
              "relative",
              // Width / interaction applied trực tiếp cho bubble
              onClick && "cursor-pointer hover:opacity-90",
              pinned && "ring-2 ring-yellow-400 ring-offset-1 rounded-lg"
            )}
            onClick={handleClick}
          >
            <div className="text-sm leading-relaxed">{message.content}</div>

            {/* Timestamp and status */}
            <div
              className={cn(
                "flex items-center gap-1.5 mt-1 text-xs",
                isOwn
                  ? "text-primary-foreground/70 justify-end"
                  : "text-muted-foreground"
              )}
            >
              {/* Pinned indicator */}
              {pinned && <Pin className="h-3 w-3 text-yellow-600" />}
              <span>{formatMessageTime(message.created_at)}</span>
              {isOwn && (
                <div className="flex items-center gap-0.5">
                  {message.sync_status === "synced" ? (
                    <CheckCheck className="h-3 w-3 text-green-600" />
                  ) : message.sync_status === "syncing" ? (
                    <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />
                  ) : message.sync_status === "pending" ? (
                    <Clock className="h-3 w-3 text-yellow-600" />
                  ) : message.sync_status === "failed" ? (
                    <AlertCircle className="h-3 w-3 text-red-600" />
                  ) : (
                    <Check className="h-3 w-3 opacity-30" />
                  )}
                </div>
              )}
            </div>

            {/* Sync status text indicator */}
            {message.sync_status && message.sync_status !== "synced" && (
              <div
                className={cn(
                  "flex items-center gap-1 text-[10px] mt-0.5",
                  isOwn
                    ? "text-primary-foreground/60 justify-end"
                    : "text-muted-foreground/70"
                )}
              >
                {message.sync_status === "pending" && (
                  <>
                    <Clock className="h-2.5 w-2.5 text-yellow-600" />
                    <span className="text-yellow-600">Đang chờ</span>
                  </>
                )}
                {message.sync_status === "syncing" && (
                  <>
                    <RefreshCw className="h-2.5 w-2.5 text-blue-600 animate-spin" />
                    <span className="text-blue-600">Đang đồng bộ</span>
                  </>
                )}
                {message.sync_status === "failed" && (
                  <>
                    <AlertCircle className="h-2.5 w-2.5 text-red-600" />
                    <span className="text-red-600">Lỗi đồng bộ</span>
                  </>
                )}
              </div>
            )}
          </MessageContent>

          {/* Pin button for other users - on the right */}
          {!isOwn && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-5 w-5 p-0 shrink-0 transition-colors mt-1",
                pinned
                  ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              onClick={handlePinClick}
              aria-label={pinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
            >
              {pinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo
    // Only re-render if meaningful data changed
    // Note: onClick function reference is not compared as it's usually stable
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.sync_status === nextProps.message.sync_status &&
      prevProps.message.created_at === nextProps.message.created_at &&
      prevProps.isOwn === nextProps.isOwn &&
      prevProps.className === nextProps.className &&
      prevProps.isFirstInGroup === nextProps.isFirstInGroup &&
      prevProps.device?.id === nextProps.device?.id &&
      prevProps.device?.nickname === nextProps.device?.nickname
      // Intentionally not comparing onClick - function references may change but behavior is the same
    );
  }
);
