/**
 * useDebouncedLocation Hook
 * Debounces location updates to prevent unnecessary refetches
 * Only updates if location change is significant (>50m) or after debounce delay (500ms)
 * Single Responsibility: Location debouncing logic
 */

import { useState, useEffect, useRef } from 'react';
import type { Location } from './useLocation';
import { calculateDistance } from "@/shared/domain/group";

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
  const prevDebouncedRef = useRef<Location | null>(location);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!location) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDebouncedLocation(null);
      prevDebouncedRef.current = null;
      return;
    }

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Calculate distance from previous debounced location (using ref to avoid dependency)
    const prevDebounced = prevDebouncedRef.current;
    const distance = prevDebounced
      ? calculateDistance(
          location.latitude,
          location.longitude,
          prevDebounced.latitude,
          prevDebounced.longitude
        )
      : Infinity;

    // Only update if distance > threshold or no previous location
    if (distance > minDistanceMeters || !prevDebounced) {
      timerRef.current = setTimeout(() => {
        setDebouncedLocation(location);
        prevDebouncedRef.current = location;
      }, debounceMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [location, debounceMs, minDistanceMeters]);

  return { debouncedLocation };
}
