/**
 * Status Service
 * Handles user safety status operations
 */

import type { UserStatus, StatusType } from "@/shared/domain/user_status";
import { getDatabase } from '@/shared/services/db';
import { getOrCreateDeviceId } from '@/features/device/services/device-storage';
import { queueMutation } from '@/features/replication/services/mutation-queue';
import { generateId } from "@/shared/utils/id";
import { log } from "@/shared/lib/logging/logger";

/**
 * Status summary for a group
 */
export interface StatusSummary {
  safe_count: number;
  need_help_count: number;
  cannot_contact_count: number;
  total_count: number;
}

/**
 * Mutation function for updating status (used by Redux Saga)
 * Supports offline-first: queues mutation when offline, calls API when online
 * @param variables - Status update variables
 * @returns Updated status (optimistic when offline)
 */
export async function updateStatusMutation(variables: {
  statusType: StatusType;
  description?: string;
}): Promise<UserStatus> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();

  // Create optimistic status in RxDB immediately
  const optimisticStatus: UserStatus = {
    id: generateId(),
    device_id: deviceId,
    status_type: variables.statusType,
    description: variables.description || undefined,
    created_at: now,
    updated_at: now,
  };

  // Store optimistic status in RxDB
  await db.user_status.upsert(optimisticStatus);

  // Queue mutation for sync (replication mechanism handles API call)
  // No direct API call - replication sync will push mutation to server
  await queueMutation(
    'update_status',
    'user_status',
    {
      status_type: variables.statusType,
      description: variables.description || null,
    },
    optimisticStatus.id
  );
  
  // Return optimistic status
  return optimisticStatus;
}

/**
 * Updates user's safety status (legacy function for backward compatibility)
 * @param statusType - Status type (safe, need_help, cannot_contact)
 * @param description - Optional description
 * @returns Updated status
 */
export async function updateStatus(
  statusType: StatusType,
  description?: string
): Promise<UserStatus> {
  return updateStatusMutation({ statusType, description });
}

/**
 * Query function for fetching status (used by Redux Saga)
 * RxDB-only approach: reads from local cache only
 * Note: Caller should trigger pull replication before calling this if cache might be empty.
 * @returns User status or null if not set
 */
export async function fetchStatus(): Promise<UserStatus | null> {
  const deviceId = getOrCreateDeviceId();

  // RxDB-only: Read from cache (synced via replication)
  const db = await getDatabase();
  const cached = await db.user_status
    .findOne({ selector: { device_id: deviceId } })
    .exec();
  
  if (cached) {
    return cached.toJSON() as UserStatus;
  }
  
  // Not found in RxDB - return null
  // Caller should trigger pull replication to fetch from server
  return null;
}

/**
 * Gets cached status from RxDB
 * @returns Cached status or null
 */
export async function getCachedStatus(): Promise<UserStatus | null> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const status = await db.user_status.findOne({ selector: { device_id: deviceId } }).exec();
  return status ? (status.toJSON() as UserStatus) : null;
}

/**
 * Gets status summary for a group from RxDB (synced via replication)
 * Calculates summary from devices that have sent messages in the group
 * Matches backend logic: counts statuses of devices that participated in group
 * @param groupId - Group ID
 * @returns Status summary
 */
export async function getGroupStatusSummary(groupId: string): Promise<StatusSummary> {
  try {
    // Calculate from RxDB (data synced via replication mechanism)
    const db = await getDatabase();
    
    // Get unique device IDs from messages in this group (matches backend logic)
    const messages = await db.messages
      .find({ selector: { group_id: groupId } })
      .exec();
    
    const deviceIds = new Set<string>();
    for (const msgDoc of messages) {
      const msg = msgDoc.toJSON();
      if (msg.device_id) {
        deviceIds.add(msg.device_id);
      }
    }
    
    if (deviceIds.size === 0) {
      // No devices in group yet
      return {
        safe_count: 0,
        need_help_count: 0,
        cannot_contact_count: 0,
        total_count: 0,
      };
    }
    
    // Get statuses for devices that have messages in this group
    const deviceIdArray = Array.from(deviceIds);
    const statusDocs = await Promise.all(
      deviceIdArray.map(deviceId =>
        db.user_status.findOne({ selector: { device_id: deviceId } }).exec()
      )
    );
    
    // Count statuses by type
    let safe_count = 0;
    let need_help_count = 0;
    let cannot_contact_count = 0;
    
    for (const statusDoc of statusDocs) {
      if (statusDoc) {
        const status = statusDoc.toJSON() as UserStatus;
        switch (status.status_type) {
          case 'safe':
            safe_count++;
            break;
          case 'need_help':
            need_help_count++;
            break;
          case 'cannot_contact':
            cannot_contact_count++;
            break;
        }
      }
    }
    
    return {
      safe_count,
      need_help_count,
      cannot_contact_count,
      total_count: deviceIds.size, // Total devices in group (regardless of status)
    };
  } catch (err) {
    log.error('Failed to calculate status summary from RxDB', err, { groupId });
    // Return empty summary if calculation fails
    // Caller should trigger pull replication to ensure data is fresh
    return {
      safe_count: 0,
      need_help_count: 0,
      cannot_contact_count: 0,
      total_count: 0,
    };
  }
}

