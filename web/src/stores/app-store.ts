import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NetworkStatus } from '@/services/network-status';
import type { UserStatus } from '@/domain/user_status';
import type { RadiusOption } from '@/domain/group';
import type { GPSStatus } from '@/services/device-status';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  address?: string; // Reverse geocoded address
  updatedAt?: string; // ISO timestamp
}

interface AppState {
  // Network status
  networkStatus: NetworkStatus;
  setNetworkStatus: (status: NetworkStatus) => void;
  
  // User status
  userStatus: UserStatus | null;
  setUserStatus: (status: UserStatus | null) => void;
  
  // Radius filter
  selectedRadius: RadiusOption;
  setSelectedRadius: (radius: RadiusOption) => void;
  
  // Device location (shared across app)
  deviceLocation: DeviceLocation | null;
  setDeviceLocation: (location: DeviceLocation | null) => void;
  updateDeviceLocationAddress: (address: string) => void;
  
  // GPS permission status (cached to avoid repeated checks)
  gpsStatus: GPSStatus | null;
  setGPSStatus: (status: GPSStatus | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Network status
      networkStatus: 'online',
      setNetworkStatus: (status) => set({ networkStatus: status }),
      
      // User status
      userStatus: null,
      setUserStatus: (status) => set({ userStatus: status }),
      
      // Radius filter
      selectedRadius: 500,
      setSelectedRadius: (radius) => set({ selectedRadius: radius }),
      
      // Device location
      deviceLocation: null,
      setDeviceLocation: (location) => set({ deviceLocation: location }),
      updateDeviceLocationAddress: (address) =>
        set((state) => ({
          deviceLocation: state.deviceLocation
            ? { ...state.deviceLocation, address }
            : null,
        })),
      
      // GPS permission status
      gpsStatus: null,
      setGPSStatus: (status) => set({ gpsStatus: status }),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        deviceLocation: state.deviceLocation,
        selectedRadius: state.selectedRadius,
        userStatus: state.userStatus,
      }),
    }
  )
);

