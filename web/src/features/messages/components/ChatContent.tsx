/**
 * Chat Content Component
 * Main chat interface layout
 * Separated from ChatPage for better organization
 * Gets data directly from hooks/Redux to avoid prop drilling
 */

import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { NetworkBanner } from "@/shared/components/NetworkBanner";
import { WebSocketStatusIndicator } from "@/features/websocket/components/WebSocketStatusIndicator";
import { useParams } from "react-router-dom";
import { useMessages } from "../hooks/useMessages";
import { t } from "@/shared/lib/i18n";

export interface ChatContentProps {
  onSendMessage: (content: string) => void;
  onPinClick: () => void;
}

export function ChatContent({ onSendMessage, onPinClick }: ChatContentProps) {
  const { groupId } = useParams<{ groupId: string }>();

  // Get messages directly from hook (for loading state in MessageInput)
  const { isLoading } = useMessages({
    groupId: groupId || "",
    reactive: true,
  });
  return (
    <div className="flex flex-col flex-1 min-h-0 pt-14">
      {/* Network Banner */}
      <NetworkBanner />

      {/* WebSocket Status Indicator */}
      <div className="px-4 py-2 border-b">
        <WebSocketStatusIndicator />
      </div>

      {/* Chat Header - Gets group directly from Redux */}
      <ChatHeader />

      {/* Messages area - flex-1 to take remaining space */}
      <div className="flex-1 overflow-hidden min-h-0">
        <MessageList />
      </div>

      {/* Sticky input area */}
      <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <MessageInput
          onSend={onSendMessage}
          disabled={isLoading}
          placeholder={t("page.chat.typeMessage")}
          onPinClick={onPinClick}
        />
      </div>
    </div>
  );
}
