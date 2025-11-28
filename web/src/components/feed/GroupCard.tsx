import { MapPin, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Group } from "@/domain/group";

interface GroupCardProps {
  group: Group;
  distance: number | null;
  distanceDisplay: string;
  latestMessagePreview: string | null;
  activeMemberCount: number;
  isFavorited: boolean;
  unreadCount: number;
  miniMapData?: {
    centerLat: number;
    centerLng: number;
    userLat: number;
    userLng: number;
  } | null;
  onClick: () => void;
  onFavoriteToggle?: (isFavorited: boolean) => void;
  className?: string;
}

export function GroupCard({
  group,
  distanceDisplay,
  latestMessagePreview,
  activeMemberCount,
  isFavorited,
  unreadCount,
  miniMapData,
  onClick,
  onFavoriteToggle,
  className,
}: GroupCardProps) {
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

  return (
    <div
      className={cn(
        "w-full max-w-full h-full min-h-[400px]",
        "bg-card border rounded-lg",
        "flex flex-col",
        "overflow-hidden",
        className
      )}
    >
      {/* Mini-map placeholder */}
      <div className="relative h-48 bg-muted flex items-center justify-center">
        {miniMapData ? (
          <div className="text-sm text-muted-foreground">
            Map: {group.latitude.toFixed(4)}, {group.longitude.toFixed(4)}
          </div>
        ) : (
          <MapPin className="w-12 h-12 text-muted-foreground/50" />
        )}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 bg-background/95 backdrop-blur-sm rounded-full text-xs font-medium text-foreground shadow-sm">
            {distanceDisplay}
          </span>
        </div>
      </div>

      {/* Group Info */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{group.name}</h3>
            <p className="text-sm text-foreground/70">
              {groupTypeLabels[group.type]}
            </p>
          </div>
          {onFavoriteToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle(!isFavorited);
              }}
              className={cn(
                "p-2 rounded-full transition-colors",
                isFavorited
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={isFavorited ? "Bỏ quan tâm" : "Quan tâm"}
            >
              <svg
                className="w-5 h-5"
                fill={isFavorited ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Latest Message Preview */}
        {latestMessagePreview && (
          <div className="flex items-start gap-2 text-sm text-foreground/70">
            <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="line-clamp-2 flex-1">{latestMessagePreview}</p>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-foreground/70">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{activeMemberCount} online</span>
          </div>
          {unreadCount > 0 && (
            <div className="px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-medium">
              {unreadCount} mới
            </div>
          )}
        </div>

        {/* Join Chat Button */}
        <Button onClick={onClick} className="w-full mt-auto" size="lg">
          Vào Chat
        </Button>
      </div>
    </div>
  );
}
