import { call, put, takeEvery, take, select, fork, all, cancelled } from 'redux-saga/effects';
import { eventChannel, type EventChannel } from 'redux-saga';
import { getDeviceId, getToken } from '@/features/device/services/device-storage';
import { startReplication } from "@/features/replication/services/replication";
import { connectWebSocketAction } from '@/features/websocket/store/saga';
import { fetchDeviceAction } from '@/features/device/store/saga';
import { getGPSStatus } from '@/features/device/services/device-status';
import {
    setInitializationStatus,
    setOnboardingRequired,
    setServicesStarted,
    setGPSStatus,
    setNetworkStatus,
    selectInitializationStatus,
    selectServicesStarted,
    selectUserStatus,
} from './appSlice';
import { selectDevice } from '@/features/device/store/slice';
import { fetchUserStatusAction } from '@/features/status/store/statusSaga';
import { getNetworkStatus, subscribeToNetworkStatus, type NetworkStatus } from '@/shared/services/network-status';
import { log } from "@/shared/lib/logging/logger";
import type { RootState } from '@/store';

// Action types (must match action creators in appSlice)
const INIT_APP = 'app/init';
const CHECK_DEVICE = 'app/checkDevice';
const START_SERVICES = 'app/startServices';
const CHECK_GPS_STATUS = 'app/checkGPSStatus';

/**
 * Initialize app - checks for device and token, then fetches device if available
 */
function* initApp(): Generator<unknown, void, unknown> {
  try {
    // Guard: Skip if already initialized (prevents duplicate calls from StrictMode)
    const currentStatus = (yield select((state: RootState) => 
      selectInitializationStatus(state)
    )) as unknown as ReturnType<typeof selectInitializationStatus>;
    
    if (currentStatus !== 'idle' && currentStatus !== 'error') {
      log.debug('App already initializing or initialized, skipping');
      return;
    }
    
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
    // Guard: Skip if services already started (prevents duplicate calls)
    const servicesStarted = (yield select((state: RootState) => 
      selectServicesStarted(state)
    )) as unknown as ReturnType<typeof selectServicesStarted>;
    
    if (servicesStarted) {
      log.debug('Services already started, skipping');
      return;
    }
    
    log.info('Starting app services');
    
    // Mark services as started before starting them (prevents race conditions)
    yield put(setServicesStarted(true));
    
    // Start replication
    yield call(startReplication);
    
    // Connect WebSocket
    yield put(connectWebSocketAction());
    
    log.info('App services started successfully');
  } catch (error) {
    log.error('Failed to start services', error);
    // Reset servicesStarted flag on error so it can be retried
    yield put(setServicesStarted(false));
    // Don't set error state here - services can retry
  }
}

/**
 * Check GPS permission status
 */
function* checkGPSStatus(): Generator<unknown, void, unknown> {
  try {
    const status = (yield call(getGPSStatus)) as 'granted' | 'denied' | 'prompt' | 'unavailable';
    yield put(setGPSStatus(status));
  } catch (error) {
    log.error('Failed to check GPS status', error);
    // Set to unavailable on error
    yield put(setGPSStatus('unavailable'));
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

function* watchCheckGPSStatus() {
  yield takeEvery(CHECK_GPS_STATUS, checkGPSStatus);
}

/**
 * Monitor network status and sync to Redux
 * Forks a separate saga to continuously monitor network status changes
 */
function* watchNetworkStatus() {
  try {
    // Set initial network status
    const initialStatus: NetworkStatus = yield call(getNetworkStatus);
    yield put(setNetworkStatus(initialStatus));

    // Create event channel for network status changes
    const channel: EventChannel<NetworkStatus> = yield call(createNetworkStatusEventChannel);

    try {
      while (true) {
        const status: NetworkStatus = yield take(channel);
        yield put(setNetworkStatus(status));
        log.debug('Network status updated', { status });
      }
    } finally {
      const isCancelled: boolean = (yield cancelled()) as unknown as boolean;
      if (isCancelled) {
        channel.close();
        log.debug('Network status monitoring stopped');
      }
    }
  } catch (error) {
    log.error('Failed to setup network status monitoring', error);
  }
}

/**
 * Create event channel for network status subscription
 */
function createNetworkStatusEventChannel(): EventChannel<NetworkStatus> {
  return eventChannel<NetworkStatus>((emit) => {
    const unsubscribe = subscribeToNetworkStatus((status) => {
      emit(status);
    });
    return unsubscribe;
  });
}

/**
 * Initialize user status - fetch if not already in Redux
 * Forks a separate saga to fetch user status on app start
 */
function* initializeUserStatus() {
  try {
    // Check if user status already exists in Redux
    const userStatus = (yield select((state: RootState) =>
      selectUserStatus(state)
    )) as unknown as ReturnType<typeof selectUserStatus>;

    // Only fetch if not already in Redux
    if (!userStatus) {
      log.debug('User status not found in Redux, fetching...');
      yield put(fetchUserStatusAction());
    } else {
      log.debug('User status already in Redux, skipping fetch');
    }
  } catch (error) {
    log.error('Failed to initialize user status', error);
  }
}

// Root saga
export function* appSaga() {
  yield all([
    fork(watchInitApp),
    fork(watchCheckDevice),
    fork(watchStartServices),
    fork(watchCheckGPSStatus),
    fork(watchNetworkStatus), // Monitor network status
    fork(initializeUserStatus), // Initialize user status
  ]);
}
