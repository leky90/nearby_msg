/**
 * Message List Component
 * Modern chat message list with grouping, date separators, and better UX
 */

import { useEffect, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import type { Message } from "@/shared/domain/message";
import { SOSMessage } from "./SOSMessage";
import { MessageBubble } from "./MessageBubble";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/shared/components/ui/conversation";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import type { Device } from "@/shared/domain/device";
import {
  groupMessages,
  type GroupedMessage,
} from "@/shared/utils/message-grouping";
import { fetchDevicesByIdsAction } from "@/features/device/store/saga";
import { selectDevicesByIds } from "@/features/device/store/slice";
import type { RootState } from "@/store";
import { useScreenEnterRefresh } from "@/shared/refresh/useScreenEnterRefresh";
import { useMessages } from "../hooks/useMessages";
import { log } from "@/shared/lib/logging/logger";

export interface MessageListProps {
  /** Callback when message is clicked */
  onMessageClick?: (message: Message) => void;
  /** Message ID to scroll to */
  scrollToMessageId?: string;
}

// Threshold for enabling virtualization (performance optimization)
const VIRTUALIZATION_THRESHOLD = 50;

/**
 * Message List component
 * Displays messages with grouping, date separators, and modern UX
 * Gets data directly from hooks/Redux to avoid prop drilling
 */
export function MessageList({
  onMessageClick,
  scrollToMessageId,
}: MessageListProps) {
  const dispatch = useDispatch();
  const { groupId } = useParams<{ groupId: string }>();

  // Get messages directly from hook
  const { messages, isLoading } = useMessages({
    groupId: groupId || "",
    reactive: true,
  });

  // Trigger a single refresh when the chat screen becomes active.
  useScreenEnterRefresh("chat");
  const parentRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentDeviceId = getOrCreateDeviceId();
  const shouldVirtualize = messages.length > VIRTUALIZATION_THRESHOLD;

  // Get unique device IDs from messages
  const uniqueDeviceIds = useMemo(() => {
    return Array.from(new Set(messages.map((m) => m.device_id)));
  }, [messages]);

  // Read devices from Redux store (updated by Devices RxDB listener)
  const devices = useSelector((state: RootState) =>
    selectDevicesByIds(state, uniqueDeviceIds)
  );

  // Create device cache map from Redux store
  const deviceCacheRef = useRef<Map<string, Device>>(new Map());
  useEffect(() => {
    const cache = new Map<string, Device>();
    for (const device of devices) {
      cache.set(device.id, device);
    }
    deviceCacheRef.current = cache;
  }, [devices]);

  // Dispatch action to fetch devices if not in Redux store
  useEffect(() => {
    if (uniqueDeviceIds.length === 0) return;

    // Filter out device IDs that are already in Redux store
    const missingDeviceIds = uniqueDeviceIds.filter(
      (deviceId) => !devices.some((d) => d.id === deviceId)
    );

    if (missingDeviceIds.length > 0) {
      // Dispatch action to fetch missing devices
      // This will trigger saga to fetch from RxDB, which triggers listener to update Redux
      dispatch(fetchDevicesByIdsAction(missingDeviceIds));
    }
  }, [uniqueDeviceIds, devices, dispatch]);

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

  // Auto-scroll to bottom when new messages arrive or on initial load
  // Only scroll if user is near bottom to avoid interrupting manual scrolling
  const isInitialMount = useRef(true);
  const isLoadingMore = useRef(false);

  // Handle scroll to top for loading more messages
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      // Check if scrolled to top (within 100px)
      if (scrollElement.scrollTop < 100 && !isLoadingMore.current) {
        // TODO: Implement load more messages when scrolling up
        // For now, just log
        log.debug("Scrolled to top - should load more messages");
      }
    };

    scrollElement.addEventListener("scroll", handleScroll);
    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!scrollToMessageId && groupedMessages.length > 0 && parentRef.current) {
      const scrollElement = parentRef.current;

      // Always scroll to bottom on initial mount
      if (isInitialMount.current) {
        isInitialMount.current = false;
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }
        });
        return;
      }

      // Check if user is near bottom (within 150px)
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Only auto-scroll if user is within 150px of bottom
      if (distanceFromBottom < 150) {
        if (shouldVirtualize && virtualizer) {
          // Scroll to last item in virtualized list
          virtualizer.scrollToIndex(groupedMessages.length - 1, {
            align: "end",
            behavior: "smooth",
          });
        } else {
          // Scroll to bottom in non-virtualized list
          scrollElement.scrollTop = scrollElement.scrollHeight;
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
      <Conversation className="h-full">
        <ConversationContent>
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
        </ConversationContent>
      </Conversation>
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
          className={cn("flex")}
        >
          <MessageBubble
            message={message}
            isOwn={isOwn}
            onClick={handleMessageClick}
            isFirstInGroup={isFirstInGroup}
            device={device}
          />
        </div>
      </div>
    );
  };

  if (messages.length === 0) {
    return (
      <Conversation className="h-full">
        <ConversationEmptyState
          title={t("page.chat.noMessages") || "Chưa có tin nhắn nào"}
          description="Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn đầu tiên"
        />
      </Conversation>
    );
  }

  // Use virtualization for large lists
  if (shouldVirtualize && virtualizer) {
    const virtualItems = virtualizer.getVirtualItems();

    return (
      <div className="h-full relative overflow-hidden">
        <div
          ref={parentRef}
          className="h-full overflow-y-auto overflow-x-hidden"
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
              className="space-y-1 p-4 flex flex-col"
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
      </div>
    );
  }

  // Non-virtualized rendering for smaller lists
  return (
    <div className="h-full relative overflow-hidden">
      <div
        ref={parentRef}
        className="h-full overflow-y-auto overflow-x-hidden p-4 space-y-4 flex flex-col"
      >
        {groupedMessages.map((grouped) => renderMessage(grouped))}
      </div>
    </div>
  );
}
