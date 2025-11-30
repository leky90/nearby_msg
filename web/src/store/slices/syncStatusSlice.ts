import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';

export interface GroupSyncStatus {
  groupId: string;
  messageStatus: 'synced' | 'pending' | 'syncing' | 'offline';
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  lastUpdated: string;
}

export interface MutationSyncStatus {
  pending: number;
  syncing: number;
  failed: number;
  lastUpdated: string;
}

export interface MessageSyncStatus {
  pending: number;
  syncing: number;
  failed: number;
  lastUpdated: string;
}

export interface OverallSyncStatus {
  status: 'synced' | 'pending' | 'syncing' | 'failed' | 'offline';
  lastUpdated: string;
}

interface SyncStatusState {
  // Sync status by group ID
  byGroupId: Record<string, GroupSyncStatus>;
  
  // Overall mutation status
  mutations: MutationSyncStatus;
  
  // Overall message status
  messages: MessageSyncStatus;
  
  // Overall status
  overall: OverallSyncStatus;
  
  // Network status (affects sync)
  isOnline: boolean;
}

const initialState: SyncStatusState = {
  byGroupId: {},
  mutations: {
    pending: 0,
    syncing: 0,
    failed: 0,
    lastUpdated: new Date().toISOString(),
  },
  messages: {
    pending: 0,
    syncing: 0,
    failed: 0,
    lastUpdated: new Date().toISOString(),
  },
  overall: {
    status: 'synced',
    lastUpdated: new Date().toISOString(),
  },
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
};

const syncStatusSlice = createSlice({
  name: 'syncStatus',
  initialState,
  reducers: {
    setGroupSyncStatus: (state, action: PayloadAction<GroupSyncStatus>) => {
      const { groupId } = action.payload;
      state.byGroupId[groupId] = action.payload;
    },
    setMutationSyncStatus: (state, action: PayloadAction<MutationSyncStatus>) => {
      state.mutations = action.payload;
      updateOverallStatus(state);
    },
    setMessageSyncStatus: (state, action: PayloadAction<MessageSyncStatus>) => {
      state.messages = action.payload;
      updateOverallStatus(state);
    },
    setNetworkStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
      if (!action.payload) {
        state.overall.status = 'offline';
        state.overall.lastUpdated = new Date().toISOString();
      } else {
        updateOverallStatus(state);
      }
    },
    clearGroupSyncStatus: (state, action: PayloadAction<string>) => {
      delete state.byGroupId[action.payload];
    },
  },
});

function updateOverallStatus(state: SyncStatusState) {
  if (!state.isOnline) {
    state.overall.status = 'offline';
    state.overall.lastUpdated = new Date().toISOString();
    return;
  }

  const totalFailed = state.mutations.failed + state.messages.failed;
  const totalSyncing = state.mutations.syncing + state.messages.syncing;
  const totalPending = state.mutations.pending + state.messages.pending;

  if (totalFailed > 0) {
    state.overall.status = 'failed';
  } else if (totalSyncing > 0) {
    state.overall.status = 'syncing';
  } else if (totalPending > 0) {
    state.overall.status = 'pending';
  } else {
    state.overall.status = 'synced';
  }
  
  state.overall.lastUpdated = new Date().toISOString();
}

export const {
  setGroupSyncStatus,
  setMutationSyncStatus,
  setMessageSyncStatus,
  setNetworkStatus,
  clearGroupSyncStatus,
} = syncStatusSlice.actions;

// Selectors
const selectSyncStatusState = (state: { syncStatus: SyncStatusState }) => state.syncStatus;

export const selectGroupSyncStatus = createSelector(
  [selectSyncStatusState, (_state: { syncStatus: SyncStatusState }, groupId: string) => groupId],
  (syncStatus, groupId) => syncStatus.byGroupId[groupId] || {
    groupId,
    messageStatus: 'synced' as const,
    pendingCount: 0,
    syncingCount: 0,
    failedCount: 0,
    lastUpdated: new Date().toISOString(),
  }
);

export const selectMutationSyncStatus = createSelector(
  [selectSyncStatusState],
  (syncStatus) => syncStatus.mutations
);

export const selectMessageSyncStatus = createSelector(
  [selectSyncStatusState],
  (syncStatus) => syncStatus.messages
);

export const selectOverallSyncStatus = createSelector(
  [selectSyncStatusState],
  (syncStatus) => syncStatus.overall
);

export const selectIsOnline = createSelector(
  [selectSyncStatusState],
  (syncStatus) => syncStatus.isOnline
);

export default syncStatusSlice.reducer;
