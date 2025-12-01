import { log } from "@/shared/lib/logging/logger";
import type { SyncErrorType } from "@/shared/refresh/types";

export function logRefreshStart(scope: string, trigger: string): void {
  log.info(`refresh:start scope=${scope} trigger=${trigger}`);
}

export function logRefreshSuccess(scope: string): void {
  log.info(`refresh:success scope=${scope}`);
}

export function logRefreshFailure(scope: string, errorType: SyncErrorType, error?: unknown): void {
  if (error instanceof Error) {
    log.warn(`refresh:failure scope=${scope} errorType=${errorType}`, error);
  } else {
    log.warn(`refresh:failure scope=${scope} errorType=${errorType}`, { error });
  }
}
