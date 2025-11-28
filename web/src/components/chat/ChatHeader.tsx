/**
 * Chat Header Component
 * Compact header with essential information only
 */

import { Star, ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigationStore } from "@/stores/navigation-store";
import type { Group } from "../../domain/group";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { isFavorited } from "../../services/favorite-service";
import { getGroupStatusSummary } from "../../services/status-service";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { StatusSummary } from "../groups/StatusSummary";
import { GroupNameEditor } from "./GroupNameEditor";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { t } from "@/lib/i18n";

export interface ChatHeaderProps {
  /** Group information */
  group: Group;
  /** Callback when favorite is toggled */
  onFavoriteToggle?: (isFavorited: boolean) => void;
  /** Callback when group is updated */
  onGroupUpdated?: (group: Group) => void;
  /** Custom className */
  className?: string;
}

/**
 * Gets group type label
 */
function getGroupTypeLabel(type: Group["type"]): string {
  const labels: Record<Group["type"], string> = {
    village: t("group.type.village"),
    hamlet: t("group.type.hamlet"),
    residential_group: t("group.type.residential_group"),
    street_block: t("group.type.street_block"),
    ward: t("group.type.ward"),
    commune: t("group.type.commune"),
    apartment: t("group.type.apartment"),
    residential_area: t("group.type.residential_area"),
    other: t("group.type.other"),
  };
  return labels[type] || type;
}

/**
 * Chat Header component
 * Compact header with essential information only
 */
export function ChatHeader({
  group,
  onFavoriteToggle,
  onGroupUpdated,
  className,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  const { setActiveTab, setCurrentChatGroupId } = useNavigationStore();
  const [favorited, setFavorited] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [statusSummary, setStatusSummary] = useState<{
    safe_count: number;
    need_help_count: number;
    cannot_contact_count: number;
    total_count: number;
  } | null>(null);
  const statusSummaryLoadingRef = useRef(false);

  const handleBack = () => {
    setCurrentChatGroupId(null);
    setActiveTab("explore");
    navigate("/");
  };

  // Check if current device is the creator
  // Only the owner (device_id matches creator_device_id) can edit
  useEffect(() => {
    const checkCreator = async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        const isOwner = group.creator_device_id === deviceId;
        setIsCreator(isOwner);
      } catch (err) {
        console.error("Failed to check creator status:", err);
        setIsCreator(false);
      }
    };
    void checkCreator();
  }, [group.creator_device_id, group.id]);

  // Check favorite status on mount and when group changes
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

  // Update favorited state when callback is triggered
  // This ensures UI updates immediately even if API call is in progress
  const handleFavoriteClick = async () => {
    const newFavorited = !favorited;
    setFavorited(newFavorited); // Optimistic update
    try {
      await onFavoriteToggle?.(newFavorited);
    } catch (err) {
      // Revert on error
      setFavorited(!newFavorited);
      throw err;
    }
  };

  // Load status summary
  useEffect(() => {
    let isMounted = true;

    const loadStatusSummary = async () => {
      // Skip if already loading
      if (statusSummaryLoadingRef.current) {
        return;
      }

      statusSummaryLoadingRef.current = true;
      try {
        const summary = await getGroupStatusSummary(group.id);
        // Only update state if component is still mounted
        if (isMounted) {
          setStatusSummary(summary);
        }
      } catch (err) {
        console.error("Failed to load status summary:", err);
      } finally {
        statusSummaryLoadingRef.current = false;
      }
    };

    void loadStatusSummary();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      void loadStatusSummary();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      statusSummaryLoadingRef.current = false;
    };
  }, [group.id]);

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b bg-background px-3 py-2",
        className
      )}
    >
      {/* Left: Back button, Group info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="h-8 w-8 p-0 shrink-0"
          aria-label="Trở về"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 shrink-0"
              >
                {getGroupTypeLabel(group.type)}
              </Badge>
              <GroupNameEditor
                group={group}
                isCreator={isCreator}
                onGroupUpdated={onGroupUpdated}
              />
            </div>
            <SyncStatusIndicator groupId={group.id} />
          </div>
        </div>
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {onFavoriteToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFavoriteClick}
            className="h-8 w-8 p-0"
            aria-label={
              favorited
                ? t("component.chatHeader.unfavoriteGroup")
                : t("component.chatHeader.favoriteGroup")
            }
          >
            <Star
              className={cn(
                "size-4",
                favorited && "fill-yellow-400 text-yellow-400"
              )}
            />
          </Button>
        )}
      </div>

      {/* Status summary - show as tooltip or compact badge if needed */}
      {statusSummary && statusSummary.total_count > 0 && (
        <div className="hidden sm:block ml-2">
          <StatusSummary summary={statusSummary} />
        </div>
      )}
    </header>
  );
}
