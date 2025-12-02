import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { Device } from "@/shared/domain/device";
import { log } from "@/shared/lib/logging/logger";

interface DeviceState {
  device: Device | null; // Current device
  devicesById: Record<string, Device>; // Devices by ID (for message bubbles, etc.)
  isLoading: boolean;
  error: string | null;
  isRegistered: boolean;
  jwtToken: string | null;
}

const initialState: DeviceState = {
  device: null,
  devicesById: {},
  isLoading: false,
  error: null,
  isRegistered: false,
  jwtToken: null,
};

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setDevice: (state, action: PayloadAction<Device | null>) => {
      state.device = action.payload;
      state.isRegistered = action.payload !== null;
      // Also store in devicesById for consistency
      if (action.payload) {
        // Ensure devicesById exists (handles Redux Persist rehydration)
        if (!state.devicesById) {
          state.devicesById = {};
        }
        state.devicesById[action.payload.id] = action.payload;
      }
    },
    setDeviceById: (state, action: PayloadAction<Device>) => {
      // Ensure devicesById exists (handles Redux Persist rehydration)
      if (!state.devicesById) {
        state.devicesById = {};
      }
      state.devicesById[action.payload.id] = action.payload;
    },
    setDevicesById: (state, action: PayloadAction<Device[]>) => {
      // Ensure devicesById exists (handles Redux Persist rehydration)
      if (!state.devicesById) {
        state.devicesById = {};
      }
      for (const device of action.payload) {
        state.devicesById[device.id] = device;
      }
    },
    setDeviceLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setDeviceError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setJWTToken: (state, action: PayloadAction<string | null>) => {
      state.jwtToken = action.payload;
    },
    clearDevice: (state) => {
      log.info('[CLEAR_DEVICE_REDUCER] Clearing device state in Redux', {
        hadDevice: !!state.device,
        deviceId: state.device?.id,
        wasRegistered: state.isRegistered,
        hadToken: !!state.jwtToken,
      });
      state.device = null;
      state.isRegistered = false;
      state.jwtToken = null;
      state.error = null;
      log.info('[CLEAR_DEVICE_REDUCER] Device state cleared in Redux');
    },
  },
});

export const {
  setDevice,
  setDeviceById,
  setDevicesById,
  setDeviceLoading,
  setDeviceError,
  setJWTToken,
  clearDevice,
} = deviceSlice.actions;

// Base selector
const selectDeviceState = (state: { device: DeviceState }) => state.device;

// Optimized selectors using createSelector
export const selectDevice = createSelector(
  [selectDeviceState],
  (device) => device.device
);

export const selectDeviceLoading = createSelector(
  [selectDeviceState],
  (device) => device.isLoading
);

export const selectDeviceError = createSelector(
  [selectDeviceState],
  (device) => device.error
);

export const selectIsRegistered = createSelector(
  [selectDeviceState],
  (device) => device.isRegistered
);

export const selectJWTToken = createSelector(
  [selectDeviceState],
  (device) => device.jwtToken
);

export const selectDeviceInfo = createSelector(
  [selectDeviceState],
  (device) => ({
    device: device.device,
    isLoading: device.isLoading,
    error: device.error,
    isRegistered: device.isRegistered,
    hasToken: !!device.jwtToken,
  })
);

export const selectDeviceById = createSelector(
  [selectDeviceState, (_state: { device: DeviceState }, deviceId: string) => deviceId],
  (device, deviceId) => device.devicesById[deviceId] || null
);

export const selectDevicesByIds = createSelector(
  [selectDeviceState, (_state: { device: DeviceState }, deviceIds: string[]) => deviceIds],
  (device, deviceIds) => {
    if (deviceIds.length === 0) return [];
    return deviceIds.map((id) => device.devicesById[id] || null).filter(Boolean) as Device[];
  }
);

export default deviceSlice.reducer;
