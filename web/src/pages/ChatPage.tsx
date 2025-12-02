/**
 * Chat Page Component
 * Modern chat interface with improved UX
 * Refactored following DRY/KISS/SOLID principles
 */

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useMessages } from "@/features/messages/hooks/useMessages";
import { useChatGroup } from "@/features/messages/hooks/useChatGroup";
import {
  sendTextMessageAction,
  fetchPinnedMessagesAction,
} from "@/features/messages/store/saga";
import {
  setActiveTab,
  setCurrentChatGroupId,
} from "@/features/navigation/store/slice";
import { ChatContent } from "@/features/messages/components/ChatContent";
import { PinnedMessagesSheet } from "@/features/messages/components/PinnedMessagesSheet";
import { ChatErrorState } from "@/features/messages/components/ChatErrorState";
import { ChatLoadingState } from "@/features/messages/components/ChatLoadingState";
import { TopNavigation } from "@/features/navigation/components/TopNavigation";
import { log } from "@/shared/lib/logging/logger";
import type { Message } from "@/shared/domain/message";

/**
 * Chat Page component
 * Modern chat interface with improved layout and UX
 * Refactored to follow DRY/KISS/SOLID principles
 * Gets groupId from URL params, components get data directly from Redux
 */
export function ChatPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { groupId } = useParams<{ groupId: string }>();
  const [pinnedDrawerOpen, setPinnedDrawerOpen] = useState(false);

  // Custom hooks for data management (Single Responsibility)
  // Must be called before any early returns to follow Rules of Hooks
  const {
    group,
    isLoading: isLoadingGroup,
    error: groupError,
    refresh: refreshGroup,
  } = useChatGroup(groupId ? groupId : null);
  const { error: messagesError, refresh: refreshMessages } = useMessages({
    groupId: groupId || "",
    reactive: true,
  });

  // Set current chat group ID for WebSocket subscription
  useEffect(() => {
    if (groupId) {
      dispatch(setCurrentChatGroupId(groupId));
      // Also load pinned messages for this group so pin state is correct
      dispatch(fetchPinnedMessagesAction(groupId));
    }
    return () => {
      // Clear when leaving chat page
      dispatch(setCurrentChatGroupId(null));
    };
  }, [groupId, dispatch]);

  // Redirect to Home if group not found in RxDB
  useEffect(() => {
    if (!groupId) return;
    // If group loading finished and group doesn't exist, or error is "Group not found"
    if (
      !isLoadingGroup &&
      !group &&
      (groupError === "Group not found" || groupError === null)
    ) {
      dispatch(setCurrentChatGroupId(null));
      dispatch(setActiveTab("explore"));
      navigate("/", { replace: true });
    }
  }, [groupId, isLoadingGroup, group, groupError, navigate, dispatch]);

  // Redirect to Home if no groupId
  if (!groupId) {
    return <Navigate to="/" replace />;
  }

  // Handlers
  const handleBack = () => {
    dispatch(setCurrentChatGroupId(null));
    dispatch(setActiveTab("explore"));
    navigate("/");
  };

  const handleRefresh = () => {
    refreshGroup();
    void refreshMessages();
  };

  const handleSendMessage = (content: string) => {
    if (!groupId) return;
    dispatch(sendTextMessageAction(groupId, content));
  };

  const handlePinnedMessageClick = (message: Message) => {
    // Scroll to message in chat
    // This could be enhanced to actually scroll to the message
    log.debug("Navigate to message", { messageId: message.id });
  };

  // Early returns for different states (KISS principle)
  if (messagesError) {
    return (
      <ChatErrorState
        error={messagesError}
        onBack={handleBack}
        onRefresh={handleRefresh}
      />
    );
  }

  if (isLoadingGroup || !group) {
    return <ChatLoadingState />;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Navigation - Fixed at top (same as other screens) */}
      <TopNavigation />

      {/* Chat Content - Gets data directly from hooks/Redux */}
      <ChatContent
        onSendMessage={handleSendMessage}
        onPinClick={() => setPinnedDrawerOpen(true)}
      />

      {/* Pinned Messages Sheet */}
      <PinnedMessagesSheet
        groupId={groupId}
        open={pinnedDrawerOpen}
        onOpenChange={setPinnedDrawerOpen}
        onMessageClick={handlePinnedMessageClick}
      />
    </div>
  );
}
