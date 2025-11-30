/**
 * Chat Header Component
 * Compact header with essential information only
 * Uses Redux state managed by groupSaga
 */

import { Star, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  setActiveTab,
  setCurrentChatGroupId,
} from "@/store/slices/navigationSlice";
import { selectGroupStatusSummary } from "@/store/slices/groupsSlice";
import {
  startGroupStatusSummaryAction,
  stopGroupStatusSummaryAction,
} from "@/store/sagas/groupSaga";
import type { Group } from "../../domain/group";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { isFavorited } from "../../services/favorite-service";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { StatusSummary } from "../groups/StatusSummary";
import { GroupNameEditor } from "./GroupNameEditor";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { t } from "@/lib/i18n";
import { log } from "../../lib/logging/logger";
import type { RootState } from "@/store";

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
  const dispatch = useDispatch();
  const [favorited, setFavorited] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // Get status summary from Redux state
  const statusSummaryData = useSelector((state: RootState) =>
    selectGroupStatusSummary(state, group.id)
  );
  const statusSummary = {
    safe_count: statusSummaryData.safe_count,
    need_help_count: statusSummaryData.need_help_count,
    cannot_contact_count: statusSummaryData.cannot_contact_count,
    total_count: statusSummaryData.total_count,
  };

  // Start monitoring status summary on mount
  useEffect(() => {
    dispatch(startGroupStatusSummaryAction(group.id));

    return () => {
      dispatch(stopGroupStatusSummaryAction(group.id));
    };
  }, [group.id, dispatch]);

  const handleBack = () => {
    dispatch(setCurrentChatGroupId(null));
    dispatch(setActiveTab("explore"));
    navigate("/");
  };

  // Check if device is creator
  useEffect(() => {
    const checkIsCreator = async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        setIsCreator(group.creator_device_id === deviceId);
      } catch (err) {
        log.error("Failed to check if creator", err);
      }
    };
    void checkIsCreator();
  }, [group.creator_device_id]);

  // Check favorite status
  useEffect(() => {
    const checkFavorite = async () => {
      try {
        const isFav = await isFavorited(group.id);
        setFavorited(isFav);
      } catch (err) {
        log.error("Failed to check favorite status", err);
      }
    };
    void checkFavorite();
  }, [group.id]);

  const handleFavoriteToggle = async () => {
    const newFavorited = !favorited;
    setFavorited(newFavorited);
    try {
      await onFavoriteToggle?.(newFavorited);
    } catch (err) {
      // Revert on error
      setFavorited(!newFavorited);
      throw err;
    }
  };

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b bg-background px-3 py-2",
        className
      )}
    >
      {/* Left: Back button, Group info */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="h-8 w-8 p-0 shrink-0"
          aria-label={t("navigation.back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate">
              {group.name || t("group.unnamed")}
            </h1>
            {isCreator && (
              <GroupNameEditor
                group={group}
                isCreator={isCreator}
                onGroupUpdated={onGroupUpdated}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              {getGroupTypeLabel(group.type)}
            </Badge>
            <SyncStatusIndicator groupId={group.id} />
          </div>
        </div>
      </div>

      {/* Right: Status summary, Favorite button */}
      <div className="flex items-center gap-2 shrink-0">
        {statusSummary.total_count > 0 && (
          <StatusSummary summary={statusSummary} className="text-xs" />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleFavoriteToggle}
          className={cn("h-8 w-8 p-0", favorited && "text-yellow-500")}
          aria-label={favorited ? t("group.unfavorite") : t("group.favorite")}
        >
          <Star className={cn("h-4 w-4", favorited && "fill-current")} />
        </Button>
      </div>
    </header>
  );
}
