/**
 * Device Service
 * Handles device-related operations
 * Query functions for TanStack Query integration
 */

import type { Device, DeviceCreateRequest } from '../domain/device';
import { get, post, setToken } from './api';
import { clearAllUserData } from './data-clear';
import { getDatabase } from './db';
import { getOrCreateDeviceId, setDeviceId } from './device-storage';
import { queueMutation } from './mutation-queue';
import { log } from '../lib/logging/logger';

/**
 * Query function for fetching device
 * Reads from RxDB first, then falls back to API if not found
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
  
  // Try RxDB first (instant, offline support)
  try {
    const db = await getDatabase();
    const cached = await db.devices.findOne(deviceId).exec();
    if (cached) {
      const device = cached.toJSON() as Device;
      // Verify token exists - if not, device might need re-registration
      if (token) {
        return device;
      }
      // Token missing but device cached - might need re-registration
      // Continue to API check
    }
  } catch {
    // RxDB not available, continue to API
  }

  // Fallback to API if not in cache
  try {
    const response = await get<Device>(`/device?id=${deviceId}`);
    
    // Store in RxDB for next time
    if (response) {
      const db = await getDatabase();
      await db.devices.upsert(response);
    }
    
    return response;
  } catch (err) {
    // If 404 (device not found), clear all user data
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      (err as { status: number }).status === 404
    ) {
      // Clear all user data (RxDB, localStorage, sessionStorage)
      try {
        await clearAllUserData();
      } catch {
        // Ignore errors when clearing data
      }
      
      // Device not found - return null to trigger onboarding
      return null;
    }
    
    // If 401 (unauthorized), device needs registration
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      (err as { status: number }).status === 401
    ) {
      // Device not registered - return null to trigger onboarding
      return null;
    }
    
    // Other errors - return null
    return null;
  }
}

/**
 * Mutation function for device registration
 * @param request - Device creation request
 * @returns Device and token
 */
export async function registerDeviceMutation(
  request?: DeviceCreateRequest
): Promise<{ device: Device; token: string }> {
  const deviceId = getOrCreateDeviceId();
  setDeviceId(deviceId);

  // Register with server
  const response = await post<{ device: Device; token: string }>('/device/register', {
    id: deviceId,
    ...request,
  });

  // Store token
  if (response.token) {
    setToken(response.token);
  }

  // Store device in RxDB
  try {
    const db = await getDatabase();
    await db.devices.upsert(response.device);
  } catch (dbErr) {
    // Log RxDB errors but don't fail registration if device is already registered on server
    // The device is already registered successfully, RxDB error is non-critical
    log.warn('Failed to store device in RxDB (non-critical)', dbErr);
    // Continue - device is already registered on server
  }

  return response;
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

