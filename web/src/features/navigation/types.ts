/**
 * Navigation Feature Types
 * Type definitions for the navigation feature module
 */

export type TabType = "sos" | "following" | "explore" | "status";

export interface NavigationState {
  activeTab: TabType;
  currentChatGroupId: string | null;
}
