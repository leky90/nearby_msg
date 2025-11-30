import { call, put, takeEvery, take, select, fork, all } from 'redux-saga/effects';
import { getDeviceId, getToken } from '@/services/device-storage';
import { startReplication } from '@/services/replication';
import { connectWebSocketAction } from './websocketSaga';
import { fetchDeviceAction } from './deviceSaga';
import {
  setInitializationStatus,
  setOnboardingRequired,
} from '../slices/appSlice';
import { selectDevice } from '../slices/deviceSlice';
import { log } from '@/lib/logging/logger';

// Action types (must match action creators in appSlice)
const INIT_APP = 'app/init';
const CHECK_DEVICE = 'app/checkDevice';
const START_SERVICES = 'app/startServices';

/**
 * Initialize app - checks for device and token, then fetches device if available
 */
function* initApp(): Generator<unknown, void, unknown> {
  try {
    log.info('App initialization started');
    yield put(setInitializationStatus({ status: 'checking' }));
    
    // Check localStorage for device_id and token
    const deviceId = yield call(getDeviceId);
    const token = yield call(getToken);
    
    if (deviceId && token) {
      // Both exist, fetch device
      yield put(setInitializationStatus({ status: 'loading' }));
      yield put(fetchDeviceAction());
      
      // Wait for device fetch to complete (wait for setDevice or setDeviceError action)
      // Redux Toolkit generates action types as 'sliceName/reducerName'
      const result = (yield take((action: { type: string }) => 
        action.type === 'device/setDevice' || action.type === 'device/setDeviceError'
      )) as unknown as { type: string };
      
      if (result.type === 'device/setDevice') {
        const device = (yield select(selectDevice)) as unknown as ReturnType<typeof selectDevice>;
        
        if (device?.nickname) {
          // Device has nickname, start services
          yield put({ type: START_SERVICES });
          yield put(setInitializationStatus({ status: 'ready' }));
        } else {
          // Device exists but no nickname, needs onboarding
          yield put(setOnboardingRequired(true));
          yield put(setInitializationStatus({ status: 'ready' }));
        }
      } else {
        // Device fetch failed, needs onboarding
        yield put(setOnboardingRequired(true));
        yield put(setInitializationStatus({ status: 'ready' }));
      }
    } else {
      // No device_id or token, needs onboarding
      yield put(setOnboardingRequired(true));
      yield put(setInitializationStatus({ status: 'ready' }));
    }
  } catch (error) {
    log.error('App initialization failed', error);
    yield put(setInitializationStatus({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'App initialization failed' 
    }));
  }
}

/**
 * Check device registration status
 */
function* checkDevice(): Generator<unknown, void, unknown> {
  try {
    const deviceId = yield call(getDeviceId);
    const token = yield call(getToken);
    
    if (deviceId && token) {
      yield put(fetchDeviceAction());
    } else {
      yield put(setOnboardingRequired(true));
    }
  } catch (error) {
    log.error('Device check failed', error);
    yield put(setOnboardingRequired(true));
  }
}

/**
 * Start services (replication and WebSocket) after device is registered
 */
function* startServices(): Generator<unknown, void, unknown> {
  try {
    log.info('Starting app services');
    
    // Start replication
    yield call(startReplication);
    
    // Connect WebSocket
    yield put(connectWebSocketAction());
    
    log.info('App services started successfully');
  } catch (error) {
    log.error('Failed to start services', error);
    // Don't set error state here - services can retry
  }
}

// Watchers
function* watchInitApp() {
  yield takeEvery(INIT_APP, initApp);
}

function* watchCheckDevice() {
  yield takeEvery(CHECK_DEVICE, checkDevice);
}

function* watchStartServices() {
  yield takeEvery(START_SERVICES, startServices);
}

// Root saga
export function* appSaga() {
  yield all([
    fork(watchInitApp),
    fork(watchCheckDevice),
    fork(watchStartServices),
  ]);
}
