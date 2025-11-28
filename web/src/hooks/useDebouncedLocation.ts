/**
 * useDebouncedLocation Hook
 * Debounces location updates to prevent unnecessary refetches
 * Only updates if location change is significant (>50m) or after debounce delay (500ms)
 * Single Responsibility: Location debouncing logic
 */

import { useState, useEffect } from 'react';
import type { Location } from './useLocation';
import { calculateDistance } from '@/domain/group';

export interface UseDebouncedLocationOptions {
  /** Current location */
  location: Location | null;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Minimum distance change in meters to trigger update */
  minDistanceMeters?: number;
}

export interface UseDebouncedLocationResult {
  /** Debounced location */
  debouncedLocation: Location | null;
}

/**
 * useDebouncedLocation hook
 * Debounces location updates to prevent unnecessary refetches for small movements
 */
export function useDebouncedLocation({
  location,
  debounceMs = 500,
  minDistanceMeters = 50,
}: UseDebouncedLocationOptions): UseDebouncedLocationResult {
  const [debouncedLocation, setDebouncedLocation] = useState<Location | null>(location);

  useEffect(() => {
    if (!location) {
      setDebouncedLocation(null);
      return;
    }

    // Calculate distance from previous debounced location
    const distance = debouncedLocation
      ? calculateDistance(
          location.latitude,
          location.longitude,
          debouncedLocation.latitude,
          debouncedLocation.longitude
        )
      : Infinity;

    // Only update if distance > threshold or no previous location
    if (distance > minDistanceMeters || !debouncedLocation) {
      const timer = setTimeout(() => {
        setDebouncedLocation(location);
      }, debounceMs);

      return () => clearTimeout(timer);
    }
  }, [location, debouncedLocation, debounceMs, minDistanceMeters]);

  return { debouncedLocation };
}
