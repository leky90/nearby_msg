/**
 * Chat Page Component
 * Modern chat interface with improved UX
 */

import { useMessages } from "../hooks/useMessages";
import { useDispatch, useSelector } from "react-redux";
import { sendTextMessageAction } from "@/store/sagas/messageSaga";
import {
  connectWebSocketAction,
  subscribeToGroupsAction,
} from "@/store/sagas/websocketSaga";
import { toggleFavoriteAction } from "@/store/sagas/groupSaga";
import { selectIsWebSocketConnected } from "@/store/slices/websocketSlice";
import { selectJWTToken } from "@/store/slices/deviceSlice";
import type { RootState } from "@/store";
import { ChatHeader } from "../components/chat/ChatHeader";
import { MessageList } from "../components/chat/MessageList";
import { MessageInput } from "../components/chat/MessageInput";
import { PinnedMessagesSheet } from "../components/chat/PinnedMessagesSheet";
import { getDatabase } from "../services/db";
import { getGroup } from "../services/group-service";
import { addFavorite, removeFavorite } from "../services/favorite-service";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  setActiveTab,
  setCurrentChatGroupId,
} from "@/store/slices/navigationSlice";
import { RefreshCw, ArrowLeft } from "lucide-react";
import type { Group } from "../domain/group";
import { log } from "../lib/logging/logger";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { t } from "../lib/i18n";
import { NetworkBanner } from "../components/common/NetworkBanner";
import { TopNavigation } from "../components/navigation/TopNavigation";
import { WebSocketStatusIndicator } from "../components/common/WebSocketStatusIndicator";
import { showToast } from "../utils/toast";
import { cn } from "@/lib/utils";

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
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [pinnedDrawerOpen, setPinnedDrawerOpen] = useState(false);

  // WebSocket state
  const isWebSocketConnected = useSelector((state: RootState) =>
    selectIsWebSocketConnected(state)
  );
  const jwtToken = useSelector((state: RootState) => selectJWTToken(state));

  // Load group information from RxDB (synced via replication)
  const loadGroup = async () => {
    if (!groupId) return;
    setIsLoadingGroup(true);
    try {
      // Read from RxDB (data is synced via replication mechanism)
      // Replication sync runs every 5 seconds, so data is fresh
      const group = await getGroup(groupId);
      if (group) {
        setGroup(group);
      } else {
        log.warn("Group not found", { groupId });
      }
    } catch (err) {
      log.error("Failed to load group", err, { groupId });
    } finally {
      setIsLoadingGroup(false);
    }
  };

  useEffect(() => {
    void loadGroup();
  }, [groupId]);

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

  // Watch RxDB for group updates (reactive query via replication sync)
  // No need to poll API - replication sync handles updates automatically
  useEffect(() => {
    if (!groupId) return;

    let subscription: (() => void) | null = null;

    const watchGroup = async () => {
      const db = await getDatabase();
      const groupDoc = await db.groups.findOne(groupId).exec();

      if (groupDoc) {
        // Subscribe to changes (reactive query)
        const sub = groupDoc.$.subscribe((doc) => {
          if (doc) {
            setGroup(doc.toJSON() as Group);
          }
        });
        subscription = () => sub.unsubscribe();
      }
    };

    void watchGroup();

    return () => {
      if (subscription) {
        subscription();
      }
    };
  }, [groupId]);

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
    void loadGroup();
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
          onFavoriteToggle={async (isFavorited) => {
            if (!groupId) return;

            try {
              if (isFavorited) {
                await addFavorite(groupId);
                showToast("Đã thêm vào danh sách quan tâm", "success");
              } else {
                await removeFavorite(groupId);
                showToast("Đã xóa khỏi danh sách quan tâm", "success");
              }

              // Dispatch action to update Redux state (favorites are managed via toggleFavoriteAction)
              dispatch(toggleFavoriteAction(groupId));
            } catch (err) {
              log.error("Failed to toggle favorite", err, { groupId });
              const errorMessage =
                err instanceof Error
                  ? err.message
                  : "Không thể cập nhật trạng thái quan tâm";
              showToast(errorMessage, "error");
            }
          }}
          onGroupUpdated={(updatedGroup) => {
            setGroup(updatedGroup);
            // Also reload to ensure consistency
            void loadGroup();
          }}
        />
      </div>

      {/* Messages area - flex-1 to take remaining space */}
      <div className="flex-1 overflow-hidden min-h-0 pt-0">
        <MessageList
          messages={messages}
          groupId={groupId}
          isLoading={isLoading}
          groupLocation={
            group
              ? { latitude: group.latitude, longitude: group.longitude }
              : null
          }
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
        groupLocation={
          group
            ? { latitude: group.latitude, longitude: group.longitude }
            : null
        }
      />
    </div>
  );
}
