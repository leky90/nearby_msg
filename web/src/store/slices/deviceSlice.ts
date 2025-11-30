import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { Device } from '@/domain/device';

interface DeviceState {
  device: Device | null;
  isLoading: boolean;
  error: string | null;
  isRegistered: boolean;
  jwtToken: string | null;
}

const initialState: DeviceState = {
  device: null,
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
      state.device = null;
      state.isRegistered = false;
      state.jwtToken = null;
      state.error = null;
    },
  },
});

export const {
  setDevice,
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

export default deviceSlice.reducer;
