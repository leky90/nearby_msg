/**
 * Home Page - TikTok-Style Immersive Layout
 * Main landing page with bottom navigation and tab-based views
 */

import { useNavigate } from "react-router-dom";
import { useNavigationStore, type TabType } from "@/stores/navigation-store";
import { useAppStore } from "@/stores/app-store";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUserStatus } from "@/hooks/useUserStatus";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { TopNavigation } from "@/components/navigation/TopNavigation";
import { RadiusFilterFAB } from "@/components/navigation/RadiusFilterFAB";
import { ExploreFeed } from "@/components/feed/ExploreFeed";
import { FollowingFeed } from "@/components/feed/FollowingFeed";
import { SOSView } from "@/components/sos/SOSView";
import { StatusView } from "@/components/status/StatusView";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { cn } from "@/lib/utils";

const tabOrder: TabType[] = ["sos", "following", "explore", "status"];

export function Home() {
  const navigate = useNavigate();
  const { activeTab, navigateToChat, setActiveTab } = useNavigationStore();
  const { selectedRadius, setSelectedRadius } = useAppStore();

  // Swipe gesture for tab switching
  const handleSwipeLeft = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
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
    navigateToChat(groupId);
    navigate(`/chat/${groupId}`);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case "sos":
        return <SOSView />;
      case "following":
        return (
          <ErrorBoundary>
            <FollowingFeed onGroupSelect={handleGroupSelect} className="h-full" />
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

      {/* Radius Filter FAB - Only show on Explore tab */}
      {activeTab === "explore" && (
        <RadiusFilterFAB
          selectedRadius={selectedRadius}
          onRadiusChange={setSelectedRadius}
        />
      )}
    </div>
  );
}
