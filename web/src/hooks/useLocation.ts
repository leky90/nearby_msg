/**
 * useLocation Hook
 * Manages user location from app store or GPS
 * Single Responsibility: Location management only
 */

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { getCurrentLocation } from '@/services/location-service';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface UseLocationResult {
  /** Current location */
  location: Location | null;
  /** Whether location is loading */
  isLoading: boolean;
  /** Location error if any */
  error: Error | null;
  /** Refetch location */
  refetch: () => void;
}

/**
 * useLocation hook
 * Provides user location from app store (preferred) or GPS (fallback)
 */
export function useLocation(): UseLocationResult {
  const { deviceLocation } = useAppStore();

  // Get GPS location if not in store
  const {
    data: gpsLocation,
    isLoading: isLoadingGPS,
    error: gpsError,
    refetch: refetchGPS,
  } = useQuery({
    queryKey: ['location'],
    queryFn: getCurrentLocation,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: !deviceLocation, // Only fetch if no location in store
  });

  // Prefer deviceLocation from store, fallback to GPS
  const location: Location | null = deviceLocation
    ? {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        accuracy: undefined,
        timestamp: deviceLocation.updatedAt
          ? new Date(deviceLocation.updatedAt).getTime()
          : Date.now(),
      }
    : gpsLocation
      ? {
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          accuracy: gpsLocation.accuracy,
          timestamp: gpsLocation.timestamp,
        }
      : null;

  return {
    location,
    isLoading: !deviceLocation && isLoadingGPS,
    error: gpsError ? (gpsError as Error) : null,
    refetch: refetchGPS,
  };
}
