/**
 * Location Service
 * Handles geolocation API and manual location entry
 */

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number; // in meters
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
}

/**
 * Gets current location using Geolocation API
 * @returns Promise resolving to location or null if unavailable
 */
export async function getCurrentLocation(): Promise<Location | null> {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // Cache for 1 minute
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        // Return null on error (degraded mode)
        console.warn('Geolocation error:', error);
        resolve(null);
      },
      options
    );
  });
}

/**
 * Watches location changes
 * @param callback - Callback function called when location changes
 * @returns Watch ID that can be used to stop watching
 */
export function watchLocation(
  callback: (location: Location | null) => void
): number | null {
  if (!navigator.geolocation) {
    callback(null);
    return null;
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
  };

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      console.warn('Geolocation watch error:', error);
      callback(null);
    },
    options
  );
}

/**
 * Stops watching location
 * @param watchId - Watch ID returned from watchLocation
 */
export function clearWatch(watchId: number): void {
  if (navigator.geolocation && watchId) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Validates manual location entry
 * @param latitude - Latitude value
 * @param longitude - Longitude value
 * @returns Error message if invalid, null if valid
 */
export function validateManualLocation(
  latitude: number,
  longitude: number
): string | null {
  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    return 'Latitude must be between -90 and 90';
  }
  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    return 'Longitude must be between -180 and 180';
  }
  return null;
}

/**
 * Checks if geolocation is available
 * @returns True if geolocation API is available
 */
export function isGeolocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

