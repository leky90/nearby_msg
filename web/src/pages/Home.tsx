/**
 * Home Page
 * Main landing page with SOS button and navigation
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, MapPin, Star } from "lucide-react";
import { SOSButton } from "../components/common/SOSButton";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { CreateGroupPage } from "./CreateGroupPage";
import { FavoriteGroupCard } from "../components/groups/FavoriteGroupCard";
import { StatusSelector } from "../components/common/StatusSelector";
import { StatusIndicator } from "../components/common/StatusIndicator";
import { ConnectivityStatus } from "../components/common/ConnectivityStatus";
import { Skeleton } from "../components/ui/skeleton";
import {
  fetchFavorites,
  addFavorite,
  removeFavorite,
} from "../services/favorite-service";
import { getGroup } from "../services/group-service";
import { getUnreadCount } from "../services/message-service";
import { getCurrentLocation } from "../services/location-service";
import { fetchStatus } from "../services/status-service";
import { calculateDistance } from "../domain/group";
import type { Group } from "../domain/group";
import type { FavoriteGroup } from "../domain/favorite_group";
import { t } from "../lib/i18n";
import { NetworkBanner } from "../components/common/NetworkBanner";

type HomeView = "home" | "create-group";

interface FavoriteGroupWithDetails {
  favorite: FavoriteGroup;
  group: Group;
  distance: number | undefined;
  unreadCount: number;
}

export function Home() {
  const [view, setView] = useState<HomeView>("home");
  const [favoriteGroups, setFavoriteGroups] = useState<
    FavoriteGroupWithDetails[]
  >([]);

  // Default group ID will be set when groups are implemented
  const defaultGroupId = undefined;

  // Use TanStack Query for status fetching
  const { data: currentStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });

  // Use TanStack Query for favorites fetching
  const { data: favorites, isLoading: isLoadingFavorites } = useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });

  // Load favorite groups with details (group info, distance, unread count)
  useEffect(() => {
    const loadFavoriteDetails = async () => {
      if (!favorites || favorites.length === 0) {
        setFavoriteGroups([]);
        return;
      }

      try {
        const location = await getCurrentLocation();

        // Load group details and calculate distances
        const favoritesWithDetails = await Promise.all(
          favorites.map(async (favorite) => {
            const group = await getGroup(favorite.group_id);
            if (!group) return null;

            let distance: number | undefined;
            if (location) {
              distance = calculateDistance(
                location.latitude,
                location.longitude,
                group.latitude,
                group.longitude
              );
            }

            const unreadCount = await getUnreadCount(group.id);

            return {
              favorite,
              group,
              distance,
              unreadCount,
            };
          })
        );

        setFavoriteGroups(
          favoritesWithDetails.filter(
            (f): f is FavoriteGroupWithDetails => f !== null
          )
        );
      } catch (err) {
        console.error("Failed to load favorite details:", err);
      }
    };

    void loadFavoriteDetails();
  }, [favorites]);

  const handleNavigateToNearbyGroups = () => {
    // TODO: Use proper routing when router is set up
    // For now, this is a placeholder
    console.log("Navigate to nearby groups");
    // navigate('/nearby-groups');
  };

  const handleCreateGroup = () => {
    setView("create-group");
  };

  const handleGroupCreated = (_group: Group) => {
    // Could navigate to chat page here
    console.log("Group created:", _group);
    // For now, stay on create-group page to show success message
  };

  const handleBackToHome = () => {
    setView("home");
  };

  const handleFavoriteToggle = async (group: Group, isFavorited: boolean) => {
    try {
      if (isFavorited) {
        await addFavorite(group.id);
      } else {
        await removeFavorite(group.id);
      }
      // TanStack Query will automatically refetch favorites due to cache invalidation
      // The useEffect will update favoriteGroups when favorites data changes
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleUnfavorite = async (group: Group) => {
    await handleFavoriteToggle(group, false);
  };

  if (view === "create-group") {
    return (
      <CreateGroupPage
        onGroupCreated={handleGroupCreated}
        onBack={handleBackToHome}
      />
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <header className="mb-8 text-center">
        <h1 className="text-heading-1 font-bold leading-heading-1">
          {t("page.home.title")}
        </h1>
        <p className="mt-2 text-body leading-body text-muted-foreground">
          {t("page.home.subtitle")}
        </p>
      </header>

      <main className="space-y-6">
        <NetworkBanner />
        <section className="flex items-center justify-end">
          <ConnectivityStatus showLabel={true} size="sm" />
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>{t("page.home.emergencySOS")}</CardTitle>
              <CardDescription>
                {t("page.home.emergencySOSDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <SOSButton
                  groupId={defaultGroupId}
                  variant="destructive"
                  size="lg"
                  onSOSSent={() => {
                    // TODO: Navigate to chat or show confirmation
                    console.log("SOS message sent");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>{t("page.home.myStatus")}</CardTitle>
              <CardDescription>
                {t("page.home.myStatusDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {currentStatus && (
                    <div className="mb-4">
                      <StatusIndicator
                        statusType={currentStatus.status_type}
                        description={currentStatus.description}
                        showDescription={!!currentStatus.description}
                      />
                    </div>
                  )}
                  <StatusSelector
                    onStatusUpdated={() => {
                      // Status is automatically updated via TanStack Query
                      // No need to manually update state
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-5" />
                  {t("page.home.discoverGroups")}
                </CardTitle>
                <CardDescription>
                  {t("page.home.discoverGroupsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleNavigateToNearbyGroups}
                  className="w-full h-12"
                >
                  {t("page.home.discoverGroups")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  {t("page.home.createGroup")}
                </CardTitle>
                <CardDescription>
                  {t("page.home.createGroupDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleCreateGroup}
                  variant="outline"
                  className="w-full h-12"
                >
                  {t("button.createGroup")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="size-5 fill-yellow-400 text-yellow-400" />
                {t("page.home.favoriteGroups")}
              </CardTitle>
              <CardDescription>
                {t("page.home.favoriteGroupsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFavorites ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Card key={i} className="min-h-[48px]">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded-full" />
                          <Skeleton className="h-6 w-32" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-4 w-24" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : favoriteGroups.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {favoriteGroups.map(
                    ({ favorite, group, distance, unreadCount }) => (
                      <FavoriteGroupCard
                        key={favorite.id}
                        group={group}
                        distance={distance}
                        unreadCount={unreadCount}
                        onClick={() => {
                          // TODO: Navigate to chat page
                          console.log("Navigate to group:", group.id);
                        }}
                        onUnfavorite={handleUnfavorite}
                      />
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("page.home.noFavoriteGroups")}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
