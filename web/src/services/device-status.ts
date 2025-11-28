/**
 * Device Status Service
 * Handles battery and GPS status monitoring
 */

export interface BatteryStatus {
  level: number; // 0-1
  charging: boolean;
  available: boolean;
}

export type GPSStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

/**
 * Gets battery status
 * @returns Battery status or null if unavailable
 */
export async function getBatteryStatus(): Promise<BatteryStatus | null> {
  // Check if Battery API is available
  if (
    typeof navigator !== 'undefined' &&
    'getBattery' in navigator &&
    typeof (navigator as any).getBattery === 'function'
  ) {
    try {
      const battery = await (navigator as any).getBattery();
      return {
        level: battery.level,
        charging: battery.charging,
        available: true,
      };
    } catch (error) {
      console.warn('Failed to get battery status:', error);
      return null;
    }
  }

  // Fallback: check if battery API exists but might be on different object
  if (
    typeof navigator !== 'undefined' &&
    'battery' in navigator &&
    (navigator as any).battery
  ) {
    try {
      const battery = (navigator as any).battery;
      return {
        level: battery.level,
        charging: battery.charging,
        available: true,
      };
    } catch (error) {
      console.warn('Failed to get battery status:', error);
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
    } catch (error) {
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
  let battery: any = null;
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
  if (
    typeof navigator !== 'undefined' &&
    'getBattery' in navigator &&
    typeof (navigator as any).getBattery === 'function'
  ) {
    (navigator as any)
      .getBattery()
      .then((b: any) => {
        if (!isSubscribed) return;
        battery = b;

        const handleChange = () => {
          if (isSubscribed) {
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

