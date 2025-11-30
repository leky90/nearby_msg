import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserStatus } from '@/domain/user_status';
import type { RadiusOption } from '@/domain/group';
import type { NetworkStatus } from '@/services/network-status';
import type { GPSStatus } from '@/services/device-status';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  address?: string;
  updatedAt?: string;
}

interface AppState {
  // Network status
  networkStatus: NetworkStatus;
  
  // User status
  userStatus: UserStatus | null;
  
  // Radius filter
  selectedRadius: RadiusOption;
  
  // Device location (shared across app)
  deviceLocation: DeviceLocation | null;
  
  // GPS permission status (cached to avoid repeated checks)
  gpsStatus: GPSStatus | null;
}

const initialState: AppState = {
  networkStatus: 'online',
  userStatus: null,
  selectedRadius: 500,
  deviceLocation: null,
  gpsStatus: null,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setNetworkStatus: (state, action: PayloadAction<NetworkStatus>) => {
      state.networkStatus = action.payload;
    },
    setUserStatus: (state, action: PayloadAction<UserStatus | null>) => {
      state.userStatus = action.payload;
    },
    setSelectedRadius: (state, action: PayloadAction<RadiusOption>) => {
      state.selectedRadius = action.payload;
    },
    setDeviceLocation: (state, action: PayloadAction<DeviceLocation | null>) => {
      state.deviceLocation = action.payload;
    },
    updateDeviceLocationAddress: (state, action: PayloadAction<string>) => {
      if (state.deviceLocation) {
        state.deviceLocation.address = action.payload;
      }
    },
    setGPSStatus: (state, action: PayloadAction<GPSStatus | null>) => {
      state.gpsStatus = action.payload;
    },
  },
});

export const {
  setNetworkStatus,
  setUserStatus,
  setSelectedRadius,
  setDeviceLocation,
  updateDeviceLocationAddress,
  setGPSStatus,
} = appSlice.actions;

// Selectors
export const selectNetworkStatus = (state: { app: AppState }) => state.app.networkStatus;
export const selectUserStatus = (state: { app: AppState }) => state.app.userStatus;
export const selectSelectedRadius = (state: { app: AppState }) => state.app.selectedRadius;
export const selectDeviceLocation = (state: { app: AppState }) => state.app.deviceLocation;
export const selectGPSStatus = (state: { app: AppState }) => state.app.gpsStatus;

export default appSlice.reducer;
