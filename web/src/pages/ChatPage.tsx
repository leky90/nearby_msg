/**
 * Chat Page Component
 * Modern chat interface with improved UX
 */

import { useMessages } from "@/features/messages/hooks/useMessages";
import { useDispatch, useSelector } from "react-redux";
import { sendTextMessageAction } from "@/features/messages/store/saga";
import {
  connectWebSocketAction,
  subscribeToGroupsAction,
} from "@/features/websocket/store/saga";
import { selectIsWebSocketConnected } from "@/features/websocket/store/slice";
import { selectJWTToken } from "@/features/device/store/slice";
import type { RootState } from "@/store";
import { ChatHeader } from "@/features/messages/components/ChatHeader";
import { MessageList } from "@/features/messages/components/MessageList";
import { MessageInput } from "@/features/messages/components/MessageInput";
import { PinnedMessagesSheet } from "@/features/messages/components/PinnedMessagesSheet";
import { fetchGroupDetailsAction } from "@/features/groups/store/groupSaga";
import {
  selectGroupById,
  selectGroupDetails,
} from "@/features/groups/store/slice";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  setActiveTab,
  setCurrentChatGroupId,
} from "@/features/navigation/store/slice";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { log } from "@/shared/lib/logging/logger";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { t } from "@/shared/lib/i18n";
import { NetworkBanner } from "@/shared/components/NetworkBanner";
import { TopNavigation } from "@/features/navigation/components/TopNavigation";
import { WebSocketStatusIndicator } from "@/features/websocket/components/WebSocketStatusIndicator";
import { cn } from "@/shared/lib/utils";

export interface ChatPageProps {
  /** Group ID */
  groupId: string;
}

/**
 * Chat Page component
 * Modern chat interface with improved layout and UX
 */
export function ChatPage({ groupId }: ChatPageProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [pinnedDrawerOpen, setPinnedDrawerOpen] = useState(false);

  // WebSocket state
  const isWebSocketConnected = useSelector((state: RootState) =>
    selectIsWebSocketConnected(state)
  );
  const jwtToken = useSelector((state: RootState) => selectJWTToken(state));

  // Read group from Redux store (updated by Groups RxDB listener)
  const group = useSelector((state: RootState) =>
    selectGroupById(state, groupId)
  );
  const groupDetails = useSelector((state: RootState) =>
    selectGroupDetails(state, groupId)
  );
  const isLoadingGroup = groupDetails.isLoading;

  // Dispatch action to fetch group if not in Redux store
  useEffect(() => {
    if (!groupId) return;

    // If group is not in Redux store, dispatch action to fetch it
    // This will trigger saga to fetch from RxDB/API, which updates RxDB,
    // which triggers Groups RxDB listener to update Redux
    if (!group && !isLoadingGroup) {
      dispatch(fetchGroupDetailsAction(groupId));
    }
  }, [groupId, group, isLoadingGroup, dispatch]);

  // Connect WebSocket and subscribe to group on mount
  useEffect(() => {
    if (!jwtToken || !groupId) {
      return;
    }

    // Connect WebSocket if not already connected
    if (!isWebSocketConnected) {
      dispatch(connectWebSocketAction());
    }

    // Subscribe to group when WebSocket is connected
    // This will be handled by a separate effect that watches isWebSocketConnected
  }, [groupId, jwtToken, isWebSocketConnected, dispatch]);

  // Subscribe to group when WebSocket becomes connected
  useEffect(() => {
    if (isWebSocketConnected && groupId) {
      dispatch(subscribeToGroupsAction([groupId]));
    }
  }, [isWebSocketConnected, groupId, dispatch]);

  // Group updates are handled by Groups RxDB listener → Redux store
  // Component automatically re-renders when Redux store updates via selector
  // No need for direct RxDB subscription - Redux is the single source of truth

  // Use reactive messages hook
  const {
    messages,
    isLoading,
    error,
    refresh: refreshMessages,
  } = useMessages({
    groupId,
    reactive: true,
  });

  const handleRefresh = () => {
    // Refresh group by dispatching action (will fetch from RxDB/API and update Redux)
    if (groupId) {
      dispatch(fetchGroupDetailsAction(groupId));
    }
    void refreshMessages();
  };

  const handleBack = () => {
    dispatch(setCurrentChatGroupId(null));
    dispatch(setActiveTab("explore"));
    navigate("/");
  };

  const handleSendMessage = async (content: string) => {
    if (!groupId) return;
    dispatch(sendTextMessageAction(groupId, content));
    // Message will appear automatically via reactive query and Redux
  };

  if (!groupId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 bg-background">
        <p className="text-muted-foreground">
          {t("page.chat.noGroupSelected")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Trở về
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 bg-background">
        <p className="text-destructive text-center">
          {t("page.chat.errorLoadingMessages")}: {error.message}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Trở về
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>
      </div>
    );
  }

  if (isLoadingGroup || !group) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Header skeleton */}
        <div className="border-b bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>

        {/* Messages skeleton */}
        <div className="flex-1 overflow-hidden">
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
        </div>

        {/* Input skeleton */}
        <div className="border-t bg-background p-4">
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Navigation - Fixed at top (same as other screens) */}
      <TopNavigation />

      {/* Network Banner */}
      <NetworkBanner />

      {/* Chat Header - Below TopNavigation */}
      <div className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        {/* WebSocket Status Indicator */}
        <div className="px-4 py-2 border-b">
          <WebSocketStatusIndicator showLabel={true} />
        </div>
        <ChatHeader
          group={group}
        />
      </div>

      {/* Messages area - flex-1 to take remaining space */}
      <div className="flex-1 overflow-hidden min-h-0 pt-0">
        <MessageList
          messages={messages}
          groupId={groupId}
          isLoading={isLoading}
        />
      </div>

      {/* Sticky input area */}
      <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <MessageInput
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder={t("page.chat.typeMessage")}
          onPinClick={() => setPinnedDrawerOpen(true)}
        />
      </div>

      {/* Pinned Messages Sheet */}
      <PinnedMessagesSheet
        groupId={groupId}
        open={pinnedDrawerOpen}
        onOpenChange={setPinnedDrawerOpen}
        onMessageClick={(message) => {
          // Scroll to message in chat
          // This could be enhanced to actually scroll to the message
          log.debug("Navigate to message", { messageId: message.id });
        }}
      />
    </div>
  );
}
