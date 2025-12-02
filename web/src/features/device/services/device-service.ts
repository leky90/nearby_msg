/**
 * Device Service
 * Handles device-related operations
 * Functions for Redux Saga integration
 */

import type { Device, DeviceCreateRequest } from "@/shared/domain/device";
import { post, setToken } from '@/shared/services/api';
import { getDatabase } from '@/shared/services/db';
import { getOrCreateDeviceId, setDeviceId } from '@/features/device/services/device-storage';
import { queueMutation } from '@/features/replication/services/mutation-queue';
import { log } from "@/shared/lib/logging/logger";

/**
 * Query function for fetching device
 * RxDB-only approach: reads from local cache only
 * Note: Caller should trigger pull replication before calling this if cache might be empty.
 * Does NOT auto-register - user must provide nickname via onboarding
 * @returns Device or null
 */
export async function fetchDevice(): Promise<Device | null> {
  // Check if we have a token first - if not, don't try to fetch
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    // No token means device not registered yet - return null to trigger onboarding
    return null;
  }

  const deviceId = getOrCreateDeviceId();
  
  // RxDB-only: Read from cache (synced via replication)
  const db = await getDatabase();
  const cached = await db.devices.findOne(deviceId).exec();
  
  if (cached) {
    const device = cached.toJSON() as Device;
    return device;
  }
  
  // Device not in RxDB - return null
  // Caller should trigger pull replication to fetch from server
  // This ensures all data flows through RxDB, not direct API calls
  return null;
}

/**
 * Mutation function for device registration
 * @param request - Device creation request
 * @returns Device and token
 */
export async function registerDeviceMutation(
  request?: DeviceCreateRequest
): Promise<{ device: Device; token: string }> {
  log.info('Device registration mutation starting', { request });
  const deviceId = getOrCreateDeviceId();
  setDeviceId(deviceId);
  log.debug('Device ID retrieved', { deviceId });

  log.info('Registering device', { deviceId, nickname: request?.nickname });

  // Register with server
  log.debug('Calling device registration API', {
    endpoint: '/device/register',
    payload: { id: deviceId, ...request }
  });
  
  try {
    const response = await post<{ device: Device; token: string }>('/device/register', {
      id: deviceId,
      ...request,
    });

    log.info('Device registration API response received', {
      deviceId: response.device.id,
      hasToken: !!response.token
    });

    // Store token
    if (response.token) {
      setToken(response.token);
      log.info('JWT token stored in localStorage');
    } else {
      log.warn('No token in device registration response');
    }

    // Store device in RxDB
    try {
      const db = await getDatabase();
      await db.devices.upsert(response.device);
      log.info('Device stored in RxDB');
    } catch (dbErr) {
      // Log RxDB errors but don't fail registration if device is already registered on server
      // The device is already registered successfully, RxDB error is non-critical
      log.warn('RxDB error during device storage (non-critical)', dbErr);
      // Continue - device is already registered on server
    }

    log.debug('Device registration mutation completed successfully');
    return response;
  } catch (error) {
    log.error('Device registration API call failed', error);
    throw error;
  }
}

/**
 * Mutation function for updating device nickname
 * Supports offline-first: queues mutation when offline, calls API when online
 * @param nickname - New nickname (1-50 characters)
 * @returns Updated device (optimistic when offline)
 */
export async function updateDeviceNickname(nickname: string): Promise<Device> {
  const deviceId = getOrCreateDeviceId();
  const db = await getDatabase();

  // Get existing device for optimistic update
  const existingDevice = await db.devices.findOne(deviceId).exec();
  if (!existingDevice) {
    throw new Error('Device not found');
  }

  const existing = existingDevice.toJSON() as Device;
  const now = new Date().toISOString();

  // Create optimistic update in RxDB immediately
  const optimisticDevice: Device = {
    ...existing,
    nickname,
    updated_at: now,
  };

  // Store optimistic update in RxDB
  await db.devices.upsert(optimisticDevice);

  // Queue mutation for sync (replication mechanism handles API call)
  // No direct API call - replication sync will push mutation to server
  await queueMutation(
    'update_nickname',
    'devices',
    {
      nickname,
    },
    deviceId
  );
  
  // Return optimistic update
  return optimisticDevice;
}

/**
 * Updates device nickname (legacy function for backward compatibility)
 * @param nickname - New nickname (1-50 characters)
 * @returns Updated device
 */
export async function updateNickname(nickname: string): Promise<void> {
  await updateDeviceNickname(nickname);
}

/**
 * Gets current device (legacy function for backward compatibility)
 * @returns Device or null
 */
export async function getDevice(): Promise<Device | null> {
  return fetchDevice();
}

