/**
 * Favorite Group Card Component
 * Displays a favorite group with quick access
 */

import { MessageSquare, MapPin, Star } from "lucide-react";
import type { Group } from "../../domain/group";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export interface FavoriteGroupCardProps {
  /** Group information */
  group: Group;
  /** Distance from user in meters */
  distance?: number;
  /** Unread message count */
  unreadCount?: number;
  /** Callback when card is clicked */
  onClick?: (group: Group) => void;
  /** Callback when unfavorite is clicked */
  onUnfavorite?: (group: Group) => void;
  /** Custom className */
  className?: string;
}

/**
 * Formats distance for display
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

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
 * Favorite Group Card component
 * Displays favorite group with unread count and quick access
 */
export function FavoriteGroupCard({
  group,
  distance,
  unreadCount = 0,
  onClick,
  onUnfavorite,
  className = "",
}: FavoriteGroupCardProps) {
  const handleClick = () => {
    onClick?.(group);
  };

  const handleUnfavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnfavorite?.(group);
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent",
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Star className="size-4 fill-yellow-400 text-yellow-400" />
          <CardTitle className="text-base font-semibold">
            {group.name}
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUnfavorite}
          className="h-8 w-8 p-0"
          aria-label="Unfavorite group"
        >
          <Star className="size-4 fill-yellow-400 text-yellow-400" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {getGroupTypeLabel(group.type)}
          </Badge>
          {distance !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              <span>{formatDistance(distance)}</span>
            </div>
          )}
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-primary">
            <MessageSquare className="size-4" />
            <span className="font-medium">{unreadCount} unread</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
