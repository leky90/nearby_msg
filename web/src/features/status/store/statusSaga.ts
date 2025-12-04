import { call, put, takeEvery, take, fork, cancelled } from 'redux-saga/effects';
import { eventChannel, type EventChannel } from 'redux-saga';
import type { UserStatus, StatusType } from "@/shared/domain/user_status";
import { updateStatusMutation, fetchStatus } from "@/features/status/services/status-service";
import { setUserStatus } from "@/features/navigation/store/appSlice";
import { getDatabase } from "@/shared/services/db";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import { pullDocuments } from "@/features/replication/services/replication-sync";
import { log } from "@/shared/lib/logging/logger";

// Action types
const UPDATE_USER_STATUS = 'status/updateUserStatus';
const FETCH_USER_STATUS = 'status/fetchUserStatus';

// Action creators
export const updateUserStatusAction = (variables: {
  statusType: StatusType;
  description?: string;
}) => ({
  type: UPDATE_USER_STATUS,
  payload: variables,
});
export const fetchUserStatusAction = () => ({ type: FETCH_USER_STATUS });

// Sagas
function* watchUpdateUserStatus() {
  yield takeEvery(UPDATE_USER_STATUS, handleUpdateUserStatus);
}

function* handleUpdateUserStatus(action: {
  type: string;
  payload: { statusType: StatusType; description?: string };
}) {
  try {
    const status: UserStatus = yield call(updateStatusMutation, action.payload);
    yield put(setUserStatus(status));
  } catch (error) {
    log.error('Failed to update user status', error);
  }
}

function* watchFetchUserStatus() {
  yield takeEvery(FETCH_USER_STATUS, handleFetchUserStatus);
}

function* handleFetchUserStatus() {
  try {
    // Read from RxDB first
    const status: UserStatus | null = yield call(fetchStatus);
    
    if (status) {
      yield put(setUserStatus(status));
    } else {
      // Status not in RxDB: trigger pull replication to fetch from server
      // This ensures all data flows through RxDB, not direct API calls
      log.debug('User status not in RxDB, triggering pull replication');
      yield call(pullDocuments, ['user_status']);
      
      // Read again after pull
      const statusAfterPull: UserStatus | null = yield call(fetchStatus);
      yield put(setUserStatus(statusAfterPull));
    }
  } catch (error) {
    log.error('Failed to fetch user status', error);
    yield put(setUserStatus(null));
  }
}

/**
 * Watch RxDB user_status collection for changes and sync to Redux
 * This listener ensures Redux store stays in sync with RxDB when replication updates data
 */
function* watchUserStatusRxDBChanges() {
  try {
    const channel: EventChannel<UserStatus | null> = yield call(createUserStatusEventChannel);
    
    try {
      while (true) {
        const status: UserStatus | null = yield take(channel);
        // Update Redux store with user status from RxDB
        yield put(setUserStatus(status));
        log.debug('User status RxDB listener: Updated Redux store', { hasStatus: !!status });
      }
    } finally {
      const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
      if (isCancelled) {
        channel.close();
        log.debug('User status RxDB listener: Channel closed');
      }
    }
  } catch (error) {
    log.error('Failed to setup user status RxDB listener', error);
  }
}

/**
 * Create event channel for RxDB user_status collection subscription
 * Watches the current device's user status
 */
function createUserStatusEventChannel(): EventChannel<UserStatus | null> {
  return eventChannel<UserStatus | null>((emit) => {
    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    const deviceId = getOrCreateDeviceId();
    
    // Setup RxDB subscription asynchronously
    getDatabase().then((db) => {
      if (!isActive) return;
      
      // Subscribe to collection changes using collection.$ observable
      // This emits whenever ANY document in the collection changes (insert, update, delete)
      const subscription = db.user_status.$.subscribe(async (changeEvent: any) => {
        if (!isActive) return;
        
        try {
          // After any change, re-query user status for current device
          const query = db.user_status.find({
            selector: { device_id: deviceId },
          });
          const docs = await query.exec();
          const status = docs.length > 0 ? (docs[0].toJSON() as UserStatus) : null;
          emit(status);
          log.debug('User status RxDB collection change detected', { 
            changeType: changeEvent.operation,
            documentId: changeEvent.documentData?.id,
            hasStatus: status !== null
          });
        } catch (err) {
          log.error('Failed to query user status after collection change', err);
        }
      });
      
      // Also emit initial state immediately
      db.user_status.find({
        selector: { device_id: deviceId },
      }).exec().then((docs) => {
        if (!isActive) return;
        const status = docs.length > 0 ? (docs[0].toJSON() as UserStatus) : null;
        emit(status);
        log.debug('User status RxDB initial state emitted', { hasStatus: status !== null });
      }).catch((err) => {
        log.error('Failed to emit initial user status state', err);
        if (isActive) {
          emit(null); // Emit null on error
        }
      });
      
      unsubscribe = () => subscription.unsubscribe();
    }).catch((err) => {
      log.error('Failed to create user status RxDB subscription', err);
      if (isActive) {
        emit(null); // Emit null on error
      }
    });
    
    // Return cleanup function
    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });
}

// Root saga
export function* statusSaga() {
  yield watchUpdateUserStatus();
  yield watchFetchUserStatus();
  yield fork(watchUserStatusRxDBChanges); // Start RxDB listener
}
