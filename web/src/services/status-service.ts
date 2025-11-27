/**
 * Status Service
 * Handles user safety status operations
 */

import type { UserStatus, StatusType } from '../domain/user_status';
import { get, put } from './api';
import { getDatabase } from './db';
import { getOrCreateDeviceId } from './device-storage';

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
 * Updates user's safety status
 * @param statusType - Status type (safe, need_help, cannot_contact)
 * @param description - Optional description
 * @returns Updated status
 */
export async function updateStatus(
  statusType: StatusType,
  description?: string
): Promise<UserStatus> {
  const response = await put<UserStatus>('/status', {
    status_type: statusType,
    description: description || null,
  });

  // Store in RxDB
  const db = await getDatabase();
  await db.user_status.upsert(response);

  return response;
}

/**
 * Gets current user's status
 * @returns User status or null if not set
 */
export async function getStatus(): Promise<UserStatus | null> {
  try {
    const response = await get<UserStatus>('/status');
    // Store in RxDB
    const db = await getDatabase();
    await db.user_status.upsert(response);
    return response;
  } catch (err) {
    // If 404 (not found) or 401 (unauthorized - device not registered yet), try to get from cache
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      ((err as { status: number }).status === 404 ||
        (err as { status: number }).status === 401)
    ) {
      return getCachedStatus();
    }
    throw err;
  }
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
 * Gets status summary for a group
 * @param groupId - Group ID
 * @returns Status summary
 */
export async function getGroupStatusSummary(groupId: string): Promise<StatusSummary> {
  try {
    const response = await get<StatusSummary>(`/groups/${groupId}/status-summary`);
    return response;
  } catch {
    // Fallback to empty summary
    return {
      safe_count: 0,
      need_help_count: 0,
      cannot_contact_count: 0,
      total_count: 0,
    };
  }
}

