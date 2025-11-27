/**
 * Chat Header Component
 * Header for group chat with group info, SOS button, and sync status
 */

import { Users, Wifi, WifiOff, Loader2, Star, Pin } from "lucide-react";
import { useState, useEffect } from "react";
import type { Group } from "../../domain/group";
import { SOSButton } from "../common/SOSButton";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { getDatabase } from "../../services/db";
import { isFavorited } from "../../services/favorite-service";
import { getGroupStatusSummary } from "../../services/status-service";
import { StatusSummary } from "../groups/StatusSummary";
import { PinnedMessagesModal } from "./PinnedMessagesModal";

export interface ChatHeaderProps {
  /** Group information */
  group: Group;
  /** Callback when SOS is sent */
  onSOSSent?: () => void;
  /** Callback when favorite is toggled */
  onFavoriteToggle?: (isFavorited: boolean) => void;
  /** Callback when a pinned message is clicked (for navigation) */
  onPinnedMessageClick?: (messageId: string) => void;
  /** Custom className */
  className?: string;
}

type SyncStatus = "online" | "offline" | "syncing" | "pending";

/**
 * Gets group type label
 */
function getGroupTypeLabel(type: Group["type"]): string {
  const labels: Record<Group["type"], string> = {
    neighborhood: "Neighborhood",
    ward: "Ward",
    district: "District",
    apartment: "Apartment",
    other: "Other",
  };
  return labels[type] || type;
}

/**
 * Chat Header component
 * Displays group information, SOS button, and sync status indicator
 */
export function ChatHeader({
  group,
  onSOSSent,
  onFavoriteToggle,
  onPinnedMessageClick,
  className,
}: ChatHeaderProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("online");
  const [pendingCount, setPendingCount] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [pinnedModalOpen, setPinnedModalOpen] = useState(false);
  const [statusSummary, setStatusSummary] = useState<{
    safe_count: number;
    need_help_count: number;
    cannot_contact_count: number;
    total_count: number;
  } | null>(null);

  // Check favorite status on mount
  useEffect(() => {
    const checkFavorite = async () => {
      try {
        const favoritedStatus = await isFavorited(group.id);
        setFavorited(favoritedStatus);
      } catch (err) {
        console.error("Failed to check favorite status:", err);
      }
    };
    void checkFavorite();
  }, [group.id]);

  // Load status summary
  useEffect(() => {
    const loadStatusSummary = async () => {
      try {
        const summary = await getGroupStatusSummary(group.id);
        setStatusSummary(summary);
      } catch (err) {
        console.error("Failed to load status summary:", err);
      }
    };

    void loadStatusSummary();
    // Refresh every 10 seconds
    const interval = setInterval(loadStatusSummary, 10000);
    return () => clearInterval(interval);
  }, [group.id]);

  // Check sync status periodically
  useEffect(() => {
    const checkSyncStatus = async () => {
      const isOnline = navigator.onLine;
      if (!isOnline) {
        setSyncStatus("offline");
        return;
      }

      try {
        const db = await getDatabase();
        const pending = await db.messages
          .find({
            selector: {
              group_id: group.id,
              sync_status: { $ne: "synced" },
            },
          })
          .exec();

        const count = pending.length;
        setPendingCount(count);

        if (count > 0) {
          // Check if any are currently syncing
          const syncing = pending.some((doc) => {
            const data = doc.toJSON();
            return data.sync_status === "syncing";
          });
          setSyncStatus(syncing ? "syncing" : "pending");
        } else {
          setSyncStatus("online");
        }
      } catch (err) {
        console.error("Failed to check sync status:", err);
        setSyncStatus("offline");
      }
    };

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 2000);
    return () => clearInterval(interval);
  }, [group.id]);

  const getSyncIcon = () => {
    switch (syncStatus) {
      case "offline":
        return <WifiOff className="size-4 text-muted-foreground" />;
      case "syncing":
        return <Loader2 className="size-4 animate-spin text-primary" />;
      case "pending":
        return <WifiOff className="size-4 text-yellow-500" />;
      default:
        return <Wifi className="size-4 text-green-500" />;
    }
  };

  const getSyncLabel = () => {
    switch (syncStatus) {
      case "offline":
        return "Offline";
      case "syncing":
        return "Syncing...";
      case "pending":
        return `${pendingCount} pending`;
      default:
        return "Synced";
    }
  };

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b bg-background px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>
            <Users className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="w-fit text-xs">
              {getGroupTypeLabel(group.type)}
            </Badge>
            <div
              className={cn(
                "flex items-center gap-1 text-xs",
                syncStatus === "offline" && "text-muted-foreground",
                syncStatus === "pending" && "text-yellow-600",
                syncStatus === "syncing" && "text-primary",
                syncStatus === "online" && "text-green-600"
              )}
              title={getSyncLabel()}
            >
              {getSyncIcon()}
              <span className="hidden sm:inline">{getSyncLabel()}</span>
            </div>
          </div>
        </div>
        {statusSummary && statusSummary.total_count > 0 && (
          <div className="mt-2">
            <StatusSummary summary={statusSummary} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPinnedModalOpen(true)}
          aria-label="View pinned messages"
        >
          <Pin className="size-4" />
        </Button>
        {onFavoriteToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const newFavorited = !favorited;
              setFavorited(newFavorited);
              onFavoriteToggle(newFavorited);
            }}
            aria-label={favorited ? "Unfavorite group" : "Favorite group"}
          >
            <Star
              className={cn(
                "size-4",
                favorited && "fill-yellow-400 text-yellow-400"
              )}
            />
          </Button>
        )}
        <SOSButton
          groupId={group.id}
          variant="destructive"
          size="sm"
          onSOSSent={onSOSSent}
        />
      </div>
      <PinnedMessagesModal
        groupId={group.id}
        open={pinnedModalOpen}
        onOpenChange={setPinnedModalOpen}
        onMessageClick={(message) => {
          onPinnedMessageClick?.(message.id);
        }}
      />
    </header>
  );
}
