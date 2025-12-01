import { useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@/store";
import {
  selectSelectedRadius,
  selectDeviceLocation,
} from "@/features/navigation/store/appSlice";
import { selectJWTToken } from "@/features/device/store/slice";
import { useNearbyGroups } from "@/features/groups/hooks/useNearbyGroups";
import type { GroupDetail } from "@/features/groups/hooks/useGroupDetails";
import {
  checkDeviceCreatedGroupAction,
  pullGroupsReplicationAction,
} from "@/features/groups/store/groupSaga";
import { calculateDistance } from "@/shared/domain/group";
import { GroupList } from "./GroupList";
import { FeedEmptyState } from "./FeedEmptyState";
import { CreateGroupFAB } from "@/features/navigation/components/CreateGroupFAB";
import { RadiusFilterFAB } from "@/features/navigation/components/RadiusFilterFAB";

interface ExploreFeedProps {
  className?: string;
}

export function ExploreFeed({ className }: ExploreFeedProps) {
  const dispatch = useDispatch();
  const radius = useSelector((state: RootState) => selectSelectedRadius(state));
  const deviceLocation = useSelector((state: RootState) =>
    selectDeviceLocation(state)
  );
  const jwtToken = useSelector((state: RootState) => selectJWTToken(state));
  const { groups } = useNearbyGroups();

  // Check device created group and pull groups replication when entering explore page
  // Only pull after onboarding is complete (both deviceLocation and jwtToken are available)
  useEffect(() => {
    // Both deviceLocation and jwtToken are required for ExploreFeed
    // If missing, wait for onboarding to complete
    if (!deviceLocation || !jwtToken) {
      return;
    }

    dispatch(checkDeviceCreatedGroupAction());

    // Pull groups with location filter (both deviceLocation and jwtToken are guaranteed to exist here)
    dispatch(
      pullGroupsReplicationAction({
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        radius,
      })
    );
  }, [dispatch, deviceLocation, radius, jwtToken]);

  // Empty state when no groups are found for current radius
  if (groups.length === 0) {
    return (
      <>
        <FeedEmptyState
          title={`Không tìm thấy nhóm nào trong bán kính ${radius}m`}
          message="Tạo nhóm theo khu vực để chia sẻ thông tin khẩn cấp và hỗ trợ lẫn nhau"
          showCreateButton={false}
        />
        <CreateGroupFAB />
        <RadiusFilterFAB />
      </>
    );
  }

  // Map basic groups from Redux into minimal GroupDetail objects
  // Calculate distance for each group if deviceLocation is available
  const groupDetails: GroupDetail[] = useMemo(() => {
    return groups.map((group) => {
      let distance: number | null = null;
      if (deviceLocation) {
        distance = calculateDistance(
          deviceLocation.latitude,
          deviceLocation.longitude,
          group.latitude,
          group.longitude
        );
      }

      return {
        group,
        distance,
        latestMessagePreview: null,
        unreadCount: 0,
        activeMemberCount: 0,
      };
    });
  }, [groups, deviceLocation]);

  return (
    <>
      <GroupList groupDetails={groupDetails} className={className} />
      <CreateGroupFAB />
      <RadiusFilterFAB />
    </>
  );
}
