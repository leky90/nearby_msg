/**
 * Device Status Service
 * Handles battery and GPS status monitoring
 */

import { log } from "@/shared/lib/logging/logger";

export interface BatteryStatus {
  level: number; // 0-1
  charging: boolean;
  available: boolean;
}

export type GPSStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

// Battery API interface (not fully typed in TypeScript)
interface BatteryManager {
  level: number;
  charging: boolean;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
  battery?: BatteryManager;
}

/**
 * Gets battery status
 * @returns Battery status or null if unavailable
 */
export async function getBatteryStatus(): Promise<BatteryStatus | null> {
  // Check if Battery API is available
  const nav = navigator as NavigatorWithBattery;
  if (
    typeof navigator !== 'undefined' &&
    'getBattery' in navigator &&
    typeof nav.getBattery === 'function'
  ) {
    try {
      const battery = await nav.getBattery();
      return {
        level: battery.level,
        charging: battery.charging,
        available: true,
      };
    } catch (error) {
      log.warn('Failed to get battery status', error);
      return null;
    }
  }

  // Fallback: check if battery API exists but might be on different object
  if (
    typeof navigator !== 'undefined' &&
    'battery' in navigator &&
    nav.battery
  ) {
    try {
      const battery = nav.battery;
      return {
        level: battery.level,
        charging: battery.charging,
        available: true,
      };
    } catch (error) {
      log.warn('Failed to get battery status', error);
      return null;
    }
  }

  return null;
}

/**
 * Gets GPS permission status
 * @returns GPS status
 */
export async function getGPSStatus(): Promise<GPSStatus> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unavailable';
  }

  // Check permission status using Permissions API
  if ('permissions' in navigator && navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as GPSStatus;
    } catch {
      // Permissions API might not support geolocation or might fail
      // Fallback: try to get location (will fail if denied)
      return 'prompt';
    }
  }

  // Fallback: assume prompt if Permissions API not available
  return 'prompt';
}

/**
 * Subscribes to battery status changes
 * @param callback - Callback function called when battery status changes
 * @returns Cleanup function
 */
export function subscribeToBatteryStatus(
  callback: (status: BatteryStatus | null) => void
): () => void {
  let battery: BatteryManager | null = null;
  let isSubscribed = true;

  const updateBattery = async () => {
    if (!isSubscribed) return;

    const status = await getBatteryStatus();
    if (status && status.available) {
      callback(status);
    } else {
      callback(null);
    }
  };

  // Initial check
  updateBattery();

  // Try to subscribe to battery events
  const nav = navigator as NavigatorWithBattery;
  if (
    typeof navigator !== 'undefined' &&
    'getBattery' in navigator &&
    typeof nav.getBattery === 'function'
  ) {
    nav.getBattery()
      .then((b: BatteryManager) => {
        if (!isSubscribed) return;
        battery = b;

        const handleChange = () => {
          if (isSubscribed && battery) {
            callback({
              level: battery.level,
              charging: battery.charging,
              available: true,
            });
          }
        };

        battery.addEventListener('chargingchange', handleChange);
        battery.addEventListener('levelchange', handleChange);

        // Return cleanup
        return () => {
          isSubscribed = false;
          if (battery) {
            battery.removeEventListener('chargingchange', handleChange);
            battery.removeEventListener('levelchange', handleChange);
          }
        };
      })
      .catch(() => {
        // Battery API not available, just return cleanup
      });
  }

  // Return cleanup function
  return () => {
    isSubscribed = false;
  };
}

/**
 * Subscribes to GPS status changes
 * @param callback - Callback function called when GPS status changes
 * @returns Cleanup function
 */
export function subscribeToGPSStatus(
  callback: (status: GPSStatus) => void
): () => void {
  let isSubscribed = true;

  const updateGPS = async () => {
    if (!isSubscribed) return;
    const status = await getGPSStatus();
    callback(status);
  };

  // Initial check
  updateGPS();

  // Poll for changes (Permissions API doesn't always fire events)
  const interval = setInterval(() => {
    if (isSubscribed) {
      updateGPS();
    }
  }, 5000); // Check every 5 seconds

  return () => {
    isSubscribed = false;
    clearInterval(interval);
  };
}

