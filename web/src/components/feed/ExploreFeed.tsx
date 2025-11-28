import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { discoverNearbyGroups } from "@/services/group-service";
import { getCurrentLocation } from "@/services/location-service";
import { getLatestMessage, getUnreadCount } from "@/services/message-service";
import { isFavorited } from "@/services/favorite-service";
import { GroupCard } from "./GroupCard";
import { FeedErrorState } from "./FeedErrorState";
import { FeedLoadingState } from "./FeedLoadingState";
import { FeedEmptyState } from "./FeedEmptyState";
import { formatDistance } from "@/utils/distance";
import type { RadiusOption } from "@/domain/group";

interface ExploreFeedProps {
  radius: RadiusOption;
  onGroupSelect: (groupId: string) => void;
  className?: string;
}

export function ExploreFeed({
  radius,
  onGroupSelect,
  className,
}: ExploreFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Get user location
  const {
    data: location,
    isLoading: isLoadingLocation,
    error: locationError,
  } = useQuery({
    queryKey: ["location"],
    queryFn: getCurrentLocation,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // Fetch nearby groups
  const {
    data: groupsData,
    isLoading: isLoadingGroups,
    error: groupsError,
  } = useQuery({
    queryKey: [
      "nearby-groups",
      location?.latitude,
      location?.longitude,
      radius,
    ],
    queryFn: async () => {
      if (!location) {
        return { groups: [], distances: [] };
      }
      return discoverNearbyGroups({
        latitude: location.latitude,
        longitude: location.longitude,
        radius,
      });
    },
    enabled: !!location,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  const groups = groupsData?.groups || [];
  const distances = groupsData?.distances || [];

  // Fetch additional data for each group (latest message, unread count, favorite status)
  const groupDetailsQueries = useQuery({
    queryKey: ["group-details", groups.map((g) => g.id)],
    queryFn: async () => {
      const details = await Promise.all(
        groups.map(async (group, index) => {
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
    enabled: groups.length > 0,
    staleTime: 10 * 1000, // 10 seconds
  });

  const groupDetails = groupDetailsQueries.data || [];

  // Virtualization
  const virtualizer = useVirtualizer({
    count: groupDetails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 500, // Estimated card height
    overscan: 3,
  });

  const isLoading =
    isLoadingLocation || isLoadingGroups || groupDetailsQueries.isLoading;

  // Error state: GPS unavailable
  if (locationError || (!location && !isLoadingLocation)) {
    return (
      <FeedErrorState
        title="Không thể lấy vị trí của bạn"
        message="Vui lòng bật GPS và cấp quyền truy cập vị trí"
      />
    );
  }

  // Error state: Network connectivity
  if (groupsError) {
    return (
      <FeedErrorState
        title="Không thể tải danh sách nhóm"
        message="Kiểm tra kết nối mạng của bạn"
      />
    );
  }

  if (isLoading) {
    return <FeedLoadingState />;
  }

  if (groups.length === 0) {
    return (
      <FeedEmptyState
        title={`Không tìm thấy nhóm nào trong bán kính ${radius}m`}
        message="Thử mở rộng bán kính tìm kiếm"
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
