import { call, put, takeEvery, take, select, fork, delay } from 'redux-saga/effects';
import { eventChannel, type EventChannel, type Task } from 'redux-saga';
import type { Group, NearbyGroupsRequest, NearbyGroupsResponse } from '@/domain/group';
import {
  discoverNearbyGroups,
  createGroup as createGroupService,
  getDeviceCreatedGroup,
} from '@/services/group-service';
import { addFavorite, removeFavorite, isFavorited } from '@/services/favorite-service';
import { getGroupStatusSummary } from '@/services/status-service';
import { getDatabase } from '@/services/db';
import { selectDevice } from '../slices/deviceSlice';
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
  setDeviceCreatedGroup,
  setDeviceCreatedGroupLoading,
  setGroupStatusSummary,
} from '../slices/groupsSlice';
import { log } from '@/lib/logging/logger';

// Action types
const FETCH_NEARBY_GROUPS = 'groups/fetchNearbyGroups';
const CREATE_GROUP = 'groups/createGroup';
const FETCH_GROUP_DETAILS = 'groups/fetchGroupDetails';
const TOGGLE_FAVORITE = 'groups/toggleFavorite';
const CHECK_DEVICE_CREATED_GROUP = 'groups/checkDeviceCreatedGroup';
const WATCH_DEVICE_CREATED_GROUP = 'groups/watchDeviceCreatedGroup';
const START_GROUP_STATUS_SUMMARY = 'groups/startStatusSummary';
const STOP_GROUP_STATUS_SUMMARY = 'groups/stopStatusSummary';

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
export const checkDeviceCreatedGroupAction = () => ({ type: CHECK_DEVICE_CREATED_GROUP });
export const watchDeviceCreatedGroupAction = () => ({ type: WATCH_DEVICE_CREATED_GROUP });
export const startGroupStatusSummaryAction = (groupId: string) => ({
  type: START_GROUP_STATUS_SUMMARY,
  payload: { groupId },
});
export const stopGroupStatusSummaryAction = (groupId: string) => ({
  type: STOP_GROUP_STATUS_SUMMARY,
  payload: { groupId },
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
    // Update device created group
    yield put(setDeviceCreatedGroup(group));
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

/**
 * Check if device has created a group
 */
function* watchCheckDeviceCreatedGroup() {
  yield takeEvery(CHECK_DEVICE_CREATED_GROUP, handleCheckDeviceCreatedGroup);
}

function* handleCheckDeviceCreatedGroup() {
  try {
    yield put(setDeviceCreatedGroupLoading(true));
    const device = (yield select(selectDevice) as unknown) as ReturnType<typeof selectDevice>;
    
    if (!device?.id) {
      yield put(setDeviceCreatedGroup(null));
      return;
    }
    
    const group: Group | null = yield call(getDeviceCreatedGroup);
    yield put(setDeviceCreatedGroup(group));
  } catch (error) {
    log.error('Failed to check device created group', error);
    yield put(setDeviceCreatedGroup(null));
  } finally {
    yield put(setDeviceCreatedGroupLoading(false));
  }
}

/**
 * Watch for device created group changes
 */
function* watchDeviceCreatedGroup() {
  yield takeEvery(WATCH_DEVICE_CREATED_GROUP, handleWatchDeviceCreatedGroup);
}

function* handleWatchDeviceCreatedGroup() {
  const device = (yield select(selectDevice) as unknown) as ReturnType<typeof selectDevice>;
  
  if (!device?.id) {
    return;
  }
  
  // Initial check
  yield put(checkDeviceCreatedGroupAction());
  
  // Watch for changes via RxDB subscription
  yield fork(watchDeviceCreatedGroupSubscription, device.id);
}

function* watchDeviceCreatedGroupSubscription(deviceId: string) {
  try {
    // Create event channel for RxDB subscription
    const channel: EventChannel<Group | null> = yield call(createDeviceGroupEventChannel, deviceId);
    
    try {
      while (true) {
        const group: Group | null = yield take(channel);
        yield put(setDeviceCreatedGroup(group));
      }
    } finally {
      channel.close();
    }
  } catch (error) {
    log.error('Failed to watch device created group', error);
    // Fallback to periodic checking
    while (true) {
      yield delay(2000);
      yield put(checkDeviceCreatedGroupAction());
    }
  }
}

function createDeviceGroupEventChannel(deviceId: string): EventChannel<Group | null> {
  return eventChannel<Group | null>((emit) => {
    let unsubscribe: (() => void) | null = null;
    
    getDatabase().then((db) => {
      const query = db.groups.find({
        selector: { creator_device_id: deviceId },
      });
      
      const subscription = query.$.subscribe((docs) => {
        const group = docs.length > 0 ? (docs[0].toJSON() as Group) : null;
        emit(group);
      });
      
      unsubscribe = () => subscription.unsubscribe();
    }).catch((err) => {
      log.error('Failed to setup device group subscription', err);
      emit(null);
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });
}

/**
 * Monitor group status summary
 */
const activeStatusSummaryTasks = new Map<string, Task>();

function* watchStartGroupStatusSummary() {
  yield takeEvery(START_GROUP_STATUS_SUMMARY, handleStartGroupStatusSummary);
}

function* handleStartGroupStatusSummary(action: { type: string; payload: { groupId: string } }) {
  const { groupId } = action.payload;
  
  // Cancel existing task if any
  const existingTask = activeStatusSummaryTasks.get(groupId);
  if (existingTask) {
    // Task cancellation would go here if needed
  }
  
  // Start new monitoring task
  const task: Task = yield fork(monitorGroupStatusSummary, groupId);
  activeStatusSummaryTasks.set(groupId, task);
}

function* watchStopGroupStatusSummary() {
  yield takeEvery(STOP_GROUP_STATUS_SUMMARY, handleStopGroupStatusSummary);
}

function* handleStopGroupStatusSummary(action: { type: string; payload: { groupId: string } }) {
  const { groupId } = action.payload;
  activeStatusSummaryTasks.delete(groupId);
  // Yield to satisfy generator requirement
  yield undefined;
}

function* monitorGroupStatusSummary(groupId: string) {
  while (true) {
    try {
      const summary = (yield call(getGroupStatusSummary, groupId) as unknown) as Awaited<ReturnType<typeof getGroupStatusSummary>>;
      yield put(setGroupStatusSummary({ groupId, summary }));
      yield delay(60000); // Poll every 60 seconds
    } catch (error) {
      log.error('Failed to monitor group status summary', error, { groupId });
      yield delay(60000);
    }
  }
}

// Root saga
export function* groupSaga() {
  yield watchFetchNearbyGroups();
  yield watchCreateGroup();
  yield watchFetchGroupDetails();
  yield watchToggleFavorite();
  yield watchCheckDeviceCreatedGroup();
  yield watchDeviceCreatedGroup();
  yield watchStartGroupStatusSummary();
  yield watchStopGroupStatusSummary();
}
