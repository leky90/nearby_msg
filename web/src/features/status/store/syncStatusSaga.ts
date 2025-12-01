import { call, put, takeEvery, take, fork, delay, select } from 'redux-saga/effects';
import { eventChannel, type EventChannel } from 'redux-saga';
import { getDatabase } from "@/shared/services/db";
import { getMutationCounts } from '@/features/replication/services/mutation-queue';
import { triggerImmediateSync } from '@/features/replication/services/replication-sync';
import {
    setGroupSyncStatus,
    setMutationSyncStatus,
    setMessageSyncStatus,
    setNetworkStatus,
    type GroupSyncStatus,
    type MutationSyncStatus,
    type MessageSyncStatus,
} from './slice';
import { selectIsOnline } from './slice';
import { log } from "@/shared/lib/logging/logger";

// Action types
const START_SYNC_STATUS_MONITORING = 'syncStatus/startMonitoring';
const STOP_SYNC_STATUS_MONITORING = 'syncStatus/stopMonitoring';
const START_GROUP_SYNC_STATUS = 'syncStatus/startGroupMonitoring';
const STOP_GROUP_SYNC_STATUS = 'syncStatus/stopGroupMonitoring';
const REFRESH_SYNC_STATUS = 'syncStatus/refresh';
const TRIGGER_MANUAL_SYNC = 'syncStatus/triggerManualSync';

// Action creators
export const startSyncStatusMonitoringAction = () => ({ type: START_SYNC_STATUS_MONITORING });
export const stopSyncStatusMonitoringAction = () => ({ type: STOP_SYNC_STATUS_MONITORING });
export const startGroupSyncStatusAction = (groupId: string) => ({
  type: START_GROUP_SYNC_STATUS,
  payload: { groupId },
});
export const stopGroupSyncStatusAction = (groupId: string) => ({
  type: STOP_GROUP_SYNC_STATUS,
  payload: { groupId },
});
export const refreshSyncStatusAction = () => ({ type: REFRESH_SYNC_STATUS });
export const triggerManualSyncAction = () => ({ type: TRIGGER_MANUAL_SYNC });

/**
 * Monitor overall sync status (mutations and messages)
 */
function* watchStartSyncStatusMonitoring() {
  yield takeEvery(START_SYNC_STATUS_MONITORING, handleStartSyncStatusMonitoring);
}

function* handleStartSyncStatusMonitoring() {
  // Monitor network status
  yield fork(monitorNetworkStatus);
  
  // Monitor overall sync status
  yield fork(monitorOverallSyncStatus);
}

/**
 * Monitor network status changes
 */
function* monitorNetworkStatus() {
  if (typeof window === 'undefined') return;
  
  const handleOnline = () => {
    window.dispatchEvent(new CustomEvent('syncStatus:networkOnline'));
  };
  const handleOffline = () => {
    window.dispatchEvent(new CustomEvent('syncStatus:networkOffline'));
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Set initial status
  yield put(setNetworkStatus(navigator.onLine));
  
  // Listen for network events
  const channel: EventChannel<boolean> = yield call(createNetworkEventChannel);
  
  try {
    while (true) {
      const isOnline: boolean = yield take(channel);
      yield put(setNetworkStatus(isOnline));
    }
  } finally {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }
}

function createNetworkEventChannel(): EventChannel<boolean> {
  return eventChannel<boolean>((emit) => {
    const handleOnline = () => emit(true);
    const handleOffline = () => emit(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Emit initial status
    emit(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });
}

/**
 * Monitor overall sync status (polling every 3 seconds)
 */
function* monitorOverallSyncStatus() {
  while (true) {
    try {
      yield* refreshOverallSyncStatus();
      yield delay(3000); // Poll every 3 seconds
    } catch (error) {
      log.error('Failed to monitor sync status', error);
      yield delay(3000);
    }
  }
}

function* refreshOverallSyncStatus(): Generator<unknown, void, unknown> {
  try {
    const isOnline = (yield select(selectIsOnline) as unknown) as boolean;
    if (!isOnline) {
      // Set offline status
      yield put(setMutationSyncStatus({
        pending: 0,
        syncing: 0,
        failed: 0,
        lastUpdated: new Date().toISOString(),
      }));
      yield put(setMessageSyncStatus({
        pending: 0,
        syncing: 0,
        failed: 0,
        lastUpdated: new Date().toISOString(),
      }));
      return;
    }
    
    const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
    
    // Get mutation counts
    const mutationCounts = (yield call(getMutationCounts) as unknown) as Awaited<ReturnType<typeof getMutationCounts>>;
    const mutationStatus: MutationSyncStatus = {
      pending: mutationCounts.pending,
      syncing: mutationCounts.syncing,
      failed: mutationCounts.failed,
      lastUpdated: new Date().toISOString(),
    };
    yield put(setMutationSyncStatus(mutationStatus));
    
    // Get message counts
    const [pendingMessages, syncingMessages, failedMessages] = (yield Promise.all([
      db.messages.find({ selector: { sync_status: 'pending' } }).exec(),
      db.messages.find({ selector: { sync_status: 'syncing' } }).exec(),
      db.messages.find({ selector: { sync_status: 'failed' } }).exec(),
    ]) as unknown) as [any[], any[], any[]];
    
    const messageStatus: MessageSyncStatus = {
      pending: pendingMessages.length,
      syncing: syncingMessages.length,
      failed: failedMessages.length,
      lastUpdated: new Date().toISOString(),
    };
    yield put(setMessageSyncStatus(messageStatus));
  } catch (error) {
    log.error('Failed to refresh sync status', error);
  }
}

/**
 * Monitor sync status for a specific group
 */
function* watchStartGroupSyncStatus() {
  yield takeEvery(START_GROUP_SYNC_STATUS, handleStartGroupSyncStatus);
}

function* handleStartGroupSyncStatus(action: { type: string; payload: { groupId: string } }) {
  const { groupId } = action.payload;
  yield fork(monitorGroupSyncStatus, groupId);
}

function* monitorGroupSyncStatus(groupId: string) {
  while (true) {
    try {
      yield* refreshGroupSyncStatus(groupId);
      yield delay(2000); // Poll every 2 seconds for group-specific status
    } catch (error) {
      log.error('Failed to monitor group sync status', error, { groupId });
      yield delay(2000);
    }
  }
}

function* refreshGroupSyncStatus(groupId: string): Generator<unknown, void, unknown> {
  try {
    const isOnline: boolean = (yield select(selectIsOnline)) as unknown as boolean;
    if (!isOnline) {
      const status: GroupSyncStatus = {
        groupId,
        messageStatus: 'offline',
        pendingCount: 0,
        syncingCount: 0,
        failedCount: 0,
        lastUpdated: new Date().toISOString(),
      };
      yield put(setGroupSyncStatus(status));
      return;
    }
    
    const db = (yield call(getDatabase) as unknown) as Awaited<ReturnType<typeof getDatabase>>;
    const pending = (yield db.messages
      .find({
        selector: {
          group_id: groupId,
          sync_status: { $ne: 'synced' },
        },
      })
      .exec() as unknown) as any[];
    
    const pendingCount = pending.filter((doc: { toJSON: () => { sync_status: string } }) => {
      const data = doc.toJSON();
      return data.sync_status === 'pending';
    }).length;
    
    const syncingCount = pending.filter((doc: { toJSON: () => { sync_status: string } }) => {
      const data = doc.toJSON();
      return data.sync_status === 'syncing';
    }).length;
    
    const failedCount = pending.filter((doc: { toJSON: () => { sync_status: string } }) => {
      const data = doc.toJSON();
      return data.sync_status === 'failed';
    }).length;
    
    let messageStatus: GroupSyncStatus['messageStatus'] = 'synced';
    if (failedCount > 0) {
      messageStatus = 'offline'; // Treat failed as offline for UI
    } else if (syncingCount > 0) {
      messageStatus = 'syncing';
    } else if (pendingCount > 0) {
      messageStatus = 'pending';
    }
    
    const status: GroupSyncStatus = {
      groupId,
      messageStatus,
      pendingCount,
      syncingCount,
      failedCount,
      lastUpdated: new Date().toISOString(),
    };
    yield put(setGroupSyncStatus(status));
  } catch (error) {
    log.error('Failed to refresh group sync status', error, { groupId });
  }
}

// Track refresh state to prevent duplicate calls
let isRefreshingSyncStatus = false;
let lastRefreshTime = 0;
const REFRESH_DEBOUNCE_MS = 1000; // Minimum 1 second between refreshes

/**
 * Handle manual refresh
 * Uses debouncing to prevent rapid refresh calls
 */
function* watchRefreshSyncStatus() {
  yield takeEvery(REFRESH_SYNC_STATUS, handleRefreshSyncStatus);
}

function* handleRefreshSyncStatus() {
  const now = Date.now();
  
  // Debounce: Skip if refresh was called recently or is in progress
  if (isRefreshingSyncStatus || (now - lastRefreshTime < REFRESH_DEBOUNCE_MS)) {
    log.debug('Skipping duplicate sync status refresh', {
      isRefreshing: isRefreshingSyncStatus,
      timeSinceLastRefresh: now - lastRefreshTime,
    });
    return;
  }
  
  isRefreshingSyncStatus = true;
  lastRefreshTime = now;
  
  try {
    yield* refreshOverallSyncStatus();
  } finally {
    isRefreshingSyncStatus = false;
  }
}

// Track manual sync state to prevent duplicate calls
let isTriggeringManualSync = false;
let lastManualSyncTime = 0;
const MANUAL_SYNC_DEBOUNCE_MS = 2000; // Minimum 2 seconds between manual syncs

/**
 * Handle manual sync trigger
 * Uses debouncing to prevent rapid sync triggers
 */
function* watchTriggerManualSync() {
  yield takeEvery(TRIGGER_MANUAL_SYNC, handleTriggerManualSync);
}

function* handleTriggerManualSync() {
  const now = Date.now();
  
  // Debounce: Skip if manual sync was triggered recently or is in progress
  if (isTriggeringManualSync || (now - lastManualSyncTime < MANUAL_SYNC_DEBOUNCE_MS)) {
    log.debug('Skipping duplicate manual sync trigger', {
      isTriggering: isTriggeringManualSync,
      timeSinceLastSync: now - lastManualSyncTime,
    });
    return;
  }
  
  isTriggeringManualSync = true;
  lastManualSyncTime = now;
  
  try {
    yield call(triggerImmediateSync);
    // Wait a bit for sync to complete, then refresh status
    yield delay(1000);
    yield* refreshOverallSyncStatus();
  } catch (error) {
    log.error('Failed to trigger manual sync', error);
  } finally {
    isTriggeringManualSync = false;
  }
}

/**
 * Root sync status saga
 *
 * Debouncing/Throttling Patterns:
 * - takeEvery + debouncing: Used for refreshSyncStatus, triggerManualSync (time-based debouncing)
 * - takeEvery: Used for monitoring actions (process all actions)
 */
// Root saga
export function* syncStatusSaga() {
  // Run all watchers concurrently
  yield fork(watchStartSyncStatusMonitoring);
  yield fork(watchStartGroupSyncStatus);
  yield fork(watchRefreshSyncStatus);
  yield fork(watchTriggerManualSync);

  // Auto-start monitoring once watchers are registered
  yield put(startSyncStatusMonitoringAction());
}
