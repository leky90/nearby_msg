/**
 * Home Page - TikTok-Style Immersive Layout
 * Main landing page with bottom navigation and tab-based views
 */

import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  selectActiveTab,
  setActiveTab,
  navigateToChat,
  type TabType,
} from "@/store/slices/navigationSlice";
import {
  selectSelectedRadius,
  setSelectedRadius,
} from "@/store/slices/appSlice";
import type { RootState } from "@/store";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUserStatus } from "@/hooks/useUserStatus";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { TopNavigation } from "@/components/navigation/TopNavigation";
import { RadiusFilterFAB } from "@/components/navigation/RadiusFilterFAB";
import { CreateGroupFAB } from "@/components/navigation/CreateGroupFAB";
import { ExploreFeed } from "@/components/feed/ExploreFeed";
import { FollowingFeed } from "@/components/feed/FollowingFeed";
import { SOSView } from "@/components/sos/SOSView";
import { StatusView } from "@/components/status/StatusView";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { cn } from "@/lib/utils";

const tabOrder: TabType[] = ["sos", "following", "explore", "status"];

export function Home() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const activeTab = useSelector((state: RootState) => selectActiveTab(state));
  const selectedRadius = useSelector((state: RootState) =>
    selectSelectedRadius(state)
  );

  const handleSetActiveTab = (tab: TabType) => {
    dispatch(setActiveTab(tab));
  };

  const handleSetSelectedRadius = (radius: 500 | 1000 | 2000) => {
    dispatch(setSelectedRadius(radius));
  };

  const handleNavigateToChat = (groupId: string) => {
    dispatch(navigateToChat(groupId));
  };

  // Swipe gesture for tab switching
  const handleSwipeLeft = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      handleSetActiveTab(tabOrder[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      handleSetActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
    preventDefault: false, // Don't prevent default to allow scrolling
  });

  // Initialize network and user status
  useNetworkStatus();
  useUserStatus();

  const handleGroupSelect = (groupId: string) => {
    handleNavigateToChat(groupId);
    navigate(`/chat/${groupId}`);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case "sos":
        return <SOSView />;
      case "following":
        return (
          <ErrorBoundary>
            <FollowingFeed
              onGroupSelect={handleGroupSelect}
              className="h-full"
            />
          </ErrorBoundary>
        );
      case "explore":
        return (
          <ErrorBoundary>
            <ExploreFeed
              radius={selectedRadius}
              onGroupSelect={handleGroupSelect}
              className="h-full"
            />
          </ErrorBoundary>
        );
      case "status":
        return <StatusView />;
      case "chat":
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Xem trò chuyện - Sắp ra mắt</p>
          </div>
        );
      default:
        return (
          <ErrorBoundary>
            <ExploreFeed
              radius={selectedRadius}
              onGroupSelect={handleGroupSelect}
              className="h-full"
            />
          </ErrorBoundary>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      {/* Top Navigation - Fixed at top */}
      <TopNavigation />

      {/* Main content area */}
      <main
        {...swipeHandlers.handlers}
        className={cn(
          "flex-1 overflow-hidden",
          "overscroll-y-contain overscroll-x-none", // Prevent pull-to-refresh
          "pt-14", // Space for top navigation
          "pb-16" // Space for bottom navigation
        )}
      >
        <div
          className={cn(
            "h-full w-full max-w-full",
            "transition-all duration-300 ease-in-out", // For smooth tab switching animations
            "overflow-hidden" // Prevent content from causing page scroll
          )}
        >
          {renderActiveView()}
        </div>
      </main>

      {/* Bottom Navigation - Fixed at bottom */}
      <BottomNavigation />

      {/* Create Group FAB - Show on Explore and Following tabs */}
      {(activeTab === "explore" || activeTab === "following") && (
        <CreateGroupFAB
          onGroupCreated={(_group) => {
            // Don't auto-navigate to the newly created group
            // User can manually select it from the list
          }}
        />
      )}

      {/* Radius Filter FAB - Only show on Explore tab */}
      {activeTab === "explore" && (
        <RadiusFilterFAB
          selectedRadius={selectedRadius}
          onRadiusChange={handleSetSelectedRadius}
        />
      )}
    </div>
  );
}
