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
    updateUserStatusOptimistic: (
      state,
      action: PayloadAction<{ statusType: string; description?: string }>
    ) => {
      // Optimistic update - update UI immediately before API call completes
      if (state.userStatus) {
        state.userStatus = {
          ...state.userStatus,
          status_type: action.payload.statusType as UserStatus['status_type'],
          description: action.payload.description,
          updated_at: new Date().toISOString(),
        };
      } else {
        // Create new status if none exists
        const deviceId = localStorage.getItem('device_id') || '';
        state.userStatus = {
          id: '',
          device_id: deviceId,
          status_type: action.payload.statusType as UserStatus['status_type'],
          description: action.payload.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
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
  updateUserStatusOptimistic,
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
