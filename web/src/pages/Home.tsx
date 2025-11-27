/**
 * Home Page
 * Main landing page with SOS button and navigation
 */

import { useState, useEffect } from "react";
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
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../services/favorite-service";
import { getGroup } from "../services/group-service";
import { getUnreadCount } from "../services/message-service";
import { getCurrentLocation } from "../services/location-service";
import { getStatus } from "../services/status-service";
import { calculateDistance } from "../domain/group";
import type { Group } from "../domain/group";
import type { FavoriteGroup } from "../domain/favorite_group";
import type { UserStatus } from "../domain/user_status";

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
  const [currentStatus, setCurrentStatus] = useState<UserStatus | null>(null);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // TODO: Get default/selected group ID from context or state
  const defaultGroupId = undefined; // Will be set when groups are implemented

  // Load favorite groups
  useEffect(() => {
    const loadFavorites = async () => {
      setIsLoadingFavorites(true);
      try {
        const favorites = await getFavorites();
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
        console.error("Failed to load favorites:", err);
      } finally {
        setIsLoadingFavorites(false);
      }
    };

    void loadFavorites();
  }, []);

  // Load current status
  useEffect(() => {
    const loadStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const status = await getStatus();
        setCurrentStatus(status);
      } catch (err) {
        console.error("Failed to load status:", err);
      } finally {
        setIsLoadingStatus(false);
      }
    };

    void loadStatus();
  }, []);

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
      // Reload favorites
      const favorites = await getFavorites();
      const location = await getCurrentLocation();
      const favoritesWithDetails = await Promise.all(
        favorites.map(async (favorite) => {
          const groupData = await getGroup(favorite.group_id);
          if (!groupData) return null;
          let distance: number | undefined;
          if (location) {
            distance = calculateDistance(
              location.latitude,
              location.longitude,
              groupData.latitude,
              groupData.longitude
            );
          }
          const unreadCount = await getUnreadCount(groupData.id);
          return { favorite, group: groupData, distance, unreadCount };
        })
      );
      setFavoriteGroups(
        favoritesWithDetails.filter(
          (f): f is FavoriteGroupWithDetails => f !== null
        )
      );
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
        <h1 className="text-3xl font-bold">Nearby Community Chat</h1>
        <p className="mt-2 text-muted-foreground">
          Connect with your local community during emergencies
        </p>
      </header>

      <main className="space-y-6">
        <section className="flex items-center justify-end">
          <ConnectivityStatus showLabel={true} size="sm" />
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Emergency SOS</CardTitle>
              <CardDescription>
                Send an emergency SOS message to nearby groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SOSButton
                groupId={defaultGroupId}
                variant="destructive"
                size="default"
                onSOSSent={() => {
                  // TODO: Navigate to chat or show confirmation
                  console.log("SOS message sent");
                }}
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>My Status</CardTitle>
              <CardDescription>
                Update your safety status to let others know how you're doing
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
                    onStatusUpdated={(status) => {
                      setCurrentStatus(status);
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
                  Discover Groups
                </CardTitle>
                <CardDescription>
                  Find and join nearby community groups
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleNavigateToNearbyGroups}
                  className="w-full"
                >
                  Browse Nearby Groups
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Create Group
                </CardTitle>
                <CardDescription>
                  Create a new community group for your area
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleCreateGroup}
                  variant="outline"
                  className="w-full"
                >
                  Create New Group
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
                Favorite Groups
              </CardTitle>
              <CardDescription>
                Quick access to your favorite community groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFavorites ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
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
                  No favorite groups yet. Discover groups to add favorites.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
