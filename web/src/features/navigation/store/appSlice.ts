import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserStatus } from "@/shared/domain/user_status";
import type { RadiusOption } from "@/shared/domain/group";
import type { NetworkStatus } from "@/shared/services/network-status";
import type { GPSStatus } from '@/features/device/services/device-status';
import { getDeviceId } from '@/features/device/services/device-storage';

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
  
  // App initialization state
  initialization: {
    status: 'idle' | 'checking' | 'loading' | 'ready' | 'error';
    onboardingRequired: boolean;
    deviceCheckComplete: boolean;
    servicesStarted: boolean;
    error: string | null;
  };
}

const initialState: AppState = {
  networkStatus: 'online',
  userStatus: null,
  selectedRadius: 500,
  deviceLocation: null,
  gpsStatus: null,
  initialization: {
    status: 'idle',
    onboardingRequired: false,
    deviceCheckComplete: false,
    servicesStarted: false,
    error: null,
  },
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
        const deviceId = getDeviceId() || '';
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
    // App initialization actions
    setInitializationStatus: (
      state,
      action: PayloadAction<{
        status: 'idle' | 'checking' | 'loading' | 'ready' | 'error';
        error?: string | null;
      }>
    ) => {
      state.initialization.status = action.payload.status;
      if (action.payload.error !== undefined) {
        state.initialization.error = action.payload.error;
      }
    },
    setOnboardingRequired: (state, action: PayloadAction<boolean>) => {
      state.initialization.onboardingRequired = action.payload;
    },
    setDeviceCheckComplete: (state, action: PayloadAction<boolean>) => {
      state.initialization.deviceCheckComplete = action.payload;
    },
    setServicesStarted: (state, action: PayloadAction<boolean>) => {
      state.initialization.servicesStarted = action.payload;
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
  setInitializationStatus,
  setOnboardingRequired,
  setDeviceCheckComplete,
  setServicesStarted,
} = appSlice.actions;

// Action creators for app initialization
export const initAppAction = () => ({ type: 'app/init' });
export const checkDeviceAction = () => ({ type: 'app/checkDevice' });
export const startServicesAction = () => ({ type: 'app/startServices' });
export const checkGPSStatusAction = () => ({ type: 'app/checkGPSStatus' });

// Selectors
export const selectNetworkStatus = (state: { app: AppState }) => state.app.networkStatus;
export const selectUserStatus = (state: { app: AppState }) => state.app.userStatus;
export const selectSelectedRadius = (state: { app: AppState }) => state.app.selectedRadius;
export const selectDeviceLocation = (state: { app: AppState }) => state.app.deviceLocation;
export const selectGPSStatus = (state: { app: AppState }) => state.app.gpsStatus;
export const selectInitializationStatus = (state: { app: AppState }) => state.app?.initialization?.status ?? 'idle';
export const selectOnboardingRequired = (state: { app: AppState }) => state.app?.initialization?.onboardingRequired ?? false;
export const selectDeviceCheckComplete = (state: { app: AppState }) => state.app?.initialization?.deviceCheckComplete ?? false;
export const selectServicesStarted = (state: { app: AppState }) => state.app?.initialization?.servicesStarted ?? false;
export const selectInitializationError = (state: { app: AppState }) => state.app?.initialization?.error ?? null;

export default appSlice.reducer;
