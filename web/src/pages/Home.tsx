/**
 * Home Page - TikTok-Style Immersive Layout
 * Main landing page with bottom navigation and tab-based views
 */

import { useSelector, useDispatch } from "react-redux";
import {
  selectActiveTab,
  setActiveTab,
  type TabType,
} from "@/features/navigation/store/slice";
import type { RootState } from "@/store";
import { useSwipeGesture } from "@/shared/hooks/useSwipeGesture";
import { BottomNavigation } from "@/features/navigation/components/BottomNavigation";
import { TopNavigation } from "@/features/navigation/components/TopNavigation";
import { ExploreFeed } from "@/features/groups/components/feed/ExploreFeed";
import { FollowingFeed } from "@/features/groups/components/feed/FollowingFeed";
import { SOSView } from "@/features/sos/components/SOSView";
import { StatusView } from "@/features/status/components/StatusView";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { cn } from "@/shared/lib/utils";

const tabOrder: TabType[] = ["sos", "following", "explore", "status"];

export function Home() {
  const dispatch = useDispatch();
  const activeTab = useSelector((state: RootState) => selectActiveTab(state));

  const handleSetActiveTab = (tab: TabType) => {
    dispatch(setActiveTab(tab));
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

  const renderActiveView = () => {
    switch (activeTab) {
      case "sos":
        return <SOSView />;
      case "following":
        return (
          <ErrorBoundary>
            <FollowingFeed className="h-full" />
          </ErrorBoundary>
        );
      case "explore":
        return (
          <ErrorBoundary>
            <ExploreFeed className="h-full" />
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
            <ExploreFeed className="h-full" />
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
    </div>
  );
}
