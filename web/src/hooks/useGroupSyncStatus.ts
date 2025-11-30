/**
 * Hook to check sync status for a group
 * Returns whether the group has pending mutations
 */

import { useState, useEffect } from "react";
import { getDatabase } from "@/services/db";
import { getPendingMutationsForCollection } from "@/services/mutation-queue";
import { log } from "@/lib/logging/logger";
import type { Collection } from "@/domain/mutation";

export interface GroupSyncStatus {
  hasPendingMutations: boolean;
  mutationStatus: "synced" | "pending" | "syncing" | "failed" | null;
  mutationCount: number;
}

export function useGroupSyncStatus(groupId: string): GroupSyncStatus {
  const [status, setStatus] = useState<GroupSyncStatus>({
    hasPendingMutations: false,
    mutationStatus: null,
    mutationCount: 0,
  });

  useEffect(() => {
    let subscription: (() => void) | null = null;
    let isMounted = true;

    const updateStatus = async () => {
      if (!isMounted) return;

      try {
        const db = await getDatabase();
        
        // Check for pending mutations for this group
        const pendingMutations = await getPendingMutationsForCollection("groups" as Collection);
        const groupMutations = pendingMutations.filter(
          (mut) => mut.entity_id === groupId
        );

        // Also check syncing mutations
        const syncingMutations = await db.mutations
          .find({
            selector: {
              target_collection: "groups",
              entity_id: groupId,
              sync_status: "syncing",
            },
          })
          .exec();

        // Check failed mutations
        const failedMutations = await db.mutations
          .find({
            selector: {
              target_collection: "groups",
              entity_id: groupId,
              sync_status: "failed",
            },
          })
          .exec();

        if (!isMounted) return;

        const totalCount = groupMutations.length + syncingMutations.length + failedMutations.length;
        
        let mutationStatus: GroupSyncStatus["mutationStatus"] = null;
        if (failedMutations.length > 0) {
          mutationStatus = "failed";
        } else if (syncingMutations.length > 0) {
          mutationStatus = "syncing";
        } else if (groupMutations.length > 0) {
          mutationStatus = "pending";
        } else {
          mutationStatus = "synced";
        }

        setStatus({
          hasPendingMutations: totalCount > 0,
          mutationStatus,
          mutationCount: totalCount,
        });
      } catch (err) {
        log.error("Failed to check group sync status", err, { groupId });
      }
    };

    const setupSubscription = async () => {
      try {
        const db = await getDatabase();
        
        // Watch for changes - create subscription once
        const query = db.mutations.find({
          selector: {
            target_collection: "groups",
            entity_id: groupId,
            sync_status: { $in: ["pending", "syncing", "failed"] },
          },
        });

        const sub = query.$.subscribe(() => {
          // Only update status, don't recreate subscription
          void updateStatus();
        });

        subscription = () => sub.unsubscribe();
        
        // Initial status update
        void updateStatus();
      } catch (err) {
        log.error("Failed to setup subscription", err, { groupId });
      }
    };

    void setupSubscription();

    // Also check periodically (less frequent)
    const interval = setInterval(() => {
      void updateStatus();
    }, 5000); // Increased to 5 seconds to reduce load

    return () => {
      isMounted = false;
      if (subscription) {
        subscription();
      }
      clearInterval(interval);
    };
  }, [groupId]);

  return status;
}
