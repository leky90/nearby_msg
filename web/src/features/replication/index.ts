/**
 * Replication Feature Module
 * Public API exports for the replication feature
 */

// Services
export { startReplication, stopReplication } from "./services/replication";
export { triggerImmediateSync } from "./services/replication-sync";
export { syncCollection } from "./services/collection-sync";
export { getPendingMutations, updateMutationStatus, removeMutation } from "./services/mutation-queue";
export { clearAllUserData } from "./services/data-clear";

// Types
export type * from "./types";
