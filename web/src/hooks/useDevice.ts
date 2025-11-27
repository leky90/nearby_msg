/**
 * Device registration hook
 * Handles device registration and token management
 */

import { useState, useEffect, useCallback } from 'react';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest } from '../domain/device';
import { getOrCreateDeviceId, setDeviceId } from '../services/device-storage';
import { post, patch, setToken } from '../services/api';
import { getDatabase } from '../services/db';

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
 * @returns Device state and registration functions
 */
export function useDevice(): UseDeviceReturn {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Registers a device with the server
   */
  const registerDevice = useCallback(async (request?: DeviceCreateRequest) => {
    try {
      setLoading(true);
      setError(null);

      // Get or create device ID
      const deviceId = getOrCreateDeviceId();
      setDeviceId(deviceId);

      // Register with server
      const response = await post<{ device: Device; token: string }>('/device/register', {
        id: deviceId,
        ...request,
      });

      // Store token
      if (response.token) {
        setToken(response.token);
      }

      // Store device in RxDB
      const db = await getDatabase();
      await db.devices.upsert(response.device);

      setDevice(response.device);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register device';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates device nickname
   */
  const updateDevice = useCallback(async (request: DeviceUpdateRequest) => {
    if (!device) {
      throw new Error('Device not registered');
    }

    try {
      setLoading(true);
      setError(null);

      await patch(`/device/${device.id}`, request);

      // Update local device
      const updatedDevice: Device = {
        ...device,
        nickname: request.nickname,
        updated_at: new Date().toISOString(),
      };

      // Update in RxDB
      const db = await getDatabase();
      await db.devices.upsert(updatedDevice);

      setDevice(updatedDevice);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update device';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [device]);

  /**
   * Refreshes device data from server
   */
  const refreshDevice = useCallback(async () => {
    if (!device) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/device?id=${device.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch device');
      }

      const updatedDevice: Device = await response.json();

      // Update in RxDB
      const db = await getDatabase();
      await db.devices.upsert(updatedDevice);

      setDevice(updatedDevice);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh device';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [device]);

  /**
   * Load device from RxDB on mount
   */
  useEffect(() => {
    let mounted = true;

    async function loadDevice() {
      try {
        const deviceId = getOrCreateDeviceId();
        const db = await getDatabase();

        // Try to load from RxDB
        const existingDevice = await db.devices.findOne(deviceId).exec();
        if (existingDevice && mounted) {
          setDevice(existingDevice.toJSON() as Device);
          setLoading(false);
          return;
        }

        // If not found, register new device
        if (mounted) {
          await registerDevice();
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load device';
          setError(errorMessage);
          setLoading(false);
        }
      }
    }

    loadDevice();

    return () => {
      mounted = false;
    };
  }, [registerDevice]);

  return {
    device,
    loading,
    error,
    registerDevice,
    updateDevice,
    refreshDevice,
  };
}

