/**
 * Pinned Messages Sheet Component
 * Displays pinned messages in a sheet that slides from the left
 */

import { useEffect, useMemo } from "react";
import type { Message } from "@/shared/domain/message";
import { useSelector, useDispatch } from "react-redux";
import {
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
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Pin, X, PinOff } from "lucide-react";
import { unpinMessage } from "@/features/messages/services/pin-service";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import { showToast } from "@/shared/utils/toast";
import { log } from "@/shared/lib/logging/logger";

export interface PinnedMessagesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onMessageClick?: (message: Message) => void;
}

/**
 * Pinned Messages Sheet
 * Shows all pinned messages for a group
 * Allows unpinning messages that current user has pinned
 */
export function PinnedMessagesSheet({
  open,
  onOpenChange,
  groupId,
  onMessageClick,
}: PinnedMessagesSheetProps) {
  const dispatch = useDispatch();

  // Get pinned messages from Redux
  const pinnedMessages = useSelector((state: RootState) =>
    selectPinnedMessagesByGroupId(state, groupId)
  );
  const isLoading = useSelector((state: RootState) =>
    selectPinnedMessagesLoading(state, groupId)
  );
  const error = useSelector((state: RootState) =>
    selectPinnedMessagesError(state, groupId)
  );

  // Fetch pinned messages when sheet opens
  useEffect(() => {
    if (open && groupId) {
      dispatch(fetchPinnedMessagesAction(groupId));
    }
  }, [open, groupId, dispatch]);

  // Create messages map from pinned messages
  // Use useMemo to prevent unnecessary recalculations
  const messages = useMemo(() => {
    if (pinnedMessages.length === 0) {
      return new Map<string, Message>();
    }

    // pinnedMessages already contains message objects, so we can directly map them
    const messagesMap = new Map<string, Message>();
    for (const pin of pinnedMessages) {
      messagesMap.set(pin.message.id, pin.message);
    }
    return messagesMap;
  }, [pinnedMessages]);

  const handleMessageClick = (messageId: string) => {
    const message =
      messages.get(messageId) ||
      pinnedMessages.find((pin) => pin.message.id === messageId)?.message;
    if (message) {
      onMessageClick?.(message);
      onOpenChange(false);
    }
  };

  const handleUnpin = async (messageId: string, pinnedByDeviceId: string) => {
    const currentDeviceId = getOrCreateDeviceId();
    
    // Only allow unpinning if current user pinned it
    if (pinnedByDeviceId !== currentDeviceId) {
      showToast("Bạn chỉ có thể bỏ ghim tin nhắn mà bạn đã ghim", "error");
      return;
    }

    try {
      await unpinMessage(messageId);
      // Refresh pinned messages
      dispatch(fetchPinnedMessagesAction(groupId));
      showToast("Đã bỏ ghim tin nhắn", "success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Không thể bỏ ghim tin nhắn";
      log.error("Failed to unpin message", err, { messageId });
      showToast(errorMessage, "error");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pin className="h-5 w-5 text-primary" />
              <SheetTitle>Tin nhắn đã ghim</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-sm text-muted-foreground">
                Đang tải tin nhắn đã ghim...
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Pin className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Chưa có tin nhắn nào được ghim
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Nhấn vào biểu tượng ghim bên cạnh tin nhắn để ghim
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {pinnedMessages.map((pin) => {
                const message = pin.message;
                const currentDeviceId = getOrCreateDeviceId();
                const isPinnedByCurrentUser = pin.pinned_by_device_id === currentDeviceId;
                
                if (!message) {
                  return (
                    <div
                      key={pin.message.id}
                      className="rounded-lg border p-3 text-sm text-muted-foreground"
                    >
                      Tin nhắn không tìm thấy (có thể đã bị xóa)
                    </div>
                  );
                }

                return (
                  <div
                    key={pin.message.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(pin.pinned_at), "dd/MM/yyyy HH:mm", {
                          locale: vi,
                        })}
                      </span>
                      {isPinnedByCurrentUser && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => handleUnpin(pin.message.id, pin.pinned_by_device_id)}
                        >
                          <PinOff className="h-3 w-3 mr-1" />
                          Bỏ ghim
                        </Button>
                      )}
                    </div>
                    <div
                      className={cn(
                        "cursor-pointer",
                        !onMessageClick && "cursor-default"
                      )}
                      onClick={() => handleMessageClick(pin.message.id)}
                    >
                      <MessageBubble message={message} />
                    </div>
                    {onMessageClick && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => handleMessageClick(pin.message.id)}
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
