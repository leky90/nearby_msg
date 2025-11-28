import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { fetchFavorites } from "@/services/favorite-service";
import { getGroup } from "@/services/group-service";
import { getCurrentLocation } from "@/services/location-service";
import { getLatestMessage, getUnreadCount } from "@/services/message-service";
import { isFavorited } from "@/services/favorite-service";
import { calculateDistance } from "@/domain/group";
import { GroupCard } from "./GroupCard";
import { FeedErrorState } from "./FeedErrorState";
import { FeedLoadingState } from "./FeedLoadingState";
import { FeedEmptyState } from "./FeedEmptyState";
import { formatDistance } from "@/utils/distance";
import type { Group } from "@/domain/group";

interface FollowingFeedProps {
  onGroupSelect: (groupId: string) => void;
  className?: string;
}

export function FollowingFeed({
  onGroupSelect,
  className,
}: FollowingFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Get user location
  const { data: location, isLoading: isLoadingLocation } = useQuery({
    queryKey: ["location"],
    queryFn: getCurrentLocation,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // Fetch favorite groups
  const {
    data: favorites,
    isLoading: isLoadingFavorites,
    error: favoritesError,
  } = useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // Fetch group details for each favorite
  const {
    data: groupDetails,
    isLoading: isLoadingGroups,
    error: groupsError,
  } = useQuery({
    queryKey: ["favorite-groups", favorites?.map((f) => f.group_id)],
    queryFn: async () => {
      if (!favorites || favorites.length === 0) {
        return [];
      }

      // Fetch all group details in parallel
      const groups = await Promise.all(
        favorites.map((favorite) => getGroup(favorite.group_id))
      );

      // Filter out null groups and calculate distances
      const validGroups = groups.filter((g): g is Group => g !== null);

      // Calculate distances if location is available
      const distances = location
        ? validGroups.map((group) =>
            calculateDistance(
              location.latitude,
              location.longitude,
              group.latitude,
              group.longitude
            )
          )
        : validGroups.map(() => null);

      // Fetch additional data for each group
      const details = await Promise.all(
        validGroups.map(async (group, index) => {
          const [latestMessage, unreadCount, favorited] = await Promise.all([
            getLatestMessage(group.id).catch(() => null),
            getUnreadCount(group.id).catch(() => 0),
            isFavorited(group.id).catch(() => false),
          ]);

          return {
            group,
            distance: distances[index],
            latestMessagePreview: latestMessage?.content
              ? latestMessage.content.substring(0, 50) +
                (latestMessage.content.length > 50 ? "..." : "")
              : null,
            unreadCount,
            isFavorited: favorited,
            activeMemberCount: 0, // TODO: Get from API or calculate
          };
        })
      );

      return details;
    },
    enabled: !!favorites && favorites.length > 0,
    staleTime: 10 * 1000, // 10 seconds
  });

  // Virtualization
  const virtualizer = useVirtualizer({
    count: groupDetails?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 500, // Estimated card height
    overscan: 3,
  });

  const isLoading = isLoadingLocation || isLoadingFavorites || isLoadingGroups;
  const hasError = favoritesError || groupsError;

  // Error state: Network connectivity
  if (hasError) {
    return (
      <FeedErrorState
        title="Không thể tải danh sách nhóm yêu thích"
        message="Kiểm tra kết nối mạng của bạn"
      />
    );
  }

  if (isLoading) {
    return <FeedLoadingState />;
  }

  if (!groupDetails || groupDetails.length === 0) {
    return (
      <FeedEmptyState
        title="Bạn chưa có nhóm yêu thích nào"
        message="Thêm nhóm vào yêu thích để xem chúng ở đây"
      />
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn(className, "overflow-y-auto overflow-x-hidden")}
      style={{
        height: "100%",
        width: "100%",
        maxWidth: "100%",
        overscrollBehaviorY: "contain",
        overscrollBehaviorX: "none",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          maxWidth: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const detail = groupDetails[virtualItem.index];
          if (!detail) return null;

          const {
            group,
            distance,
            latestMessagePreview,
            unreadCount,
            isFavorited,
            activeMemberCount,
          } = detail;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                maxWidth: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-2 sm:px-4 py-2"
            >
              <GroupCard
                group={group}
                distance={distance}
                distanceDisplay={formatDistance(distance)}
                latestMessagePreview={latestMessagePreview}
                activeMemberCount={activeMemberCount}
                isFavorited={isFavorited}
                unreadCount={unreadCount}
                onClick={() => onGroupSelect(group.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
