/**
 * Message List Component
 * Modern chat message list with grouping, date separators, and better UX
 */

import { useEffect, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Message } from "../../domain/message";
import { SOSMessage } from "./SOSMessage";
import { MessageBubble } from "./MessageBubble";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { log } from "../../lib/logging/logger";
import { getDatabase } from "../../services/db";
import type { Device } from "../../domain/device";
import { groupMessages, type GroupedMessage } from "@/utils/message-grouping";

export interface MessageListProps {
  /** Messages to display */
  messages: Message[];
  /** Group ID */
  groupId: string;
  /** Callback when message is clicked */
  onMessageClick?: (message: Message) => void;
  /** Whether messages are loading */
  isLoading?: boolean;
  /** Message ID to scroll to */
  scrollToMessageId?: string;
  /** Group location for calculating distance */
  groupLocation?: { latitude: number; longitude: number } | null;
}

// Threshold for enabling virtualization (performance optimization)
const VIRTUALIZATION_THRESHOLD = 50;

/**
 * Message List component
 * Displays messages with grouping, date separators, and modern UX
 */
export function MessageList({
  messages,
  groupId: _groupId, // eslint-disable-line @typescript-eslint/no-unused-vars
  onMessageClick,
  isLoading = false,
  scrollToMessageId,
  groupLocation,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentDeviceId = getOrCreateDeviceId();
  const deviceCacheRef = useRef<Map<string, Device>>(new Map());
  const shouldVirtualize = messages.length > VIRTUALIZATION_THRESHOLD;

  // Load device info for all unique device IDs
  // Only load devices that aren't already in cache to avoid unnecessary DB queries
  useEffect(() => {
    const loadDevices = async () => {
      const uniqueDeviceIds = new Set(messages.map((m) => m.device_id));
      const cache = new Map<string, Device>();

      for (const deviceId of uniqueDeviceIds) {
        // Use cached device if available
        if (deviceCacheRef.current.has(deviceId)) {
          cache.set(deviceId, deviceCacheRef.current.get(deviceId)!);
        } else {
          // Only load if not in cache
          try {
            const db = await getDatabase();
            const deviceDoc = await db.devices.findOne(deviceId).exec();
            if (deviceDoc) {
              const device = deviceDoc.toJSON() as Device;
              cache.set(deviceId, device);
            }
          } catch (err) {
            log.error("Failed to load device", err, {
              deviceId,
            });
          }
        }
      }

      // Only update cache if it actually changed
      const cacheChanged =
        cache.size !== deviceCacheRef.current.size ||
        Array.from(cache.keys()).some((id) => {
          const cached = cache.get(id);
          const existing = deviceCacheRef.current.get(id);
          return !existing || cached?.nickname !== existing?.nickname;
        });

      if (cacheChanged) {
        deviceCacheRef.current = cache;
      }
    };

    if (messages.length > 0) {
      void loadDevices();
    }
  }, [messages]);

  // Group messages
  const groupedMessages = useMemo(
    () => groupMessages(messages, currentDeviceId, deviceCacheRef.current),
    [messages, currentDeviceId]
  );

  // Virtualizer for large message lists
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: groupedMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height per message
    overscan: 5, // Render 5 extra items outside viewport
    enabled: shouldVirtualize,
  });

  // Auto-scroll to bottom when new messages arrive
  // Only scroll if user is near bottom to avoid interrupting manual scrolling
  useEffect(() => {
    if (!scrollToMessageId && groupedMessages.length > 0) {
      const shouldAutoScroll = () => {
        if (!parentRef.current) return false;
        const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        // Only auto-scroll if user is within 150px of bottom
        return distanceFromBottom < 150;
      };

      if (shouldAutoScroll()) {
        if (shouldVirtualize && virtualizer) {
          // Scroll to last item in virtualized list
          virtualizer.scrollToIndex(groupedMessages.length - 1, {
            align: "end",
            behavior: "smooth",
          });
        } else if (parentRef.current) {
          // Scroll to bottom in non-virtualized list
          parentRef.current.scrollTop = parentRef.current.scrollHeight;
        }
      }
    }
  }, [
    groupedMessages.length,
    scrollToMessageId,
    shouldVirtualize,
    virtualizer,
  ]); // Only depend on length, not full array

  // Scroll to specific message
  useEffect(() => {
    if (scrollToMessageId) {
      const messageIndex = groupedMessages.findIndex(
        (g) => g.message.id === scrollToMessageId
      );
      if (messageIndex >= 0) {
        if (shouldVirtualize && virtualizer) {
          virtualizer.scrollToIndex(messageIndex, {
            align: "center",
            behavior: "smooth",
          });
        } else {
          const messageElement = messageRefs.current.get(scrollToMessageId);
          if (messageElement && parentRef.current) {
            messageElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }

        // Highlight the message briefly
        setTimeout(() => {
          const messageElement = messageRefs.current.get(scrollToMessageId);
          if (messageElement) {
            messageElement.classList.add(
              "ring-2",
              "ring-primary",
              "ring-offset-2"
            );
            setTimeout(() => {
              messageElement.classList.remove(
                "ring-2",
                "ring-primary",
                "ring-offset-2"
              );
            }, 2000);
          }
        }, 100);
      }
    }
  }, [scrollToMessageId, groupedMessages, shouldVirtualize, virtualizer]);

  const handleMessageClick = (message: Message) => {
    onMessageClick?.(message);
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn("flex", i % 2 === 0 && "justify-end")}>
              <div
                className={cn(
                  "space-y-2 max-w-[75%]",
                  i % 2 === 0 && "items-end"
                )}
              >
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  // Render a single message item
  const renderMessage = (grouped: GroupedMessage) => {
    const { message, isFirstInGroup, showDateSeparator, dateLabel, device } =
      grouped;
    const isOwn = message.device_id === currentDeviceId;
    const isSOS = message.message_type === "sos";

    if (isSOS) {
      return (
        <div key={message.id} className="w-full">
          {showDateSeparator && dateLabel && (
            <div className="flex items-center justify-center my-4">
              <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                {dateLabel}
              </div>
            </div>
          )}
          <div
            ref={(el) => {
              if (el) messageRefs.current.set(message.id, el);
            }}
            className={cn(
              "cursor-pointer rounded-lg p-2 transition-colors hover:bg-accent",
              isOwn && "ml-auto"
            )}
            onClick={() => handleMessageClick(message)}
          >
            <SOSMessage message={message} isOwn={isOwn} />
          </div>
        </div>
      );
    }

    // Regular message using MessageBubble component
    return (
      <div key={message.id} className="w-full">
        {showDateSeparator && dateLabel && (
          <div className="flex items-center justify-center my-4">
            <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
              {dateLabel}
            </div>
          </div>
        )}
        <div
          ref={(el) => {
            if (el) messageRefs.current.set(message.id, el);
          }}
          className={cn("flex", isOwn && "justify-end")}
        >
          <MessageBubble
            message={message}
            isOwn={isOwn}
            onClick={handleMessageClick}
            isFirstInGroup={isFirstInGroup}
            device={device}
            groupLocation={groupLocation}
          />
        </div>
      </div>
    );
  };

  if (messages.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="flex h-full items-center justify-center text-center p-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {t("page.chat.noMessages") || "Chưa có tin nhắn nào"}
            </p>
            <p className="text-muted-foreground/70 text-xs">
              Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn đầu tiên
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Use virtualization for large lists
  if (shouldVirtualize && virtualizer) {
    const virtualItems = virtualizer.getVirtualItems();

    return (
      <ScrollArea className="h-full">
        <div
          ref={parentRef}
          className="h-full overflow-auto"
          style={{ contain: "strict" }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
              }}
              className="space-y-1 p-4"
            >
              {virtualItems.map((virtualItem) => {
                const grouped = groupedMessages[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      minHeight: `${virtualItem.size}px`,
                    }}
                  >
                    {renderMessage(grouped)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Non-virtualized rendering for smaller lists
  return (
    <ScrollArea className="h-full">
      <div ref={parentRef} className="space-y-1 p-4">
        {groupedMessages.map((grouped) => renderMessage(grouped))}
      </div>
    </ScrollArea>
  );
}
