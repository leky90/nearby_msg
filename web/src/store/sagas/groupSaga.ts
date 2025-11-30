import { call, put, takeEvery } from 'redux-saga/effects';
import type { Group, NearbyGroupsRequest, NearbyGroupsResponse } from '@/domain/group';
import {
    discoverNearbyGroups,
    createGroup as createGroupService,
} from '@/services/group-service';
import { addFavorite, removeFavorite, isFavorited } from '@/services/favorite-service';
import {
    setNearbyGroups,
    setNearbyGroupsLoading,
    setNearbyGroupsError,
    setGroup,
    setGroupLoading,
    setGroupError,
    addFavoriteGroup,
    removeFavoriteGroup,
    setLastFetchParams,
} from '../slices/groupsSlice';
import { log } from '@/lib/logging/logger';

// Action types
const FETCH_NEARBY_GROUPS = 'groups/fetchNearbyGroups';
const CREATE_GROUP = 'groups/createGroup';
const FETCH_GROUP_DETAILS = 'groups/fetchGroupDetails';
const TOGGLE_FAVORITE = 'groups/toggleFavorite';

// Action creators
export const fetchNearbyGroupsAction = (request: NearbyGroupsRequest) => ({
  type: FETCH_NEARBY_GROUPS,
  payload: request,
});
export const createGroupAction = (group: {
  name: string;
  type: Group['type'];
  latitude: number;
  longitude: number;
  region_code?: string;
}) => ({
  type: CREATE_GROUP,
  payload: group,
});
export const fetchGroupDetailsAction = (groupId: string) => ({
  type: FETCH_GROUP_DETAILS,
  payload: groupId,
});
export const toggleFavoriteAction = (groupId: string) => ({
  type: TOGGLE_FAVORITE,
  payload: groupId,
});

// Sagas
function* watchFetchNearbyGroups() {
  yield takeEvery(FETCH_NEARBY_GROUPS, handleFetchNearbyGroups);
}

function* handleFetchNearbyGroups(action: { type: string; payload: NearbyGroupsRequest }) {
  try {
    yield put(setNearbyGroupsLoading(true));
    yield put(setNearbyGroupsError(null));
    
    const response: NearbyGroupsResponse = yield call(discoverNearbyGroups, action.payload);
    
    yield put(setNearbyGroups(response.groups));
    yield put(setLastFetchParams(action.payload));
  } catch (error) {
    log.error('Failed to fetch nearby groups', error);
    yield put(
      setNearbyGroupsError(
        error instanceof Error ? error.message : 'Failed to fetch nearby groups'
      )
    );
  } finally {
    yield put(setNearbyGroupsLoading(false));
  }
}

function* watchCreateGroup() {
  yield takeEvery(CREATE_GROUP, handleCreateGroup);
}

function* handleCreateGroup(action: {
  type: string;
  payload: {
    name: string;
    type: Group['type'];
    latitude: number;
    longitude: number;
    region_code?: string;
  };
}) {
  try {
    const group: Group = yield call(createGroupService, action.payload);
    yield put(setGroup(group));
  } catch (error) {
    log.error('Failed to create group', error);
    // Error handling is done in the service layer
  }
}

function* watchFetchGroupDetails() {
  yield takeEvery(FETCH_GROUP_DETAILS, handleFetchGroupDetails);
}

function* handleFetchGroupDetails(action: { type: string; payload: string }) {
  const groupId = action.payload;
  try {
    yield put(setGroupLoading({ groupId, loading: true }));
    yield put(setGroupError({ groupId, error: null }));
    
    // Group details (latest message, unread count, etc.) are computed from RxDB
    // This saga can trigger a refetch of group data if needed
    // For now, group details are computed on-demand in components/hooks from RxDB
    // Groups themselves are synced via replication
    
    yield put(setGroupLoading({ groupId, loading: false }));
  } catch (error) {
    log.error('Failed to fetch group details', error);
    yield put(
      setGroupError({
        groupId,
        error: error instanceof Error ? error.message : 'Failed to fetch group details',
      })
    );
    yield put(setGroupLoading({ groupId, loading: false }));
  }
}

function* watchToggleFavorite() {
  yield takeEvery(TOGGLE_FAVORITE, handleToggleFavorite);
}

function* handleToggleFavorite(action: { type: string; payload: string }) {
  const groupId = action.payload;
  try {
    const currentlyFavorited: boolean = yield call(isFavorited, groupId);
    
    if (currentlyFavorited) {
      yield call(removeFavorite, groupId);
      yield put(removeFavoriteGroup(groupId));
    } else {
      yield call(addFavorite, groupId);
      yield put(addFavoriteGroup(groupId));
    }
  } catch (error) {
    log.error('Failed to toggle favorite', error);
  }
}

// Root saga
export function* groupSaga() {
  yield watchFetchNearbyGroups();
  yield watchCreateGroup();
  yield watchFetchGroupDetails();
  yield watchToggleFavorite();
}
