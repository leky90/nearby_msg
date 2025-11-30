import { call, put, takeEvery } from 'redux-saga/effects';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest } from '@/domain/device';
import {
    fetchDevice,
    registerDeviceMutation,
    updateDeviceNickname,
} from '@/services/device-service';
import { setToken } from '@/services/api';
import {
    setDevice,
    setDeviceLoading,
    setDeviceError,
    setJWTToken,
    clearDevice,
} from '../slices/deviceSlice';
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
      // Get token from localStorage if available
      const token = localStorage.getItem('jwt_token');
      if (token) {
        yield put(setJWTToken(token));
        setToken(token);
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
    
    const response: { device: Device; token: string } = yield call(
      registerDeviceMutation,
      action.payload
    );
    
    yield put(setDevice(response.device));
    yield put(setJWTToken(response.token));
    setToken(response.token);
  } catch (error) {
    log.error('Failed to register device', error);
    yield put(setDeviceError(error instanceof Error ? error.message : 'Failed to register device'));
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
  yield watchFetchDevice();
  yield watchRegisterDevice();
  yield watchUpdateDevice();
  yield watchClearDevice();
}
