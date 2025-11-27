/**
 * Nearby Groups Page
 * Displays list of nearby groups with distance and activity
 */

import { useState, useEffect } from "react";
import type { Group, RadiusOption } from "../domain/group";
import { discoverNearbyGroups } from "../services/group-service";
import {
  getCurrentLocation,
  isGeolocationAvailable,
} from "../services/location-service";
import { GroupCard } from "../components/groups/GroupCard";
import { RadiusFilter } from "../components/groups/RadiusFilter";
import { OfflineIndicator } from "../components/common/OfflineIndicator";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { t } from "../lib/i18n";

export function NearbyGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [distances, setDistances] = useState<number[]>([]);
  const [radius, setRadius] = useState<RadiusOption>(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Get user location on mount
  useEffect(() => {
    async function loadLocation() {
      if (isGeolocationAvailable()) {
        const loc = await getCurrentLocation();
        if (loc) {
          setLocation({ latitude: loc.latitude, longitude: loc.longitude });
        } else {
          setError(
            t("error.locationRequired") ||
              "Không thể lấy vị trí. Vui lòng bật dịch vụ vị trí."
          );
        }
      } else {
        setError(
          t("error.locationRequired") ||
            "Định vị không khả dụng. Vui lòng nhập vị trí thủ công."
        );
      }
    }
    loadLocation();
  }, []);

  // Load nearby groups when location or radius changes
  useEffect(() => {
    if (!location) return;

    async function loadGroups() {
      try {
        setLoading(true);
        setError(null);
        const response = await discoverNearbyGroups({
          latitude: location!.latitude,
          longitude: location!.longitude,
          radius,
        });
        setGroups(response.groups);
        setDistances(response.distances || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("error.network") || "Không thể tải nhóm gần đây"
        );
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, [location, radius]);

  const handleGroupClick = (group: Group) => {
    // TODO: Navigate to chat page
    console.log("Navigate to group:", group.id);
  };

  return (
    <div className="nearby-groups-page">
      <header className="nearby-groups-header">
        <h1 className="nearby-groups-title">{t("page.nearbyGroups.title")}</h1>
        <OfflineIndicator />
      </header>

      <div className="nearby-groups-controls">
        <RadiusFilter radius={radius} onRadiusChange={setRadius} />
      </div>

      {error && (
        <div className="nearby-groups-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 p-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="min-h-[48px]">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-6 w-48" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="nearby-groups-empty">
          <p>
            {t("page.nearbyGroups.noGroupsFound", { radius }) ||
              `Không tìm thấy nhóm nào trong bán kính ${radius}m.`}
          </p>
          <p>
            {t("page.nearbyGroups.tryIncreasingRadius") ||
              "Thử tăng bán kính tìm kiếm hoặc tạo nhóm mới."}
          </p>
        </div>
      ) : (
        <div className="nearby-groups-list">
          {groups.map((group, index) => (
            <GroupCard
              key={group.id}
              group={group}
              distance={distances[index]}
              onClick={handleGroupClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
