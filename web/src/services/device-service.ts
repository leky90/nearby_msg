/**
 * Device Service
 * Handles device-related operations
 * Query functions for TanStack Query integration
 */

import type { Device, DeviceCreateRequest } from '../domain/device';
import { get, patch, post, setToken } from './api';
import { getDatabase } from './db';
import { getOrCreateDeviceId, setDeviceId } from './device-storage';

/**
 * Query function for fetching device
 * Reads from RxDB first, then falls back to API if not found
 * If device not found on server, automatically registers it
 * @returns Device or null
 */
export async function fetchDevice(): Promise<Device | null> {
  const deviceId = getOrCreateDeviceId();
  
  // Try RxDB first (instant, offline support)
  try {
    const db = await getDatabase();
    const cached = await db.devices.findOne(deviceId).exec();
    if (cached) {
      const device = cached.toJSON() as Device;
      // Verify token exists - if not, device might need re-registration
      const token = localStorage.getItem('jwt_token');
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
    // If 404 (device not found) or 401 (unauthorized), try auto-registration
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      ((err as { status: number }).status === 404 ||
        (err as { status: number }).status === 401)
    ) {
      // Device not registered on server - auto-register
      try {
        const registrationResponse = await registerDeviceMutation();
        return registrationResponse.device;
      } catch (regErr) {
        // Auto-registration failed, return null
        console.warn('Auto-registration failed:', regErr);
        return null;
      }
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
  const db = await getDatabase();
  await db.devices.upsert(response.device);

  return response;
}

/**
 * Mutation function for updating device nickname
 * @param nickname - New nickname (1-50 characters)
 * @returns Updated device
 */
export async function updateDeviceNickname(nickname: string): Promise<Device> {
  const deviceId = getOrCreateDeviceId();
  await patch<Device>(`/device?id=${deviceId}`, { nickname });

  // Update in RxDB
  const db = await getDatabase();
  const device = await db.devices.findOne(deviceId).exec();
  if (device) {
    const updated = {
      ...device.toJSON(),
      nickname,
      updated_at: new Date().toISOString(),
    } as Device;
    await db.devices.upsert(updated);
    return updated;
  }

  // If not in RxDB, fetch from API
  const apiDevice = await get<Device>(`/device?id=${deviceId}`);
  if (apiDevice) {
    await db.devices.upsert(apiDevice);
    return apiDevice;
  }

  throw new Error('Device not found');
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

