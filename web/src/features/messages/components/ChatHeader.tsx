/**
 * Chat Header Component
 * Compact header with essential information only
 * Uses Redux state managed by groupSaga
 */

import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  setActiveTab,
  setCurrentChatGroupId,
} from "@/features/navigation/store/slice";
import { selectGroupById } from "@/features/groups/store/slice";
import type { RootState } from "@/store";
import type { Group } from "@/shared/domain/group";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { GroupNameEditor } from "./GroupNameEditor";
import { FavoriteButton } from "./FavoriteButton";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { t } from "@/shared/lib/i18n";

export interface ChatHeaderProps {
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
 * Gets group data directly from Redux to avoid prop drilling
 */
export function ChatHeader({ className }: ChatHeaderProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { groupId } = useParams<{ groupId: string }>();

  // Get group directly from Redux store
  const group = useSelector((state: RootState) =>
    groupId ? selectGroupById(state, groupId) : null
  );

  // If no group, return null (will be handled by parent)
  if (!group) {
    return null;
  }

  // Get status summary from Redux state
  // TEMPORARILY DISABLED: Group Status Summary feature
  // const statusSummaryData = useSelector((state: RootState) =>
  //   selectGroupStatusSummary(state, group.id)
  // );

  const handleBack = () => {
    dispatch(setCurrentChatGroupId(null));
    dispatch(setActiveTab("explore"));
    navigate("/");
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
          aria-label={t("button.back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate">
              {group.name || t("group.unnamed")}
            </h1>
            <GroupNameEditor group={group} />
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
        {/* TEMPORARILY DISABLED: Group Status Summary feature */}

        <FavoriteButton groupId={group.id} />
      </div>
    </header>
  );
}
