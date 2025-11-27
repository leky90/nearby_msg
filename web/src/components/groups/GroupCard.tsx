/**
 * Group Card Component
 * Displays group information with distance, type, and activity
 */

import { MapPin, MessageSquare, Star } from "lucide-react";
import type { Group } from "../../domain/group";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export interface GroupCardProps {
  /** Group to display */
  group: Group;
  /** Distance from user in meters */
  distance?: number;
  /** Activity count (messages in last 24h) */
  activity?: number;
  /** Whether group is favorited */
  isFavorited?: boolean;
  /** Callback when card is clicked */
  onClick?: (group: Group) => void;
  /** Callback when favorite button is clicked */
  onFavoriteToggle?: (group: Group, isFavorited: boolean) => void;
  /** Custom className */
  className?: string;
}

/**
 * Formats distance for display
 * @param distance - Distance in meters
 * @returns Formatted distance string
 */
function formatDistance(distance: number): string {
  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  }
  return `${(distance / 1000).toFixed(1)}km`;
}

/**
 * Gets group type label
 * @param type - Group type
 * @returns Display label
 */
function getGroupTypeLabel(type: Group["type"]): string {
  const labels: Record<Group["type"], string> = {
    neighborhood: t("group.type.neighborhood"),
    ward: t("group.type.ward"),
    district: t("group.type.district"),
    apartment: t("group.type.apartment"),
    other: t("group.type.other"),
  };
  return labels[type] || type;
}

/**
 * Group Card component
 * Displays group information in a card format using shadcn Card and Badge
 */
export function GroupCard({
  group,
  distance,
  activity = 0,
  isFavorited = false,
  onClick,
  onFavoriteToggle,
  className = "",
}: GroupCardProps) {
  const handleClick = () => {
    onClick?.(group);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.(group, !isFavorited);
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent min-h-[48px]",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-heading-2 leading-heading-2">{group.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{getGroupTypeLabel(group.type)}</Badge>
            {onFavoriteToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFavoriteClick}
                className="h-8 w-8 p-0"
                aria-label={isFavorited ? t("button.unfavorite") : t("button.favorite")}
              >
                <Star
                  className={cn(
                    "size-4",
                    isFavorited && "fill-yellow-400 text-yellow-400"
                  )}
                />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {distance !== undefined && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              <span>{t("component.groupCard.distance", { distance: formatDistance(distance) })}</span>
            </div>
          )}
          {activity > 0 && (
            <div className="flex items-center gap-1.5">
              <MessageSquare className="size-4" />
              <span>{t("component.groupCard.members", { count: activity })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
