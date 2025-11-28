import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useNavigationStore } from "@/stores/navigation-store";
import { useAppStore } from "@/stores/app-store";
import { fetchFavorites } from "@/services/favorite-service";
import { getGroup } from "@/services/group-service";
import { getCurrentLocation } from "@/services/location-service";
import { getLatestMessage, getUnreadCount } from "@/services/message-service";
import {
  isFavorited,
  addFavorite,
  removeFavorite,
} from "@/services/favorite-service";
import { calculateDistance } from "@/domain/group";
import { GroupListItem } from "./GroupListItem";
import { FeedErrorState } from "./FeedErrorState";
import { FeedLoadingState } from "./FeedLoadingState";
import { FeedEmptyState } from "./FeedEmptyState";
import { formatDistance } from "@/utils/distance";
import type { Group } from "@/domain/group";
import { showToast } from "@/utils/toast";

interface FollowingFeedProps {
  onGroupSelect: (groupId: string) => void;
  className?: string;
}

export function FollowingFeed({
  onGroupSelect,
  className,
}: FollowingFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { setActiveTab } = useNavigationStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { deviceLocation } = useAppStore();

  // Get user location - prefer app store, fallback to GPS
  const {
    data: gpsLocation,
    isLoading: isLoadingLocation,
    refetch: refetchLocation,
  } = useQuery({
    queryKey: ["location"],
    queryFn: getCurrentLocation,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: !deviceLocation, // Only fetch if no location in store
  });

  // Use deviceLocation from store if available, otherwise use GPS location
  const location = deviceLocation
    ? {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        accuracy: undefined,
        timestamp: deviceLocation.updatedAt
          ? new Date(deviceLocation.updatedAt).getTime()
          : Date.now(),
      }
    : gpsLocation;

  // Fetch favorite groups
  const {
    data: favorites,
    isLoading: isLoadingFavorites,
    error: favoritesError,
    refetch: refetchFavorites,
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
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ["favorite-groups", favorites?.map((f) => f.group_id)],
    queryFn: async () => {
      if (!favorites || favorites.length === 0) {
        return [];
      }

      // Fetch all group details in parallel (fresh data to ensure latest name)
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
    estimateSize: () => 100, // Estimated list item height
    overscan: 5,
  });

  const isLoading = isLoadingLocation || isLoadingFavorites || isLoadingGroups;
  const hasError = favoritesError || groupsError;

  const handleRefresh = () => {
    if (favoritesError) {
      void refetchFavorites();
    }
    if (groupsError) {
      void refetchGroups();
      queryClient.invalidateQueries({ queryKey: ["group-details"] });
    }
    if (isLoadingLocation) {
      void refetchLocation();
    }
  };

  const handleBack = () => {
    navigate("/");
    setActiveTab("explore");
  };

  const handleFavoriteToggle = async (
    groupId: string,
    shouldFavorite: boolean
  ) => {
    try {
      if (shouldFavorite) {
        await addFavorite(groupId);
      } else {
        await removeFavorite(groupId);
      }
      // Invalidate queries to refresh UI
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      await queryClient.invalidateQueries({ queryKey: ["favorite-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["group-details"] });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      showToast("Không thể cập nhật trạng thái quan tâm", "error");
    }
  };

  // Error state: Network connectivity
  if (hasError) {
    return (
      <FeedErrorState
        title="Không thể tải danh sách nhóm quan tâm"
        message="Kiểm tra kết nối mạng của bạn để cập nhật thông tin khẩn cấp"
        onRefresh={handleRefresh}
        onBack={handleBack}
      />
    );
  }

  if (isLoading) {
    return <FeedLoadingState onBack={handleBack} />;
  }

  if (!groupDetails || groupDetails.length === 0) {
    return (
      <FeedEmptyState
        title="Bạn chưa có nhóm quan tâm nào"
        message="Chuyển sang Khám phá để tìm và theo dõi các nhóm khu vực quan trọng gần bạn"
        showActionButton={true}
        actionButtonLabel="Đi đến Khám phá"
        onActionClick={() => {
          setActiveTab("explore");
        }}
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
              className="px-2 sm:px-4 py-1.5"
            >
              <GroupListItem
                group={group}
                distance={distance}
                distanceDisplay={formatDistance(distance)}
                latestMessagePreview={latestMessagePreview}
                isFavorited={isFavorited}
                unreadCount={unreadCount}
                onClick={() => onGroupSelect(group.id)}
                onFavoriteToggle={(newIsFavorited) =>
                  handleFavoriteToggle(group.id, newIsFavorited)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
