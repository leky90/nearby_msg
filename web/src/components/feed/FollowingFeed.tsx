import { useNavigate } from "react-router-dom";
import { useNavigationStore } from "@/stores/navigation-store";
import { useLocation } from "@/hooks/useLocation";
import { useFavorites } from "@/hooks/useFavorites";
import { useGroups } from "@/hooks/useGroups";
import { useGroupDetails } from "@/hooks/useGroupDetails";
import { useFavoriteToggle } from "@/hooks/useFavoriteToggle";
import { calculateDistance } from "@/domain/group";
import { GroupList } from "./GroupList";
import { FeedErrorState } from "./FeedErrorState";
import { FeedLoadingState } from "./FeedLoadingState";
import { FeedEmptyState } from "./FeedEmptyState";
import type { Group } from "@/domain/group";

interface FollowingFeedProps {
  onGroupSelect: (groupId: string) => void;
  className?: string;
}

export function FollowingFeed({
  onGroupSelect,
  className,
}: FollowingFeedProps) {
  const { setActiveTab } = useNavigationStore();
  const navigate = useNavigate();

  // Location management (extracted to hook)
  const { location, isLoading: isLoadingLocation, refetch: refetchLocation } = useLocation();

  // Favorites (reactive from RxDB)
  const {
    favorites,
    isLoading: isLoadingFavorites,
    error: favoritesError,
  } = useFavorites();

  // Groups from RxDB (reactive)
  const groupIds = favorites?.map((f) => f.group_id) || [];
  const { groups: rxdbGroups, isLoading: isLoadingRxDBGroups } = useGroups({
    groupIds,
    reactive: true,
  });

  // Calculate distances for favorite groups
  const validGroups = rxdbGroups.filter((g): g is Group => g !== null);
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

  // Group details (extracted to hook)
  const { groupDetails, isLoading: isLoadingDetails, error: groupsError } = useGroupDetails({
    groups: validGroups,
    distances,
    enabled: favorites && favorites.length > 0 && !isLoadingRxDBGroups,
  });

  // Favorite toggle (extracted to hook)
  const { toggleFavorite } = useFavoriteToggle();

  const isLoading = isLoadingLocation || isLoadingFavorites || isLoadingDetails;
  const hasError = favoritesError || groupsError;

  const handleRefresh = () => {
    // Favorites and groups are reactive, no need to refetch manually
    if (isLoadingLocation) {
      void refetchLocation();
    }
  };

  const handleBack = () => {
    navigate("/");
    setActiveTab("explore");
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
    <GroupList
      groupDetails={groupDetails}
      onGroupSelect={onGroupSelect}
      onFavoriteToggle={toggleFavorite}
      className={className}
    />
  );
}
