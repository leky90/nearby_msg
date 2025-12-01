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
import { getToken } from "@/features/device/services/device-storage";
import {
    setDevice,
    setDevicesById,
    setDeviceLoading,
    setDeviceError,
    setJWTToken,
    clearDevice,
} from './slice';
import { setOnboardingRequired } from "@/features/navigation/store/appSlice";
import { getDatabase } from "@/shared/services/db";
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
      yield put(setDevice(null));
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
    
    // Clear onboarding requirement since device is now registered
    yield put(setOnboardingRequired(false));
    
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

function* watchClearDevice() {
  yield takeEvery(CLEAR_DEVICE, handleClearDevice);
}

function* handleClearDevice() {
  try {
    // Clear all user data (RxDB, localStorage, etc.)
    yield call(clearAllUserData);
    
    // Clear Redux state
    yield put(clearDevice());
    setToken('');
    
    // Set onboarding required
    yield put(setOnboardingRequired(true));
    
    log.info('All user data cleared, onboarding required');
  } catch (error) {
    log.error('Failed to clear device data', error);
    throw error;
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
      
      // Subscribe to all devices changes
      const query = db.devices.find();
      const subscription = query.$.subscribe((docs) => {
        if (!isActive) return;
        const devices = docs.map((doc) => doc.toJSON() as Device);
        emit(devices);
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
