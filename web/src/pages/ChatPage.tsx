/**
 * Chat Page Component
 * Modern chat interface with improved UX
 */

import { useMessages } from "../hooks/useMessages";
import { createTextMessage } from "../services/message-service";
import { ChatHeader } from "../components/chat/ChatHeader";
import { MessageList } from "../components/chat/MessageList";
import { MessageInput } from "../components/chat/MessageInput";
import { PinnedMessagesSheet } from "../components/chat/PinnedMessagesSheet";
import { getDatabase } from "../services/db";
import { getGroup } from "../services/group-service";
import { addFavorite, removeFavorite } from "../services/favorite-service";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigationStore } from "../stores/navigation-store";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ArrowLeft } from "lucide-react";
import type { Group } from "../domain/group";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { t } from "../lib/i18n";
import { NetworkBanner } from "../components/common/NetworkBanner";
import { TopNavigation } from "../components/navigation/TopNavigation";
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
  const queryClient = useQueryClient();
  const { setActiveTab, setCurrentChatGroupId } = useNavigationStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [pinnedDrawerOpen, setPinnedDrawerOpen] = useState(false);

  // Load group information
  const loadGroup = async () => {
    if (!groupId) return;
    setIsLoadingGroup(true);
    try {
      // Always fetch fresh from server to ensure we have latest data
      // This ensures we get updates even if local DB is stale
      const fetchedGroup = await getGroup(groupId);
      if (fetchedGroup) {
        setGroup(fetchedGroup);
      } else {
        // Fallback to local DB if server fetch fails
        const db = await getDatabase();
        const groupDoc = await db.groups.findOne(groupId).exec();
        if (groupDoc) {
          setGroup(groupDoc.toJSON() as Group);
        } else {
          console.warn(`Group ${groupId} not found`);
        }
      }
    } catch (err) {
      console.error("Failed to load group:", err);
      // Fallback to local DB on error
      try {
        const db = await getDatabase();
        const groupDoc = await db.groups.findOne(groupId).exec();
        if (groupDoc) {
          setGroup(groupDoc.toJSON() as Group);
        }
      } catch (dbErr) {
        console.error("Failed to load from local DB:", dbErr);
      }
    } finally {
      setIsLoadingGroup(false);
    }
  };

  useEffect(() => {
    void loadGroup();
  }, [groupId]);

  // Poll for group updates to sync between users (every 10 seconds)
  useEffect(() => {
    if (!groupId) return;

    const pollInterval = setInterval(() => {
      void loadGroup();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
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
    setCurrentChatGroupId(null);
    setActiveTab("explore");
    navigate("/");
  };

  const handleSendMessage = async (content: string) => {
    if (!groupId) return;
    await createTextMessage(groupId, content);
    // Message will appear automatically via reactive query
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

              // Invalidate queries to refresh UI
              await queryClient.invalidateQueries({
                queryKey: ["favorites"],
                exact: false,
              });
              await queryClient.invalidateQueries({
                queryKey: ["favorite-groups"],
                exact: false,
              });
              await queryClient.invalidateQueries({
                queryKey: ["group-details"],
                exact: false,
              });
            } catch (err) {
              console.error("Failed to toggle favorite:", err);
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
          console.log("Navigate to message:", message.id);
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
