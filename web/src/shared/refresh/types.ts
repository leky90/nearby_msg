export type SyncTrigger = "onEnter" | "manualRefreshButton" | "pullDownGesture";

export type SyncStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

export type SyncErrorType = "offline" | "server" | "timeout" | "other";

export interface SyncSessionMeta {
  scope: string;
  trigger: SyncTrigger;
  status: SyncStatus;
  startedAt: number;
  finishedAt?: number;
  errorType?: SyncErrorType;
}

export interface ConnectivityState {
  isOnline: boolean;
  status: "online" | "offline" | "slow";
}
