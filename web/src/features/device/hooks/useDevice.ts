/**
 * Device registration hook
 * Handles device registration and token management using Redux
 */

import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest } from "@/shared/domain/device";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import {
    selectDevice,
    selectDeviceLoading,
    selectDeviceError,
} from "@/features/device/store/slice";
import {
    fetchDeviceAction,
    registerDeviceAction,
    updateDeviceAction,
} from "@/features/device/store/saga";
import type { RootState } from '@/store';

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
 * Uses Redux for state management
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

  // Fetch device data using Redux Saga when enabled and device ID exists
  useEffect(() => {
    if (enabled && deviceId) {
      dispatch(fetchDeviceAction());
    }
  }, [enabled, deviceId, dispatch]);

  // Register device (dispatches Redux action)
  const registerDevice = async (request?: DeviceCreateRequest) => {
    dispatch(registerDeviceAction(request));
  };

  // Update device (dispatches Redux action)
  const updateDevice = async (request: DeviceUpdateRequest) => {
    if (!device) {
      throw new Error('Thiết bị chưa được đăng ký');
    }
    dispatch(updateDeviceAction(request));
  };

  // Refresh device (dispatches Redux action)
  const handleRefreshDevice = async () => {
    dispatch(fetchDeviceAction());
  };

  return {
    device: device,
    loading: isLoading,
    error: error || null,
    registerDevice,
    updateDevice,
    refreshDevice: handleRefreshDevice,
  };
}

