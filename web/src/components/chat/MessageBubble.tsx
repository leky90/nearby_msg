/**
 * Message Bubble Component
 * Displays a single message with timestamp formatting
 */

import { useState, useEffect, memo } from "react";
import { Pin, PinOff } from "lucide-react";
import type { Message } from "../../domain/message";
import { cn } from "@/lib/utils";
import { pinMessage, unpinMessage, isPinned } from "../../services/pin-service";
import { Button } from "../ui/button";
import { t } from "@/lib/i18n";

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
}

/**
 * Formats message timestamp for display
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string
 */
function formatMessageTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute: "Vừa xong"
  if (diffMins < 1) {
    return "Vừa xong";
  }

  // Less than 1 hour: "X minutes ago"
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }

  // Less than 24 hours: "X hours ago"
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  // Less than 7 days: "X days ago"
  if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  // Older: Show date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Message Bubble component
 * Displays a message with formatted timestamp
 * Memoized to prevent unnecessary re-renders when parent updates
 */
export const MessageBubble = memo(
  function MessageBubble({
    message,
    isOwn = false,
    onClick,
    className = "",
    showPinButton = true,
  }: MessageBubbleProps) {
    const [pinned, setPinned] = useState(false);
    const [isPinning, setIsPinning] = useState(false);

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

    return (
      <div
        className={cn(
          "flex flex-col gap-1 rounded-lg border bg-card p-3 transition-colors",
          isOwn && "ml-auto bg-primary text-primary-foreground",
          onClick && "cursor-pointer hover:bg-accent",
          className
        )}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm flex-1">{message.content}</div>
          {showPinButton && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handlePinClick}
              isDisabled={isPinning}
              aria-label={pinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
            >
              {pinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <div
          className={cn(
            "text-caption leading-caption",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatMessageTimestamp(message.created_at)}
        </div>
        {message.sync_status && message.sync_status !== "synced" && (
          <div className={cn(
            "text-caption leading-caption",
            message.sync_status === "pending" && "text-warning",
            message.sync_status === "syncing" && "text-info",
            message.sync_status === "failed" && "text-sos"
          )}>
            {message.sync_status === "pending" && `⏳ ${t("network.pending", { count: 1 })}`}
            {message.sync_status === "syncing" && `🔄 ${t("network.syncing")}`}
            {message.sync_status === "failed" && `❌ ${t("error.network")}`}
          </div>
        )}
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
      prevProps.onClick === nextProps.onClick
    );
  }
);
