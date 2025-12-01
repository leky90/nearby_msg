/**
 * useLocation Hook
 * Manages user location from app store or GPS
 * Single Responsibility: Location management only
 */

import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectDeviceLocation } from "@/features/navigation/store/appSlice";
import { fetchGPSLocationAction } from '@/features/groups/store/locationSaga';
import type { RootState } from '@/store';

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
  const dispatch = useDispatch();
  const deviceLocation = useSelector((state: RootState) => selectDeviceLocation(state));

  // Fetch GPS location if not in store
  useEffect(() => {
    if (!deviceLocation) {
      dispatch(fetchGPSLocationAction());
    }
  }, [deviceLocation, dispatch]);

  // Prefer deviceLocation from store
  const location: Location | null = deviceLocation
    ? {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        accuracy: undefined,
        timestamp: deviceLocation.updatedAt
          ? new Date(deviceLocation.updatedAt).getTime()
          : Date.now(),
      }
    : null;

  return {
    location,
    isLoading: !deviceLocation, // Loading if no location in store
    error: null, // Error handling is done in Redux state if needed
    refetch: () => {
      dispatch(fetchGPSLocationAction());
    },
  };
}
