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
import { format, isToday, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";
import type { Message } from "@/shared/domain/message";
import { cn } from "@/shared/lib/utils";
import {
  pinMessage,
  unpinMessage,
} from "@/features/messages/services/pin-service";
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
import {
  Message as TakiMessage,
  MessageAvatar,
  MessageContent,
} from "@/shared/components/ai-elements/message";

export interface MessageBubbleProps {
  /** Message to display */
  message: Message;
  /** Whether this message is from current user */
  isOwn?: boolean;
  /** Callback when message is clicked */
  onClick?: (message: Message) => void;
  /** Custom className */
  className?: string;
  /** Whether to show pin button */
  showPinButton?: boolean;
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
 * Formats date for display using date-fns
 */
export function formatMessageDate(timestamp: string): string {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return "Hôm nay";
  }

  if (isYesterday(date)) {
    return "Hôm qua";
  }

  // Within last 7 days - show day name
  const daysDiff = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff < 7) {
    return format(date, "EEEE", { locale: vi });
  }

  // Older - show date
  return format(date, "d MMMM yyyy", { locale: vi });
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
    showPinButton = true,
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
      if (!showPinButton) return false;
      return pinnedMessages.some((pin) => pin.message_id === message.id);
    }, [showPinButton, pinnedMessages, message.id]);

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
          // Pinned status will update via Redux when pinned messages are refetched
          // Component will re-render when Redux state updates
        } else {
          await pinMessage(message.id);
          // Pinned status will update via Redux when pinned messages are refetched
          // Component will re-render when Redux state updates
        }
      } catch (err) {
        log.error("Failed to toggle pin", err, {
          messageId: message.id,
          pinned,
        });
      }
    };

    const senderName =
      senderDevice?.nickname || `Device ${message.device_id.substring(0, 6)}`;

    // Get avatar source - use device nickname initials or default
    const avatarSrc = ""; // Device type doesn't have avatar property, using initials fallback

    return (
      <div className={cn("group", !isFirstInGroup && "mt-0.5", className)}>
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

        {/* Taki UI Message component */}
        <TakiMessage
          from={isOwn ? "user" : "assistant"}
          className={cn(
            onClick && "cursor-pointer",
            pinned && "ring-2 ring-yellow-400 ring-offset-1 rounded-lg"
          )}
          onClick={handleClick}
        >
          {/* Avatar - only show for others and first in group */}
          {!isOwn && isFirstInGroup && (
            <MessageAvatar src={avatarSrc} name={senderName} />
          )}

          {/* Message content with Taki UI MessageContent */}
          <MessageContent
            variant={isOwn ? "contained" : "flat"}
            className={cn("relative", onClick && "hover:opacity-90")}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 text-sm leading-relaxed break-words overflow-wrap-anywhere">
                {message.content}
              </div>

              {/* Pin button - show on hover */}
              {showPinButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0",
                    isOwn &&
                      "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20"
                  )}
                  onClick={handlePinClick}
                  aria-label={pinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
                >
                  {pinned ? (
                    <PinOff className="h-3 w-3" />
                  ) : (
                    <Pin className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>

            {/* Timestamp and status */}
            <div
              className={cn(
                "flex items-center gap-1.5 mt-1 text-xs",
                isOwn
                  ? "text-primary-foreground/70 justify-end"
                  : "text-muted-foreground"
              )}
            >
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
        </TakiMessage>
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
      prevProps.showPinButton === nextProps.showPinButton &&
      prevProps.isFirstInGroup === nextProps.isFirstInGroup &&
      prevProps.device?.id === nextProps.device?.id &&
      prevProps.device?.nickname === nextProps.device?.nickname
      // Intentionally not comparing onClick - function references may change but behavior is the same
    );
  }
);
