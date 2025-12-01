/**
 * Replication Feature Types
 * Type definitions for the replication feature module
 */

export type { Mutation } from "@/shared/domain/mutation";

export interface ReplicationCheckpoint {
  collection: string;
  lastSyncedAt: string;
  lastSyncedId: string | null;
}
