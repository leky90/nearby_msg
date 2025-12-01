import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type TabType = 'sos' | 'following' | 'explore' | 'chat' | 'status';

interface NavigationState {
  activeTab: TabType;
  currentChatGroupId: string | null;
}

const initialState: NavigationState = {
  activeTab: 'explore',
  currentChatGroupId: null,
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<TabType>) => {
      state.activeTab = action.payload;
    },
    setCurrentChatGroupId: (state, action: PayloadAction<string | null>) => {
      state.currentChatGroupId = action.payload;
    },
    navigateToChat: (state, action: PayloadAction<string>) => {
      state.activeTab = 'chat';
      state.currentChatGroupId = action.payload;
    },
  },
});

export const {
  setActiveTab,
  setCurrentChatGroupId,
  navigateToChat,
} = navigationSlice.actions;

// Selectors
export const selectActiveTab = (state: { navigation: NavigationState }) => state.navigation.activeTab;
export const selectCurrentChatGroupId = (state: { navigation: NavigationState }) => state.navigation.currentChatGroupId;

export default navigationSlice.reducer;
