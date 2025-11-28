import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TabType = 'sos' | 'following' | 'explore' | 'chat' | 'status';

interface NavigationState {
  activeTab: TabType;
  currentChatGroupId: string | null;
  setActiveTab: (tab: TabType) => void;
  navigateToChat: (groupId: string) => void;
  setCurrentChatGroupId: (groupId: string | null) => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      activeTab: 'explore',
      currentChatGroupId: null,
      setActiveTab: (tab) => set({ activeTab: tab }),
      navigateToChat: (groupId) => set({ 
        currentChatGroupId: groupId, 
        activeTab: 'chat' 
      }),
      setCurrentChatGroupId: (groupId) => set({ currentChatGroupId: groupId }),
    }),
    {
      name: 'navigation-store',
      partialize: (state) => ({
        activeTab: state.activeTab,
        currentChatGroupId: state.currentChatGroupId,
      }),
    }
  )
);

