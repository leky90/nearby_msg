import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "@/hooks/useLocation";
import { useDebouncedLocation } from "@/hooks/useDebouncedLocation";
import { useNearbyGroups } from "@/hooks/useNearbyGroups";
import { useGroups } from "@/hooks/useGroups";
import { useGroupDetails } from "@/hooks/useGroupDetails";
import { useFavoriteToggle } from "@/hooks/useFavoriteToggle";
import { GroupList } from "./GroupList";
import { FeedErrorState } from "./FeedErrorState";
import { FeedLoadingState } from "./FeedLoadingState";
import { FeedEmptyState } from "./FeedEmptyState";
import { CreateGroupView } from "@/components/groups/CreateGroupView";
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
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const navigate = useNavigate();

  // Location management (extracted to hook)
  const {
    location,
    isLoading: isLoadingLocation,
    error: locationError,
    refetch: refetchLocation,
  } = useLocation();
  const { debouncedLocation } = useDebouncedLocation({ location });

  // Nearby groups (reactive from RxDB)
  const {
    groups,
    distances,
    isLoading: isLoadingGroups,
    error: groupsError,
  } = useNearbyGroups({
    latitude: debouncedLocation?.latitude ?? 0,
    longitude: debouncedLocation?.longitude ?? 0,
    radius,
    reactive: true,
  });

  // Group details from RxDB (for latest data)
  const { groups: rxdbGroups, isLoading: isLoadingRxDBGroups } = useGroups({
    groupIds: groups.map((g) => g.id),
    reactive: true,
  });

  // Additional group details (extracted to hook)
  const { groupDetails, isLoading: isLoadingDetails } = useGroupDetails({
    groups: groups.map((group, index) => rxdbGroups[index] ?? group),
    distances,
    enabled: groups.length > 0 && !isLoadingRxDBGroups,
  });

  // Favorite toggle (extracted to hook)
  const { toggleFavorite } = useFavoriteToggle();

  const isLoading = isLoadingLocation || isLoadingGroups || isLoadingDetails;

  const handleRefresh = () => {
    if (locationError || (!location && !isLoadingLocation)) {
      void refetchLocation();
    }
    // Groups are reactive (subscribe from RxDB), no need to refetch
  };

  const handleBack = () => {
    navigate("/");
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
    <GroupList
      groupDetails={groupDetails}
      onGroupSelect={onGroupSelect}
      onFavoriteToggle={toggleFavorite}
      className={className}
    />
  );
}
