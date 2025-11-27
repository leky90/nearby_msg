/**
 * Chat Page Component
 * Main chat interface for a group
 */

import { useMessages } from "../hooks/useMessages";
import { createTextMessage } from "../services/message-service";
import { ChatHeader } from "../components/chat/ChatHeader";
import { MessageList } from "../components/chat/MessageList";
import { MessageInput } from "../components/chat/MessageInput";
import { getDatabase } from "../services/db";
import { useState, useEffect } from "react";
import type { Group } from "../domain/group";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardHeader } from "../components/ui/card";
import { t } from "../lib/i18n";
import { NetworkBanner } from "../components/common/NetworkBanner";

export interface ChatPageProps {
  /** Group ID */
  groupId: string;
}

/**
 * Chat Page component
 * Displays chat interface with messages, input, and header
 */
export function ChatPage({ groupId }: ChatPageProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);

  // Load group information
  useEffect(() => {
    const loadGroup = async () => {
      if (!groupId) return;
      setIsLoadingGroup(true);
      try {
        const db = await getDatabase();
        const groupDoc = await db.groups.findOne(groupId).exec();
        if (groupDoc) {
          setGroup(groupDoc.toJSON() as Group);
        }
      } catch (err) {
        console.error("Failed to load group:", err);
      } finally {
        setIsLoadingGroup(false);
      }
    };
    loadGroup();
  }, [groupId]);

  // Use reactive messages hook
  const { messages, isLoading, error } = useMessages({
    groupId,
    reactive: true,
  });

  const handleSendMessage = async (content: string) => {
    if (!groupId) return;
    await createTextMessage(groupId, content);
    // Message will appear automatically via reactive query
  };

  const handleSOSSent = () => {
    // Message will appear automatically via reactive query
    console.log("SOS message sent");
  };

  if (!groupId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">{t("page.chat.noGroupSelected")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">
          {t("page.chat.errorLoadingMessages")}: {error.message}
        </p>
      </div>
    );
  }

  if (isLoadingGroup || !group) {
    return (
      <div className="flex h-screen flex-col">
        <Card className="m-4">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </CardHeader>
        </Card>
        <div className="flex-1 overflow-hidden">
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-16 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t bg-background p-4">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <NetworkBanner />
      <ChatHeader group={group} onSOSSent={handleSOSSent} />
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          groupId={groupId}
          isLoading={isLoading}
        />
      </div>
      <MessageInput 
        onSend={handleSendMessage} 
        disabled={isLoading}
        placeholder={t("page.chat.typeMessage")}
      />
    </div>
  );
}
