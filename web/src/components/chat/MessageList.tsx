/**
 * Message List Component
 * Displays list of messages with SOS message support and reactive updates
 */

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Message } from "../../domain/message";
import { SOSMessage } from "./SOSMessage";
import { MessageBubble } from "./MessageBubble";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

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
}

/**
 * Message List component
 * Displays messages with special handling for SOS messages using shadcn ScrollArea
 * Now uses MessageBubble for regular messages
 */
// Threshold for enabling virtualization (performance optimization)
const VIRTUALIZATION_THRESHOLD = 50;

export function MessageList({
  messages,
  groupId: _groupId,
  onMessageClick,
  isLoading = false,
  scrollToMessageId,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentDeviceId = getOrCreateDeviceId();
  const shouldVirtualize = messages.length > VIRTUALIZATION_THRESHOLD;
  void _groupId;

  // Virtualizer for large message lists
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height per message (will be measured)
    overscan: 5, // Render 5 extra items outside viewport
    enabled: shouldVirtualize,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!scrollToMessageId && messages.length > 0) {
      if (shouldVirtualize && virtualizer) {
        // Scroll to last item in virtualized list
        virtualizer.scrollToIndex(messages.length - 1, {
          align: "end",
          behavior: "smooth",
        });
      } else if (parentRef.current) {
        // Scroll to bottom in non-virtualized list
        parentRef.current.scrollTop = parentRef.current.scrollHeight;
      }
    }
  }, [messages, scrollToMessageId, shouldVirtualize, virtualizer]);

  // Scroll to specific message
  useEffect(() => {
    if (scrollToMessageId) {
      const messageIndex = messages.findIndex((m) => m.id === scrollToMessageId);
      if (messageIndex >= 0) {
        if (shouldVirtualize && virtualizer) {
          // Scroll to message in virtualized list
          virtualizer.scrollToIndex(messageIndex, {
            align: "center",
            behavior: "smooth",
          });
        } else {
          // Scroll to message in non-virtualized list
          const messageElement = messageRefs.current.get(scrollToMessageId);
          if (messageElement && parentRef.current) {
            messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }

        // Highlight the message briefly
        setTimeout(() => {
          const messageElement = messageRefs.current.get(scrollToMessageId);
          if (messageElement) {
            messageElement.classList.add("ring-2", "ring-primary", "ring-offset-2");
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
  }, [scrollToMessageId, messages, shouldVirtualize, virtualizer]);

  const handleMessageClick = (message: Message) => {
    onMessageClick?.(message);
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  // Render a single message item
  const renderMessage = (message: Message) => {
    const isOwn = message.device_id === currentDeviceId;
    const isSOS = message.message_type === "sos";

    if (isSOS) {
      return (
        <div
          key={message.id}
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
      );
    }

    // Regular message using MessageBubble component
    return (
      <div
        key={message.id}
        ref={(el) => {
          if (el) messageRefs.current.set(message.id, el);
        }}
        className={cn("flex", isOwn && "justify-end")}
      >
        <MessageBubble
          message={message}
          isOwn={isOwn}
          onClick={handleMessageClick}
        />
      </div>
    );
  };

  if (messages.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="flex h-full items-center justify-center text-center text-muted-foreground p-4">
          <p>No messages yet. Start the conversation!</p>
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
              className="space-y-2 p-4"
            >
              {virtualItems.map((virtualItem) => {
                const message = messages[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      minHeight: `${virtualItem.size}px`,
                    }}
                  >
                    {renderMessage(message)}
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
      <div ref={parentRef} className="space-y-2 p-4">
        {messages.map((message) => renderMessage(message))}
      </div>
    </ScrollArea>
  );
}
