/**
 * Device ID persistence service
 * Stores device ID in a way that survives app reinstall
 * Uses localStorage with fallback to sessionStorage
 */

import { generateId } from '../utils/id';

const DEVICE_ID_KEY = 'nearby_msg_device_id';
const DEVICE_ID_KEY_FALLBACK = 'nearby_msg_device_id_fallback';

/**
 * Gets the stored device ID
 * @returns Device ID or null
 */
export function getDeviceId(): string | null {
  // Try localStorage first (persists across sessions)
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    return stored;
  }

  // Fallback to sessionStorage (survives page refresh but not uninstall)
  const fallback = sessionStorage.getItem(DEVICE_ID_KEY_FALLBACK);
  if (fallback) {
    // Try to promote to localStorage
    try {
      localStorage.setItem(DEVICE_ID_KEY, fallback);
      return fallback;
    } catch {
      // If localStorage is unavailable, return sessionStorage value
      return fallback;
    }
  }

  return null;
}

/**
 * Sets the device ID
 * @param deviceId - Device ID to store
 */
export function setDeviceId(deviceId: string): void {
  try {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    sessionStorage.setItem(DEVICE_ID_KEY_FALLBACK, deviceId);
  } catch (error) {
    // If localStorage fails, try sessionStorage
    try {
      sessionStorage.setItem(DEVICE_ID_KEY_FALLBACK, deviceId);
    } catch {
      console.error('Failed to store device ID:', error);
    }
  }
}

/**
 * Removes the stored device ID
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
  sessionStorage.removeItem(DEVICE_ID_KEY_FALLBACK);
}

/**
 * Generates a new device ID (UUID v4)
 * @returns New device ID
 */
export function generateDeviceId(): string {
  return generateId();
}

/**
 * Gets or generates a device ID
 * @returns Device ID (existing or newly generated)
 */
export function getOrCreateDeviceId(): string {
  let deviceId = getDeviceId();
  if (!deviceId) {
    deviceId = generateDeviceId();
    setDeviceId(deviceId);
  }
  return deviceId;
}

