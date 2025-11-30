import { call, put, takeEvery, fork, all } from 'redux-saga/effects';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest } from '@/domain/device';
import {
  fetchDevice,
  registerDeviceMutation,
  updateDeviceNickname,
} from '@/services/device-service';
import { setToken } from '@/services/api';
import { getToken } from '@/services/device-storage';
import {
  setDevice,
  setDeviceLoading,
  setDeviceError,
  setJWTToken,
  clearDevice,
} from '../slices/deviceSlice';
import { setOnboardingRequired } from '../slices/appSlice';
import { log } from '@/lib/logging/logger';

// Action types
const FETCH_DEVICE = 'device/fetchDevice';
const REGISTER_DEVICE = 'device/registerDevice';
const UPDATE_DEVICE = 'device/updateDevice';
const CLEAR_DEVICE = 'device/clearDevice';

// Action creators
export const fetchDeviceAction = () => ({ type: FETCH_DEVICE });
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
    yield put(setDeviceError(error instanceof Error ? error.message : 'Failed to fetch device'));
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
    log.error('Failed to register device', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to register device';
    yield put(setDeviceError(errorMessage));
    // Re-throw to allow OnboardingScreen to handle
    throw error;
  } finally {
    yield put(setDeviceLoading(false));
  }
}

function* watchUpdateDevice() {
  yield takeEvery(UPDATE_DEVICE, handleUpdateDevice);
}

function* handleUpdateDevice(action: { type: string; payload: DeviceUpdateRequest }) {
  try {
    yield put(setDeviceLoading(true));
    yield put(setDeviceError(null));
    
    const device: Device = yield call(updateDeviceNickname, action.payload.nickname);
    
    yield put(setDevice(device));
  } catch (error) {
    log.error('Failed to update device', error);
    yield put(setDeviceError(error instanceof Error ? error.message : 'Failed to update device'));
  } finally {
    yield put(setDeviceLoading(false));
  }
}

function* watchClearDevice() {
  yield takeEvery(CLEAR_DEVICE, handleClearDevice);
}

function* handleClearDevice() {
  yield put(clearDevice());
  setToken('');
}

// Root saga
export function* deviceSaga() {
  // Use fork to run all watchers in parallel (non-blocking)
  yield all([
    fork(watchFetchDevice),
    fork(watchRegisterDevice),
    fork(watchUpdateDevice),
    fork(watchClearDevice),
  ]);
}
