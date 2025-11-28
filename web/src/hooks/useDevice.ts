/**
 * Device registration hook
 * Handles device registration and token management using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest } from '../domain/device';
import { getOrCreateDeviceId } from '../services/device-storage';
import {
  fetchDevice,
  registerDeviceMutation,
  updateDeviceNickname,
} from '../services/device-service';

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
 * Uses TanStack Query for automatic request deduplication, caching, and retry
 * @param enabled - Whether to enable the device query (default: true)
 * @returns Device state and registration functions
 */
export function useDevice(enabled: boolean = true): UseDeviceReturn {
  const queryClient = useQueryClient();
  
  // Only get/create device ID if enabled
  // This prevents creating device ID before user completes onboarding
  const deviceId = enabled ? getOrCreateDeviceId() : null;

  // Query for device data (reads from RxDB first, then API)
  // Only enabled if explicitly enabled AND we have a device ID
  const {
    data: device,
    isLoading,
    error: queryError,
    refetch: refreshDevice,
  } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: fetchDevice,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    // Only fetch if enabled AND device ID exists
    enabled: enabled && !!deviceId,
  });

  // Mutation for device registration with optimistic updates
  const registerMutation = useMutation({
    mutationFn: registerDeviceMutation,
    // Optimistic update: immediately update UI before server responds
    onMutate: async (variables) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['device', deviceId] });

      // Snapshot previous value
      const previousDevice = queryClient.getQueryData<Device | null>(['device', deviceId]);

      // Optimistically update cache (if we have device ID and nickname)
      // Only if nickname is provided (required for registration)
      if (deviceId && variables?.nickname) {
        const optimisticDevice: Device = {
          id: deviceId,
          nickname: variables.nickname,
          public_key: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData(['device', deviceId], optimisticDevice);
      }

      return { previousDevice };
    },
    onSuccess: (data) => {
      // Update with server response and invalidate related queries
      queryClient.setQueryData(['device', data.device.id], data.device);
      queryClient.invalidateQueries({ queryKey: ['device'] });
      // Refetch device to ensure UI is updated
      queryClient.refetchQueries({ queryKey: ['device', data.device.id] });
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousDevice !== undefined) {
        queryClient.setQueryData(['device', deviceId], context.previousDevice);
      }
      console.error('Failed to register device:', err);
    },
  });

  // Mutation for device update with optimistic updates
  const updateMutation = useMutation({
    mutationFn: async (request: DeviceUpdateRequest) => {
      if (!device) {
        throw new Error('Thiết bị chưa được đăng ký');
      }
      return updateDeviceNickname(request.nickname);
    },
    // Optimistic update
    onMutate: async (request) => {
      if (!device) return { previousDevice: null };

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['device', device.id] });

      // Snapshot previous value
      const previousDevice = queryClient.getQueryData<Device | null>(['device', device.id]);

      // Optimistically update cache
      const optimisticDevice: Device = {
        ...device,
        nickname: request.nickname,
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData(['device', device.id], optimisticDevice);

      return { previousDevice };
    },
    onSuccess: (updatedDevice) => {
      // Update with server response
      queryClient.setQueryData(['device', updatedDevice.id], updatedDevice);
      queryClient.invalidateQueries({ queryKey: ['device'] });
    },
    onError: (err, _request, context) => {
      // Rollback on error
      if (context?.previousDevice !== undefined && device) {
        queryClient.setQueryData(['device', device.id], context.previousDevice);
      }
      console.error('Failed to update device:', err);
    },
  });

  // Register device (triggers mutation)
  const registerDevice = async (request?: DeviceCreateRequest) => {
    await registerMutation.mutateAsync(request);
  };

  // Update device (triggers mutation)
  const updateDevice = async (request: DeviceUpdateRequest) => {
    await updateMutation.mutateAsync(request);
  };

  // Refresh device (refetches query)
  const handleRefreshDevice = async () => {
    await refreshDevice();
  };

  // Determine loading state
  const loading = isLoading || registerMutation.isPending || updateMutation.isPending;

  // Determine error state
  const error =
    queryError instanceof Error
      ? queryError.message
      : registerMutation.error instanceof Error
        ? registerMutation.error.message
        : updateMutation.error instanceof Error
          ? updateMutation.error.message
          : null;

  return {
    device: device || null,
    loading,
    error,
    registerDevice,
    updateDevice,
    refreshDevice: handleRefreshDevice,
  };
}

