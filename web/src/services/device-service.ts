/**
 * Device Service
 * Handles device-related operations
 */

import type { Device } from '../domain/device';
import { patch } from './api';
import { getDatabase } from './db';
import { getOrCreateDeviceId } from './device-storage';

/**
 * Updates device nickname
 * @param nickname - New nickname (1-50 characters)
 * @returns Updated device
 */
export async function updateNickname(nickname: string): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  await patch(`/device?id=${deviceId}`, { nickname });

  // Update in RxDB
  const db = await getDatabase();
  const device = await db.devices.findOne(deviceId).exec();
  if (device) {
    await device.patch({ nickname, updated_at: new Date().toISOString() });
  }
}

/**
 * Gets current device
 * @returns Device or null
 */
export async function getDevice(): Promise<Device | null> {
  try {
    const deviceId = getOrCreateDeviceId();
    // Try to get from cache first
    const db = await getDatabase();
    const cached = await db.devices.findOne(deviceId).exec();
    if (cached) {
      return cached.toJSON() as Device;
    }
    return null;
  } catch {
    return null;
  }
}

