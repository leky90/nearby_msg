import { create } from 'zustand';
import type { NetworkStatus } from '@/services/network-status';
import type { UserStatus } from '@/domain/user_status';
import type { RadiusOption } from '@/domain/group';

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
}

export const useAppStore = create<AppState>((set) => ({
  // Network status
  networkStatus: 'online',
  setNetworkStatus: (status) => set({ networkStatus: status }),
  
  // User status
  userStatus: null,
  setUserStatus: (status) => set({ userStatus: status }),
  
  // Radius filter
  selectedRadius: 500,
  setSelectedRadius: (radius) => set({ selectedRadius: radius }),
}));

