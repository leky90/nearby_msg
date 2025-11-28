import { create } from 'zustand';

export type TabType = 'sos' | 'following' | 'explore' | 'chat' | 'status';

interface NavigationState {
  activeTab: TabType;
  currentChatGroupId: string | null;
  setActiveTab: (tab: TabType) => void;
  navigateToChat: (groupId: string) => void;
  setCurrentChatGroupId: (groupId: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeTab: 'explore',
  currentChatGroupId: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  navigateToChat: (groupId) => set({ 
    currentChatGroupId: groupId, 
    activeTab: 'chat' 
  }),
  setCurrentChatGroupId: (groupId) => set({ currentChatGroupId: groupId }),
}));

