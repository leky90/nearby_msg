/**
 * Message Bubble Component
 * Simple chat message bubble with distance and time
 */

import { useState, useEffect, memo } from "react";
import { Pin, PinOff, Check, CheckCheck } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";
import type { Message } from "../../domain/message";
import { cn } from "@/lib/utils";
import { pinMessage, unpinMessage, isPinned } from "../../services/pin-service";
import { Button } from "../ui/button";
import { getDatabase } from "../../services/db";
import type { Device } from "../../domain/device";
import { calculateDistance } from "../../domain/group";
import { formatDistance as formatDistanceUtil } from "../../utils/distance";
import { getCurrentLocation } from "../../services/location-service";

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
  /** Group location for calculating distance */
  groupLocation?: { latitude: number; longitude: number } | null;
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
function formatMessageDate(timestamp: string): string {
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
    groupLocation,
  }: MessageBubbleProps) {
    const [pinned, setPinned] = useState(false);
    const [isPinning, setIsPinning] = useState(false);
    const [senderDevice, setSenderDevice] = useState<Device | null>(
      device || null
    );
    const [distance, setDistance] = useState<number | null>(null);

    // Load device info if not provided
    useEffect(() => {
      if (!device && !isOwn && message.device_id) {
        const loadDevice = async () => {
          try {
            const db = await getDatabase();
            const deviceDoc = await db.devices
              .findOne(message.device_id)
              .exec();
            if (deviceDoc) {
              setSenderDevice(deviceDoc.toJSON() as Device);
            }
          } catch (err) {
            console.error("Failed to load device:", err);
          }
        };
        void loadDevice();
      }
    }, [device, isOwn, message.device_id]);

    // Calculate distance from sender
    useEffect(() => {
      if (isOwn || !groupLocation) {
        setDistance(null);
        return;
      }

      const calculateDistanceFromSender = async () => {
        try {
          // Get current user location
          const userLocation = await getCurrentLocation();
          if (!userLocation) {
            // Try to get from localStorage
            const savedLocation = localStorage.getItem("device_location");
            if (savedLocation) {
              const loc = JSON.parse(savedLocation);
              if (loc.latitude && loc.longitude) {
                // Calculate distance from group location (sender is at group location)
                const dist = calculateDistance(
                  loc.latitude,
                  loc.longitude,
                  groupLocation.latitude,
                  groupLocation.longitude
                );
                setDistance(dist);
              }
            }
            return;
          }

          // Calculate distance from group location
          const dist = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            groupLocation.latitude,
            groupLocation.longitude
          );
          setDistance(dist);
        } catch (err) {
          console.error("Failed to calculate distance:", err);
        }
      };

      void calculateDistanceFromSender();
    }, [isOwn, groupLocation]);

    // Check if message is pinned
    useEffect(() => {
      if (showPinButton) {
        const checkPinned = async () => {
          try {
            const pinnedStatus = await isPinned(message.id);
            setPinned(pinnedStatus);
          } catch (err) {
            console.error("Failed to check pin status:", err);
          }
        };
        void checkPinned();
      }
    }, [message.id, showPinButton]);

    const handleClick = () => {
      onClick?.(message);
    };

    const handlePinClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isPinning) return;

      setIsPinning(true);
      try {
        if (pinned) {
          await unpinMessage(message.id);
          setPinned(false);
        } else {
          await pinMessage(message.id);
          setPinned(true);
        }
      } catch (err) {
        console.error("Failed to toggle pin:", err);
      } finally {
        setIsPinning(false);
      }
    };

    const senderName =
      senderDevice?.nickname || `Device ${message.device_id.substring(0, 6)}`;

    return (
      <div
        className={cn(
          "flex gap-2 group",
          isOwn && "flex-row-reverse",
          !isFirstInGroup && "mt-0.5",
          className
        )}
      >
        {/* Message content */}
        <div className={cn("flex flex-col max-w-[75%]", isOwn && "items-end")}>
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

          {/* Message bubble */}
          <div
            className={cn(
              "relative rounded-2xl px-4 py-2 transition-all shadow-sm",
              isOwn
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted text-foreground rounded-bl-md",
              onClick && "cursor-pointer hover:opacity-90",
              pinned && "ring-2 ring-yellow-400 ring-offset-1"
            )}
            onClick={handleClick}
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
                  isDisabled={isPinning}
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
                "flex items-center gap-1 mt-1 text-xs",
                isOwn
                  ? "text-primary-foreground/70 justify-end"
                  : "text-muted-foreground"
              )}
            >
              <span>{formatMessageTime(message.created_at)}</span>
              {isOwn && (
                <span className="ml-0.5">
                  {message.sync_status === "synced" ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : message.sync_status === "syncing" ? (
                    <Check className="h-3 w-3 opacity-50" />
                  ) : (
                    <Check className="h-3 w-3 opacity-30" />
                  )}
                </span>
              )}
            </div>

            {/* Sync status indicator */}
            {message.sync_status && message.sync_status !== "synced" && (
              <div
                className={cn(
                  "text-[10px] mt-0.5",
                  isOwn
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground/70"
                )}
              >
                {message.sync_status === "pending" && "⏳ Đang chờ"}
                {message.sync_status === "syncing" && "🔄 Đang đồng bộ"}
                {message.sync_status === "failed" && "❌ Lỗi"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.sync_status === nextProps.message.sync_status &&
      prevProps.isOwn === nextProps.isOwn &&
      prevProps.className === nextProps.className &&
      prevProps.showPinButton === nextProps.showPinButton &&
      prevProps.isFirstInGroup === nextProps.isFirstInGroup &&
      prevProps.device?.id === nextProps.device?.id &&
      prevProps.device?.nickname === nextProps.device?.nickname &&
      prevProps.groupLocation?.latitude === nextProps.groupLocation?.latitude &&
      prevProps.groupLocation?.longitude ===
        nextProps.groupLocation?.longitude &&
      prevProps.onClick === nextProps.onClick
    );
  }
);

// Export helper functions
export { formatMessageTime, formatMessageDate };
