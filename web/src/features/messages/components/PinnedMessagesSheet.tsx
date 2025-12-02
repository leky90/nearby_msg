/**
 * Pinned Messages Sheet Component
 * Displays pinned messages in a sheet that slides from the left
 */

import { useEffect, useMemo } from "react";
import type { Message } from "@/shared/domain/message";
import { useSelector, useDispatch } from "react-redux";
import {
  selectMessagesByGroupId,
  selectPinnedMessagesByGroupId,
  selectPinnedMessagesLoading,
  selectPinnedMessagesError,
} from "@/features/messages/store/slice";
import { fetchPinnedMessagesAction } from "@/features/messages/store/saga";
import type { RootState } from "@/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Pin, X } from "lucide-react";

export interface PinnedMessagesSheetProps {
  /** Group ID */
  groupId: string;
  /** Whether sheet is open */
  open: boolean;
  /** Callback when sheet is closed */
  onOpenChange: (open: boolean) => void;
  /** Callback when a pinned message is clicked (for navigation) */
  onMessageClick?: (message: Message) => void;
}

/**
 * Pinned Messages Sheet component
 * Shows all pinned messages for a group in a sheet from the left
 */
export function PinnedMessagesSheet({
  groupId,
  open,
  onOpenChange,
  onMessageClick,
}: PinnedMessagesSheetProps) {
  const dispatch = useDispatch();

  // Read messages from Redux store (updated by Messages RxDB listener)
  const allMessages = useSelector((state: RootState) =>
    selectMessagesByGroupId(state, groupId)
  );

  // Read pinned messages from Redux store
  const pinnedMessages = useSelector((state: RootState) =>
    selectPinnedMessagesByGroupId(state, groupId)
  );

  // Read loading and error states from Redux
  const isLoading = useSelector((state: RootState) =>
    selectPinnedMessagesLoading(state, groupId)
  );
  const error = useSelector((state: RootState) =>
    selectPinnedMessagesError(state, groupId)
  );

  // Dispatch action to fetch pinned messages when sheet opens
  useEffect(() => {
    if (open && groupId) {
      dispatch(fetchPinnedMessagesAction(groupId));
    }
  }, [open, groupId, dispatch]);

  // Create messages map from pinned messages and all messages
  // Use useMemo to prevent unnecessary recalculations
  const messages = useMemo(() => {
    if (pinnedMessages.length === 0) {
      return new Map<string, Message>();
    }

    const messageIds = pinnedMessages.map((pin) => pin.message_id);
    const messagesMap = new Map<string, Message>();
    for (const message of allMessages) {
      if (messageIds.includes(message.id)) {
        messagesMap.set(message.id, message);
      }
    }
    return messagesMap;
  }, [pinnedMessages, allMessages]);

  const handleMessageClick = (messageId: string) => {
    const message = messages.get(messageId);
    if (message) {
      onMessageClick?.(message);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[85%] sm:w-[400px] max-w-[90vw] p-0 flex flex-col"
      >
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pin className="size-4 text-primary" />
              <SheetTitle className="text-base">
                {t("component.pinnedMessages.title") || "Tin nhắn đã ghim"}
              </SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {error ? (
            <div className="p-4 text-center text-sm text-destructive">
              {t("common.error") || "Lỗi khi tải tin nhắn đã ghim"}
            </div>
          ) : isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("common.loading") || "Đang tải..."}
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("component.pinnedMessages.noPinnedMessages") ||
                "Chưa có tin nhắn nào được ghim"}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {pinnedMessages.map((pin) => {
                const message = messages.get(pin.message_id);
                if (!message) {
                  return (
                    <div
                      key={pin.id}
                      className="rounded-lg border p-3 text-sm text-muted-foreground"
                    >
                      Tin nhắn không tìm thấy (có thể đã bị xóa)
                    </div>
                  );
                }

                return (
                  <div
                    key={pin.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      {pin.tag && (
                        <Badge variant="secondary" className="text-xs">
                          {pin.tag}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(pin.pinned_at), "dd/MM/yyyy HH:mm", {
                          locale: vi,
                        })}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "cursor-pointer",
                        !onMessageClick && "cursor-default"
                      )}
                      onClick={() => handleMessageClick(pin.message_id)}
                    >
                      <MessageBubble message={message} />
                    </div>
                    {onMessageClick && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => handleMessageClick(pin.message_id)}
                      >
                        {t("common.goToMessage") || "Đi tới tin nhắn"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Close button at bottom */}
        <div className="border-t p-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
