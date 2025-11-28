import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigationStore } from "@/stores/navigation-store";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { discoverNearbyGroups, getGroup } from "@/services/group-service";
import { getCurrentLocation } from "@/services/location-service";
import { getLatestMessage, getUnreadCount } from "@/services/message-service";
import {
  isFavorited,
  addFavorite,
  removeFavorite,
} from "@/services/favorite-service";
import { GroupListItem } from "./GroupListItem";
import { FeedErrorState } from "./FeedErrorState";
import { FeedLoadingState } from "./FeedLoadingState";
import { FeedEmptyState } from "./FeedEmptyState";
import { CreateGroupView } from "@/components/groups/CreateGroupView";
import { formatDistance } from "@/utils/distance";
import type { RadiusOption } from "@/domain/group";
import { showToast } from "@/utils/toast";

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
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setActiveTab } = useNavigationStore();

  const { deviceLocation } = useAppStore();

  // Get user location - prefer app store, fallback to GPS
  const {
    data: gpsLocation,
    isLoading: isLoadingLocation,
    error: locationError,
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

  // Fetch nearby groups
  const {
    data: groupsData,
    isLoading: isLoadingGroups,
    error: groupsError,
    refetch: refetchGroups,
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
  // Also refetch group data to ensure we have latest group info (including name updates)
  const groupDetailsQueries = useQuery({
    queryKey: [
      "group-details",
      groups
        .map((g) => g.id)
        .sort()
        .join(","),
    ],
    queryFn: async () => {
      const details = await Promise.all(
        groups.map(async (group, index) => {
          // Fetch fresh group data to ensure we have latest name
          const freshGroup = await getGroup(group.id).catch(() => null);
          // Use fresh group if available, otherwise fallback to cached group
          const currentGroup: Group = freshGroup ?? group;

          const [latestMessage, unreadCount, favorited] = await Promise.all([
            getLatestMessage(currentGroup.id).catch(() => null),
            getUnreadCount(currentGroup.id).catch(() => 0),
            isFavorited(currentGroup.id).catch(() => false),
          ]);

          return {
            group: currentGroup, // Use fresh group data if available
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
    estimateSize: () => 100, // Estimated list item height
    overscan: 5,
  });

  const isLoading =
    isLoadingLocation || isLoadingGroups || groupDetailsQueries.isLoading;

  const handleRefresh = () => {
    if (locationError || (!location && !isLoadingLocation)) {
      void refetchLocation();
    }
    if (groupsError) {
      void refetchGroups();
      queryClient.invalidateQueries({ queryKey: ["group-details"] });
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
      await queryClient.invalidateQueries({ queryKey: ["group-details"] });
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      await queryClient.invalidateQueries({ queryKey: ["favorite-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby-groups"] });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      showToast("Không thể cập nhật trạng thái quan tâm", "error");
    }
  };

  // Error state: GPS unavailable
  if (locationError || (!location && !isLoadingLocation)) {
    return (
      <FeedErrorState
        title="Không thể lấy vị trí của bạn"
        message="Vui lòng bật GPS và cấp quyền truy cập vị trí để tìm các nhóm khu vực gần bạn trong tình huống khẩn cấp"
        onRefresh={handleRefresh}
        onBack={handleBack}
        isGPSError={true}
      />
    );
  }

  // Error state: Network connectivity
  if (groupsError) {
    return (
      <FeedErrorState
        title="Không thể tải danh sách nhóm"
        message="Kiểm tra kết nối mạng của bạn để cập nhật thông tin khẩn cấp"
        onRefresh={handleRefresh}
        onBack={handleBack}
      />
    );
  }

  if (isLoading) {
    return <FeedLoadingState onBack={handleBack} />;
  }

  // Show create group view if user clicked create button
  if (showCreateGroup) {
    return (
      <CreateGroupView
        onGroupCreated={(_group) => {
          setShowCreateGroup(false);
          // Don't auto-navigate to the newly created group
          // User can manually select it from the list
        }}
        onCancel={() => setShowCreateGroup(false)}
      />
    );
  }

  if (groups.length === 0) {
    return (
      <FeedEmptyState
        title={`Không tìm thấy nhóm nào trong bán kính ${radius}m`}
        message="Tạo nhóm theo khu vực để chia sẻ thông tin khẩn cấp và hỗ trợ lẫn nhau"
        showCreateButton={true}
        onCreateClick={() => setShowCreateGroup(true)}
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
