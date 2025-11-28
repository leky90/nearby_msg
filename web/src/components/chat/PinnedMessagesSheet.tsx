/**
 * Pinned Messages Sheet Component
 * Displays pinned messages in a sheet that slides from the left
 */

import { useEffect, useState } from "react";
import type { PinnedMessage } from "../../domain/pinned_message";
import type { Message } from "../../domain/message";
import { getPinnedMessages } from "../../services/pin-service";
import { getDatabase } from "../../services/db";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
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
  /** Group location for calculating distance */
  groupLocation?: { latitude: number; longitude: number } | null;
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
  groupLocation,
}: PinnedMessagesSheetProps) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [messages, setMessages] = useState<Map<string, Message>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Load pinned messages
  useEffect(() => {
    if (!open || !groupId) return;

    const loadPinnedMessages = async () => {
      setIsLoading(true);
      try {
        const pins = await getPinnedMessages(groupId);
        setPinnedMessages(pins);

        // Load actual messages from RxDB
        const db = await getDatabase();
        const messageIds = pins.map((pin) => pin.message_id);
        const messageDocs = await db.messages
          .find({
            selector: {
              id: { $in: messageIds },
            },
          })
          .exec();

        const messagesMap = new Map<string, Message>();
        for (const doc of messageDocs) {
          messagesMap.set(doc.id, doc.toJSON() as Message);
        }
        setMessages(messagesMap);
      } catch (err) {
        console.error("Failed to load pinned messages:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPinnedMessages();
  }, [open, groupId]);

  const handleMessageClick = (messageId: string) => {
    const message = messages.get(messageId);
    if (message) {
      onMessageClick?.(message);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85%] sm:w-[400px] max-w-[90vw] p-0 flex flex-col">
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
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("common.loading") || "Đang tải..."}
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("component.pinnedMessages.noPinnedMessages") || "Chưa có tin nhắn nào được ghim"}
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
                  <div key={pin.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      {pin.tag && (
                        <Badge variant="secondary" className="text-xs">
                          {pin.tag}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(pin.pinned_at), "dd/MM/yyyy HH:mm", { locale: vi })}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "cursor-pointer",
                        !onMessageClick && "cursor-default"
                      )}
                      onClick={() => handleMessageClick(pin.message_id)}
                    >
                      <MessageBubble
                        message={message}
                        showPinButton={false}
                        groupLocation={groupLocation || undefined}
                      />
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

