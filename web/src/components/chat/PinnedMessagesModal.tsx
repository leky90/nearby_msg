/**
 * Pinned Messages Modal Component
 * Displays a list of pinned messages for a group
 */

import { useEffect, useState } from "react";
import type { PinnedMessage } from "../../domain/pinned_message";
import type { Message } from "../../domain/message";
import { getPinnedMessages } from "../../services/pin-service";
import { getDatabase } from "../../services/db";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export interface PinnedMessagesModalProps {
  /** Group ID */
  groupId: string;
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void;
  /** Callback when a pinned message is clicked (for navigation) */
  onMessageClick?: (message: Message) => void;
}

/**
 * Pinned Messages Modal component
 * Shows all pinned messages for a group
 */
export function PinnedMessagesModal({
  groupId,
  open,
  onOpenChange,
  onMessageClick,
}: PinnedMessagesModalProps) {
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

  if (!open) return null;

  return (
    <Dialog>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t("component.pinnedMessages.title")}</DialogTitle>
          <DialogDescription>
            {t("component.pinnedMessages.description") || "Tin nhắn quan trọng đã được ghim"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {t("component.pinnedMessages.noPinnedMessages")}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {pinnedMessages.map((pin) => {
                const message = messages.get(pin.message_id);
                if (!message) {
                  return (
                    <div
                      key={pin.id}
                      className="rounded-lg border p-3 text-sm text-muted-foreground"
                    >
                      Message not found (may have been deleted)
                    </div>
                  );
                }

                return (
                  <div key={pin.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      {pin.tag && <Badge variant="secondary">{pin.tag}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {t("common.pinned") || "Đã ghim"} {new Date(pin.pinned_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "cursor-pointer",
                        !onMessageClick && "cursor-default"
                      )}
                      onClick={() => handleMessageClick(pin.message_id)}
                    >
                      <MessageBubble message={message} showPinButton={false} />
                    </div>
                    {onMessageClick && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
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
      </DialogContent>
    </Dialog>
  );
}
