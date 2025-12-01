import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { Group } from "@/shared/domain/group";

interface GroupDetailsState {
  group: Group;
  isLoading: boolean;
  error: string | null;
  // Additional metadata collected by saga
  latestMessagePreview: string | null;
  unreadCount: number;
  activeMemberCount: number;
}

interface GroupsState {
  // Nearby groups
  nearbyGroups: Group[];
  nearbyGroupsLoading: boolean;
  nearbyGroupsError: string | null;
  nearbyGroupsDistances: number[];
  
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
  
  // Group suggestion (for create form)
  groupSuggestion: {
    suggested_name: string;
    suggested_type: Group['type'];
  } | null;
  groupSuggestionLoading: boolean;
  groupSuggestionError: string | null;
  
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
  nearbyGroupsDistances: [],
  favoriteGroupIds: [],
  byId: {},
  lastFetchParams: null,
  deviceCreatedGroup: null,
  groupSuggestion: null,
  groupSuggestionLoading: false,
  groupSuggestionError: null,
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
    setNearbyGroupsDistances: (state, action: PayloadAction<number[]>) => {
      state.nearbyGroupsDistances = action.payload;
    },
    setGroup: (state, action: PayloadAction<Group>) => {
      const group = action.payload;
      if (!state.byId[group.id]) {
        state.byId[group.id] = {
          group,
          isLoading: false,
          error: null,
          latestMessagePreview: null,
          unreadCount: 0,
          activeMemberCount: 0,
        };
      } else {
        state.byId[group.id].group = group;
      }
    },
    setGroupDetails: (
      state,
      action: PayloadAction<{
        groupId: string;
        latestMessagePreview: string | null;
        unreadCount: number;
        activeMemberCount: number;
      }>
    ) => {
      const { groupId, latestMessagePreview, unreadCount, activeMemberCount } = action.payload;
      if (!state.byId[groupId]) {
        state.byId[groupId] = {
          group: {} as Group,
          isLoading: false,
          error: null,
          latestMessagePreview,
          unreadCount,
          activeMemberCount,
        };
      } else {
        state.byId[groupId].latestMessagePreview = latestMessagePreview;
        state.byId[groupId].unreadCount = unreadCount;
        state.byId[groupId].activeMemberCount = activeMemberCount;
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
          latestMessagePreview: null,
          unreadCount: 0,
          activeMemberCount: 0,
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
          latestMessagePreview: null,
          unreadCount: 0,
          activeMemberCount: 0,
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
    setGroupSuggestion: (
      state,
      action: PayloadAction<{
        suggested_name: string;
        suggested_type: Group['type'];
      } | null>
    ) => {
      state.groupSuggestion = action.payload;
    },
    setGroupSuggestionLoading: (state, action: PayloadAction<boolean>) => {
      state.groupSuggestionLoading = action.payload;
    },
    setGroupSuggestionError: (state, action: PayloadAction<string | null>) => {
      state.groupSuggestionError = action.payload;
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
  setNearbyGroupsDistances,
  setGroup,
  setGroupLoading,
  setGroupError,
  setGroupDetails,
  addFavoriteGroup,
  removeFavoriteGroup,
  setLastFetchParams,
  setDeviceCreatedGroup,
  setGroupSuggestion,
  setGroupSuggestionLoading,
  setGroupSuggestionError,
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

export const selectNearbyGroupsError = createSelector(
  [selectGroupsState],
  (groups) => groups.nearbyGroupsError
);

export const selectNearbyGroupsDistances = createSelector(
  [selectGroupsState],
  (groups) => groups.nearbyGroupsDistances
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
    latestMessagePreview: null,
    unreadCount: 0,
    isFavorited: false,
    activeMemberCount: 0,
  }
);

export const selectGroupLoading = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupId: string) => groupId],
  (groups, groupId) => groups.byId[groupId]?.isLoading ?? false
);

export const selectGroupError = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupId: string) => groupId],
  (groups, groupId) => groups.byId[groupId]?.error ?? null
);

/**
 * Selector for group details metadata (latest message, unread count, etc.)
 * Returns the aggregated details for a group
 */
export const selectGroupDetailsMetadata = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupId: string) => groupId],
  (groups, groupId) => {
    const details = groups.byId[groupId];
    if (!details) {
      return {
        latestMessagePreview: null,
        unreadCount: 0,
        activeMemberCount: 0,
      };
    }
    return {
      latestMessagePreview: details.latestMessagePreview,
      unreadCount: details.unreadCount,
      activeMemberCount: details.activeMemberCount,
    };
  }
);

/**
 * Selector for multiple groups' details metadata
 * Returns details for all specified group IDs
 */
export const selectGroupsDetailsMetadata = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupIds: string[]) => groupIds],
  (groups, groupIds) => {
    return groupIds.map((groupId) => {
      const details = groups.byId[groupId];
      return {
        groupId,
        latestMessagePreview: details?.latestMessagePreview || null,
        unreadCount: details?.unreadCount || 0,
        activeMemberCount: details?.activeMemberCount || 0,
      };
    });
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

export const selectGroupSuggestion = createSelector(
  [selectGroupsState],
  (groups) => groups.groupSuggestion
);

export const selectGroupSuggestionLoading = createSelector(
  [selectGroupsState],
  (groups) => groups.groupSuggestionLoading
);

export const selectGroupSuggestionError = createSelector(
  [selectGroupsState],
  (groups) => groups.groupSuggestionError
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

// Memoized selector for multiple groups by IDs
// This prevents infinite loops when selecting multiple groups
export const selectGroupsByIds = createSelector(
  [selectGroupsState, (_state: { groups: GroupsState }, groupIds: string[]) => groupIds],
  (groups, groupIds) => {
    if (groupIds.length === 0) return [];
    return groupIds.map((id) => groups.byId[id]?.group || null).filter((g): g is Group => g !== null);
  }
);

// Selector for all groups from byId structure
export const selectAllGroups = createSelector(
  [selectGroupsState],
  (groups) => {
    return Object.values(groups.byId)
      .map((details) => details.group)
      .filter((group): group is Group => group !== null && typeof group === 'object' && 'id' in group);
  }
);

export default groupsSlice.reducer;
