import { call, put, takeEvery, takeLatest, fork, all, take, cancelled } from 'redux-saga/effects';
import { eventChannel, type EventChannel } from 'redux-saga';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest } from "@/shared/domain/device";
import {
  fetchDevice,
  registerDeviceMutation,
  updateDeviceNickname,
} from "@/features/device/services/device-service";
import { clearAllUserData } from "@/features/replication/services/data-clear";
import { setToken } from "@/shared/services/api";
import { getToken, getDeviceId } from "@/features/device/services/device-storage";
import { del } from "@/shared/services/api";
import {
  setDevice,
  setDevicesById,
  setDeviceLoading,
  setDeviceError,
  setJWTToken,
  clearDevice,
} from './slice';
// Removed initializationStatus and onboardingRequired - using device state directly
import { getDatabase } from "@/shared/services/db";
import { pullDocuments } from "@/features/replication/services/replication-sync";
import { log } from "@/shared/lib/logging/logger";

// Action types
const FETCH_DEVICE = 'device/fetchDevice';
const FETCH_DEVICES_BY_IDS = 'device/fetchDevicesByIds';
const REGISTER_DEVICE = 'device/registerDevice';
const UPDATE_DEVICE = 'device/updateDevice';
const CLEAR_DEVICE = 'device/clearDevice';

// Action creators
export const fetchDeviceAction = () => ({ type: FETCH_DEVICE });
export const fetchDevicesByIdsAction = (deviceIds: string[]) => ({
  type: FETCH_DEVICES_BY_IDS,
  payload: deviceIds,
});
export const registerDeviceAction = (request?: DeviceCreateRequest) => ({
  type: REGISTER_DEVICE,
  payload: request,
});
export const updateDeviceAction = (request: DeviceUpdateRequest) => ({
  type: UPDATE_DEVICE,
  payload: request,
});
export const clearDeviceAction = () => ({ type: CLEAR_DEVICE });

// Sagas
function* watchFetchDevice() {
  yield takeEvery(FETCH_DEVICE, handleFetchDevice);
}

function* watchFetchDevicesByIds() {
  yield takeEvery(FETCH_DEVICES_BY_IDS, handleFetchDevicesByIds);
}

function* handleFetchDevicesByIds(action: { type: string; payload: string[] }): Generator<unknown, void, unknown> {
  const deviceIds = action.payload;
  if (!deviceIds || deviceIds.length === 0) {
    return;
  }

  try {
    log.debug('Fetching devices by IDs', { count: deviceIds.length });
    
    // Read from RxDB first (fast, offline support)
    const db = (yield call(getDatabase)) as Awaited<ReturnType<typeof getDatabase>>;
    const devices: Device[] = [];
    
    // Fetch all devices from RxDB
    for (const deviceId of deviceIds) {
      try {
        const deviceDoc = (yield call(
          async () => {
            return await db.devices.findOne(deviceId).exec();
          }
        )) as unknown;
        if (deviceDoc && typeof deviceDoc === 'object' && deviceDoc !== null && 'toJSON' in deviceDoc) {
          const device = (deviceDoc as { toJSON: () => unknown }).toJSON() as Device;
          devices.push(device);
        }
      } catch {
        log.debug('Device not found in RxDB', { deviceId });
        // Device not in RxDB - will be synced via replication
      }
    }
    
    // Update Redux store with fetched devices
    // Note: Devices RxDB listener will also update Redux when RxDB changes,
    // but we update here immediately for faster UI response
    if (devices.length > 0) {
      yield put(setDevicesById(devices));
      log.debug('Devices fetched and updated in Redux', { count: devices.length });
    }
    
    // Missing devices will be synced via replication mechanism
    // Devices RxDB listener will update Redux when they arrive
  } catch (error) {
    log.error('Failed to fetch devices by IDs', error);
    // Don't set error state - missing devices will be synced via replication
  }
}

function* handleFetchDevice() {
  try {
    yield put(setDeviceLoading(true));
    yield put(setDeviceError(null));
    
    // Read from RxDB first
    const device: Device | null = yield call(fetchDevice);
    
    if (device) {
      yield put(setDevice(device));
      // Get token using helper function (synchronous, no yield needed)
      const token = getToken();
      if (token) {
        yield put(setJWTToken(token));
        setToken(token);
      }
      
      // If device has nickname, trigger service startup via appSaga
      if (device.nickname) {
        yield put({ type: 'app/startServices' });
      }
    } else {
      // Device not in RxDB: check if we have token (device should be registered)
      const token = getToken();
      if (token) {
        // Device should exist but not in RxDB: trigger pull replication
        // This ensures all data flows through RxDB, not direct API calls
        log.debug('Device not in RxDB but token exists, triggering pull replication');
        yield call(pullDocuments, ['devices']);
        
        // Read again after pull
        const deviceAfterPull: Device | null = yield call(fetchDevice);
        if (deviceAfterPull) {
          yield put(setDevice(deviceAfterPull));
          yield put(setJWTToken(token));
          setToken(token);
          if (deviceAfterPull.nickname) {
            yield put({ type: 'app/startServices' });
          }
        } else {
          // Still not found after pull - might need registration
          yield put(setDevice(null));
        }
      } else {
        // No token - device not registered yet
        yield put(setDevice(null));
      }
    }
  } catch (error) {
    log.error('Failed to fetch device', error);
    // Hiển thị thông báo lỗi thân thiện cho người dùng (tiếng Việt)
    yield put(
      setDeviceError(
        'Không thể tải thông tin thiết bị. Vui lòng thử lại sau.'
      )
    );
    yield put(setDevice(null));
  } finally {
    yield put(setDeviceLoading(false));
  }
}

function* watchRegisterDevice() {
  yield takeEvery(REGISTER_DEVICE, handleRegisterDevice);
}

function* handleRegisterDevice(action: { type: string; payload?: DeviceCreateRequest }) {
  try {
    yield put(setDeviceLoading(true));
    yield put(setDeviceError(null));
    log.info('Starting device registration', { payload: action.payload });
    
    const response: { device: Device; token: string } = yield call(
      registerDeviceMutation,
      action.payload
    );
    
    log.info('Device registration successful', { deviceId: response.device.id, hasToken: !!response.token });
    
    yield put(setDevice(response.device));
    yield put(setJWTToken(response.token));
    setToken(response.token);
    
    // Set active tab to explore after successful registration
    // App.tsx will automatically hide onboarding when device has nickname
    yield put({ type: 'navigation/setActiveTab', payload: 'explore' });
    
    // If device has nickname, trigger service startup
    if (response.device.nickname) {
      yield put({ type: 'app/startServices' });
    }
    
    log.info('Device and token set in Redux state');
  } catch (error) {
    // Ghi log chi tiết cho developer
    log.error('Đăng ký thiết bị thất bại', error);

    // Thông báo thân thiện cho người dùng (ẩn chi tiết kỹ thuật)
    yield put(
      setDeviceError(
        'Đăng ký thiết bị thất bại. Vui lòng kiểm tra kết nối và thử lại sau.'
      )
    );
    // Re-throw to allow OnboardingScreen to handle
    throw error;
  } finally {
    yield put(setDeviceLoading(false));
  }
}

/**
 * Watch for update device actions
 * Uses takeLatest to cancel previous updates when new update comes in
 * Prevents duplicate API calls when user updates rapidly
 */
function* watchUpdateDevice() {
  yield takeLatest(UPDATE_DEVICE, handleUpdateDevice);
}

function* handleUpdateDevice(action: { type: string; payload: DeviceUpdateRequest }) {
  try {
    yield put(setDeviceLoading(true));
    yield put(setDeviceError(null));
    
    const device: Device = yield call(updateDeviceNickname, action.payload.nickname);
    
    yield put(setDevice(device));
  } catch (error) {
    log.error('Failed to update device', error);
    // Thông báo lỗi cập nhật thiết bị bằng tiếng Việt
    yield put(
      setDeviceError(
        'Không thể cập nhật thông tin thiết bị. Vui lòng thử lại sau.'
      )
    );
  } finally {
    yield put(setDeviceLoading(false));
  }
}

// Guard to prevent infinite loops - only allow one clear operation at a time
let isClearingDevice = false;

function* watchClearDevice() {
  yield takeLatest(CLEAR_DEVICE, handleClearDevice);
}

function* handleClearDevice() {
  // Guard: Prevent multiple simultaneous clear operations
  if (isClearingDevice) {
    log.warn('[CLEAR_DEVICE] Clear operation already in progress, skipping duplicate call');
    return;
  }
  
  isClearingDevice = true;
  log.info('[CLEAR_DEVICE] Step 1: Starting device clear process', { 
    timestamp: new Date().toISOString(),
    stackTrace: new Error().stack 
  });
  
  try {
    // Get device ID before clearing (needed for API call)
    const deviceId = getDeviceId();
    log.info('[CLEAR_DEVICE] Step 2: Retrieved device ID', { deviceId, hasDeviceId: !!deviceId });
    
    // Call API to delete device on server (if device ID exists)
    // Note: Backend extracts device ID from JWT token, not from query parameter
    if (deviceId) {
      try {
        log.info('[CLEAR_DEVICE] Step 3: Calling API to delete device on server', { deviceId });
        // Backend extracts device ID from JWT token in Authorization header
        // Note: API_URL in dev is '/api' which proxy rewrites to '/v1', so endpoint should be '/device/' not '/v1/device/'
        yield call(() => del('/device/'));
        log.info('[CLEAR_DEVICE] Step 3: Device deleted on server successfully', { deviceId });
      } catch (apiError) {
        // Log but don't fail - local clear should still proceed
        // Device might already be deleted or network might be offline
        log.warn('[CLEAR_DEVICE] Step 3: Failed to delete device on server (continuing with local clear)', apiError, { deviceId });
      }
    } else {
      log.info('[CLEAR_DEVICE] Step 3: Skipping server deletion (no device ID)');
    }
    
    // Clear all user data (RxDB, localStorage, etc.)
    log.info('[CLEAR_DEVICE] Step 4: Starting clearAllUserData');
    yield call(clearAllUserData);
    log.info('[CLEAR_DEVICE] Step 4: clearAllUserData completed');
    
    // Clear Redux state
    log.info('[CLEAR_DEVICE] Step 5: Clearing Redux device state');
    yield put(clearDevice());
    log.info('[CLEAR_DEVICE] Step 5: Redux device state cleared');
    
    log.info('[CLEAR_DEVICE] Step 6: Clearing token');
    setToken('');
    log.info('[CLEAR_DEVICE] Step 6: Token cleared');
    
    // Ensure deviceLoading is false so onboarding can be displayed
    // App.tsx will automatically show onboarding when device === null
    log.info('[CLEAR_DEVICE] Step 7: Setting deviceLoading to false');
    yield put(setDeviceLoading(false));
    log.info('[CLEAR_DEVICE] Step 7: DeviceLoading set to false - App.tsx will show onboarding automatically');
    
    log.info('[CLEAR_DEVICE] Step 8: All user data cleared, onboarding required - PROCESS COMPLETE');
  } catch (error) {
    log.error('[CLEAR_DEVICE] ERROR: Failed to clear device data', error);
    throw error;
  } finally {
    // Reset guard after operation completes
    // Note: We keep the guard set to true permanently after first clear
    // to prevent any re-triggers. The guard will only reset on page reload.
    // This is intentional - once data is cleared, we don't want to clear again.
    log.info('[CLEAR_DEVICE] Clear operation completed, guard remains set to prevent re-triggers');
  }
}

/**
 * Watch RxDB devices collection for changes and sync to Redux
 * This listener ensures Redux store stays in sync with RxDB when replication updates data
 */
function* watchDevicesRxDBChanges() {
  try {
    const channel: EventChannel<Device[]> = yield call(createDevicesEventChannel);
    
    try {
      while (true) {
        const devices: Device[] = yield take(channel);
        // Update Redux store with all devices from RxDB
        yield put(setDevicesById(devices));
        log.debug('Devices RxDB listener: Updated Redux store', { count: devices.length });
      }
    } finally {
      const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
      if (isCancelled) {
        channel.close();
        log.debug('Devices RxDB listener: Channel closed');
      }
    }
  } catch (error) {
    log.error('Failed to setup devices RxDB listener', error);
  }
}

/**
 * Create event channel for RxDB devices collection subscription
 */
function createDevicesEventChannel(): EventChannel<Device[]> {
  return eventChannel<Device[]>((emit) => {
    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    
    // Setup RxDB subscription asynchronously
    getDatabase().then((db) => {
      if (!isActive) return;
      
      // Subscribe to collection changes using collection.$ observable
      // This emits whenever ANY document in the collection changes (insert, update, delete)
      const subscription = db.devices.$.subscribe(async (changeEvent) => {
        if (!isActive) return;
        
        try {
          // After any change, re-query all devices to get the latest state
          const allDevices = await db.devices.find().exec();
          const devices = allDevices.map((doc) => doc.toJSON() as Device);
          emit(devices);
          log.debug('Devices RxDB collection change detected', { 
            changeType: changeEvent.operation,
            documentId: changeEvent.documentData?.id,
            devicesCount: devices.length 
          });
        } catch (err) {
          log.error('Failed to query devices after collection change', err);
        }
      });
      
      // Also emit initial state immediately
      db.devices.find().exec().then((docs) => {
        if (!isActive) return;
        const devices = docs.map((doc) => doc.toJSON() as Device);
        emit(devices);
        log.debug('Devices RxDB initial state emitted', { count: devices.length });
      }).catch((err) => {
        log.error('Failed to emit initial devices state', err);
        if (isActive) {
          emit([]); // Emit empty array on error
        }
      });
      
      unsubscribe = () => subscription.unsubscribe();
    }).catch((err) => {
      log.error('Failed to create devices RxDB subscription', err);
      if (isActive) {
        emit([]); // Emit empty array on error
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

/**
 * Root device saga
 * 
 * Debouncing/Throttling Patterns:
 * - takeLatest: Used for updateDevice (cancels previous updates when new update comes in)
 * - takeEvery: Used for fetchDevice, registerDevice, clearDevice (process all actions)
 */
// Root saga
export function* deviceSaga() {
  // Use fork to run all watchers in parallel (non-blocking)
  yield all([
    fork(watchFetchDevice),
    fork(watchFetchDevicesByIds),
    fork(watchRegisterDevice),
    fork(watchUpdateDevice),
    fork(watchClearDevice),
    fork(watchDevicesRxDBChanges), // Start RxDB listener
  ]);
}
