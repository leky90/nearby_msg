import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { Group } from '@/domain/group';

interface GroupDetailsState {
  group: Group;
  isLoading: boolean;
  error: string | null;
}

interface GroupsState {
  // Nearby groups
  nearbyGroups: Group[];
  nearbyGroupsLoading: boolean;
  nearbyGroupsError: string | null;
  
  // Favorite groups
  favoriteGroupIds: string[]; // Array instead of Set for Redux serialization
  
  // Group details by ID
  byId: Record<string, GroupDetailsState>;
  
  // Last fetch parameters
  lastFetchParams: {
    latitude: number;
    longitude: number;
    radius: number;
  } | null;
  
  // Device's created group
  deviceCreatedGroup: Group | null;
  deviceCreatedGroupLoading: boolean;
  
  // Status summary by group ID
  statusSummaryByGroupId: Record<string, {
    safe_count: number;
    need_help_count: number;
    cannot_contact_count: number;
    total_count: number;
    lastUpdated: string;
  }>;
}

const initialState: GroupsState = {
  nearbyGroups: [],
  nearbyGroupsLoading: false,
  nearbyGroupsError: null,
  favoriteGroupIds: [],
  byId: {},
  lastFetchParams: null,
  deviceCreatedGroup: null,
  deviceCreatedGroupLoading: false,
  statusSummaryByGroupId: {},
};

const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    setNearbyGroups: (state, action: PayloadAction<Group[]>) => {
      state.nearbyGroups = action.payload;
    },
    setNearbyGroupsLoading: (state, action: PayloadAction<boolean>) => {
      state.nearbyGroupsLoading = action.payload;
    },
    setNearbyGroupsError: (state, action: PayloadAction<string | null>) => {
      state.nearbyGroupsError = action.payload;
    },
    setGroup: (state, action: PayloadAction<Group>) => {
      const group = action.payload;
      if (!state.byId[group.id]) {
        state.byId[group.id] = {
          group,
          isLoading: false,
          error: null,
        };
      } else {
        state.byId[group.id].group = group;
      }
    },
    setGroupLoading: (
      state,
      action: PayloadAction<{ groupId: string; loading: boolean }>
    ) => {
      const { groupId, loading } = action.payload;
      if (!state.byId[groupId]) {
        state.byId[groupId] = {
          group: {} as Group,
          isLoading: loading,
          error: null,
        };
      } else {
        state.byId[groupId].isLoading = loading;
      }
    },
    setGroupError: (
      state,
      action: PayloadAction<{ groupId: string; error: string | null }>
    ) => {
      const { groupId, error } = action.payload;
      if (!state.byId[groupId]) {
        state.byId[groupId] = {
          group: {} as Group,
          isLoading: false,
          error,
        };
      } else {
        state.byId[groupId].error = error;
      }
    },
    addFavoriteGroup: (state, action: PayloadAction<string>) => {
      const groupId = action.payload;
      if (!state.favoriteGroupIds.includes(groupId)) {
        state.favoriteGroupIds.push(groupId);
      }
    },
    removeFavoriteGroup: (state, action: PayloadAction<string>) => {
      state.favoriteGroupIds = state.favoriteGroupIds.filter((id) => id !== action.payload);
    },
    setLastFetchParams: (
      state,
      action: PayloadAction<{ latitude: number; longitude: number; radius: number } | null>
    ) => {
      state.lastFetchParams = action.payload;
    },
    setDeviceCreatedGroup: (state, action: PayloadAction<Group | null>) => {
      state.deviceCreatedGroup = action.payload;
    },
    setDeviceCreatedGroupLoading: (state, action: PayloadAction<boolean>) => {
      state.deviceCreatedGroupLoading = action.payload;
    },
    setGroupStatusSummary: (
      state,
      action: PayloadAction<{
        groupId: string;
        summary: {
          safe_count: number;
          need_help_count: number;
          cannot_contact_count: number;
          total_count: number;
        };
      }>
    ) => {
      const { groupId, summary } = action.payload;
      state.statusSummaryByGroupId[groupId] = {
        ...summary,
        lastUpdated: new Date().toISOString(),
      };
    },
  },
});

export const {
  setNearbyGroups,
  setNearbyGroupsLoading,
  setNearbyGroupsError,
  setGroup,
  setGroupLoading,
  setGroupError,
  addFavoriteGroup,
  removeFavoriteGroup,
  setLastFetchParams,
  setDeviceCreatedGroup,
  setDeviceCreatedGroupLoading,
  setGroupStatusSummary,
} = groupsSlice.actions;

// Base selector
const selectGroupsState = (state: { groups: GroupsState }) => state.groups;

// Optimized selectors using createSelector
export const selectNearbyGroups = createSelector(
  [selectGroupsState],
  (groups) => groups.nearbyGroups
);

export const selectNearbyGroupsLoading = createSelector(
  [selectGroupsState],
  (groups) => groups.nearbyGroupsLoading
);

export const selectFavoriteGroupIds = createSelector(
  [selectGroupsState],
  (groups) => groups.favoriteGroupIds
);

export const selectGroupById = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupId: string) => groupId],
  (groups, groupId) => groups.byId[groupId]?.group
);

export const selectIsFavoriteGroup = createSelector(
  [selectFavoriteGroupIds, (_state: { groups: GroupsState }, groupId: string) => groupId],
  (favoriteIds, groupId) => favoriteIds.includes(groupId)
);

export const selectGroupDetails = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupId: string) => groupId],
  (groups, groupId) => groups.byId[groupId] || {
    group: null,
    isLoading: false,
    error: null,
  }
);

export const selectDeviceCreatedGroup = createSelector(
  [selectGroupsState],
  (groups) => groups.deviceCreatedGroup
);

export const selectHasDeviceCreatedGroup = createSelector(
  [selectGroupsState],
  (groups) => groups.deviceCreatedGroup !== null
);

export const selectGroupStatusSummary = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupId: string) => groupId],
  (groups, groupId) => groups.statusSummaryByGroupId[groupId] || {
    safe_count: 0,
    need_help_count: 0,
    cannot_contact_count: 0,
    total_count: 0,
    lastUpdated: new Date().toISOString(),
  }
);

export default groupsSlice.reducer;
