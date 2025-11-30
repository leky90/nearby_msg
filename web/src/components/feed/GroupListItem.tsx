/**
 * Group List Item - Compact version
 * Simplified group card for list view using Shadcn Item component
 */

import { LogIn, Star, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemActions,
} from "@/components/ui/item";
import { useGroupSyncStatus } from "@/hooks/useGroupSyncStatus";
import type { Group } from "@/domain/group";

interface GroupListItemProps {
  group: Group;
  distance: number | null;
  distanceDisplay: string;
  latestMessagePreview: string | null;
  isFavorited: boolean;
  unreadCount: number;
  onClick: () => void;
  onFavoriteToggle?: (isFavorited: boolean) => void;
  className?: string;
}

const groupTypeLabels: Record<Group["type"], string> = {
  village: "Thôn",
  hamlet: "Xóm",
  residential_group: "Tổ dân phố",
  street_block: "Khu phố",
  ward: "Phường",
  commune: "Xã",
  apartment: "Chung cư",
  residential_area: "Khu dân cư",
  other: "Khác",
};

export function GroupListItem({
  group,
  distanceDisplay,
  latestMessagePreview: _latestMessagePreview, // eslint-disable-line @typescript-eslint/no-unused-vars
  isFavorited,
  unreadCount,
  onClick,
  onFavoriteToggle,
  className,
}: GroupListItemProps) {
  const syncStatus = useGroupSyncStatus(group.id);

  const getSyncIcon = () => {
    if (!syncStatus.hasPendingMutations) return null;

    switch (syncStatus.mutationStatus) {
      case "syncing":
        return <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />;
      case "pending":
        return <Clock className="h-3 w-3 text-yellow-600" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <Item variant="outline" size="default" className={cn("w-full", className)}>
      {/* Star icon in ItemMedia - clickable to toggle favorite */}
      <ItemMedia
        variant="icon"
        className={cn(
          isFavorited && "bg-yellow-200 text-yellow-500 hover:text-yellow-600"
        )}
      >
        {onFavoriteToggle ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle(!isFavorited);
            }}
            className={cn(
              "p-1 rounded-full transition-colors flex items-center justify-center",
              isFavorited
                ? "text-yellow-500 hover:text-yellow-600"
                : "text-muted-foreground/30 hover:text-muted-foreground"
            )}
            aria-label={isFavorited ? "Bỏ ghim" : "Ghim"}
          >
            <Star className={cn("w-4 h-4", isFavorited && "fill-current")} />
          </button>
        ) : isFavorited ? (
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        ) : (
          <Star className="w-4 h-4 text-muted-foreground/30" />
        )}
      </ItemMedia>

      <ItemContent>
        {/* Badge type and Group name in ItemTitle */}
        <ItemTitle className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs whitespace-nowrap shrink-0"
          >
            {groupTypeLabels[group.type]}
          </Badge>
          <span className="truncate">{group.name}</span>
        </ItemTitle>

        {/* Unread count, distance, and sync status */}
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <Badge
            variant="outline"
            className="text-xs whitespace-nowrap shrink-0"
          >
            {distanceDisplay}
          </Badge>
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="text-xs whitespace-nowrap shrink-0"
            >
              {unreadCount} mới
            </Badge>
          )}
          {syncStatus.hasPendingMutations && (
            <div className="flex items-center gap-1 text-[10px]">
              {getSyncIcon()}
              {syncStatus.mutationStatus === "pending" && (
                <span className="text-yellow-600">Đang chờ</span>
              )}
              {syncStatus.mutationStatus === "syncing" && (
                <span className="text-blue-600">Đang đồng bộ</span>
              )}
              {syncStatus.mutationStatus === "failed" && (
                <span className="text-red-600">Lỗi</span>
              )}
            </div>
          )}
        </div>
      </ItemContent>

      {/* Actions: Join button */}
      <ItemActions>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          size="sm"
          className="shrink-0"
        >
          <LogIn className="w-3.5 h-3.5 mr-1.5" />
          Tham gia
        </Button>
      </ItemActions>
    </Item>
  );
}
