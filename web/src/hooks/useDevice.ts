/**
 * Device registration hook
 * Handles device registration and token management using Redux
 */

import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest } from '../domain/device';
import { getOrCreateDeviceId } from '../services/device-storage';
import {
    fetchDevice
} from '../services/device-service';
import {
    selectDevice,
    selectDeviceLoading,
    selectDeviceError,
} from '../store/slices/deviceSlice';
import {
    fetchDeviceAction,
    registerDeviceAction,
    updateDeviceAction,
} from '../store/sagas/deviceSaga';
import type { RootState } from '../store';

export interface UseDeviceReturn {
  device: Device | null;
  loading: boolean;
  error: string | null;
  registerDevice: (request?: DeviceCreateRequest) => Promise<void>;
  updateDevice: (request: DeviceUpdateRequest) => Promise<void>;
  refreshDevice: () => Promise<void>;
}

/**
 * Hook for device registration and management
 * Uses Redux for state management and TanStack Query for caching
 * @param enabled - Whether to enable the device query (default: true)
 * @returns Device state and registration functions
 */
export function useDevice(enabled: boolean = true): UseDeviceReturn {
  const dispatch = useDispatch();
  
  // Redux selectors
  const device = useSelector((state: RootState) => selectDevice(state));
  const isLoading = useSelector((state: RootState) => selectDeviceLoading(state));
  const error = useSelector((state: RootState) => selectDeviceError(state));
  
  // Only get/create device ID if enabled
  // This prevents creating device ID before user completes onboarding
  const deviceId = enabled ? getOrCreateDeviceId() : null;

  // Query for device data (reads from RxDB first, then API)
  // Only enabled if explicitly enabled AND we have a device ID
  // This is kept for backward compatibility and caching
  const {
    data: queryDevice,
    refetch: refreshDevice,
  } = useQuery<Device | null>({
    queryKey: ['device', deviceId],
    queryFn: fetchDevice,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    // Only fetch if enabled AND device ID exists
    enabled: enabled && !!deviceId,
  });

  // Sync query result to Redux
  useEffect(() => {
    if (queryDevice) {
      dispatch({ type: 'device/setDevice', payload: queryDevice });
    }
  }, [queryDevice, dispatch]);
  
  // Use Redux device if available, otherwise fall back to query device
  const currentDevice: Device | null = device || (queryDevice ?? null);

  // Register device (dispatches Redux action)
  const registerDevice = async (request?: DeviceCreateRequest) => {
    dispatch(registerDeviceAction(request));
  };

  // Update device (dispatches Redux action)
  const updateDevice = async (request: DeviceUpdateRequest) => {
    if (!currentDevice) {
      throw new Error('Thiết bị chưa được đăng ký');
    }
    dispatch(updateDeviceAction(request));
  };

  // Refresh device (dispatches Redux action and refetches query)
  const handleRefreshDevice = async () => {
    dispatch(fetchDeviceAction());
    await refreshDevice();
  };

  return {
    device: currentDevice,
    loading: isLoading,
    error: error || null,
    registerDevice,
    updateDevice,
    refreshDevice: handleRefreshDevice,
  };
}

