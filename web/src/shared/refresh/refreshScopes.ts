export type RefreshScope = "groupsFeed" | "chat" | "status";

/**
 * Central list of logical refresh scopes used by data screens.
 * This keeps scope identifiers consistent across hooks and components.
 */
export const REFRESH_SCOPES: Record<RefreshScope, RefreshScope> = {
  groupsFeed: "groupsFeed",
  chat: "chat",
  status: "status",
};
