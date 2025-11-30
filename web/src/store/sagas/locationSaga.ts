import { call, put, takeEvery, fork, select } from 'redux-saga/effects';
import { getCurrentLocation } from '@/services/location-service';
import { reverseGeocode } from '@/services/geocoding-service';
import { setDeviceLocation, updateDeviceLocationAddress } from '../slices/appSlice';
import { log } from '@/lib/logging/logger';
import type { DeviceLocation } from '../slices/appSlice';

// Action types
const FETCH_GPS_LOCATION = 'location/fetchGPSLocation';
const MIGRATE_DEVICE_LOCATION = 'location/migrateDeviceLocation';

// Action creators
export const fetchGPSLocationAction = () => ({ type: FETCH_GPS_LOCATION });
export const migrateDeviceLocationAction = () => ({ type: MIGRATE_DEVICE_LOCATION });

// Sagas
function* watchFetchGPSLocation() {
  yield takeEvery(FETCH_GPS_LOCATION, handleFetchGPSLocation);
}

function* handleFetchGPSLocation() {
  try {
    const location: { latitude: number; longitude: number; accuracy?: number; timestamp: number } | null = yield call(getCurrentLocation);
    
    if (location) {
      const deviceLocation: DeviceLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        updatedAt: new Date().toISOString(),
      };
      yield put(setDeviceLocation(deviceLocation));
      
      // Get address via reverse geocoding (async, non-blocking)
      yield fork(handleReverseGeocode, location.latitude, location.longitude);
    } else {
      // Location unavailable - set to null
      yield put(setDeviceLocation(null));
    }
  } catch (error) {
    log.error('Failed to fetch GPS location', error);
    yield put(setDeviceLocation(null));
  }
}

/**
 * Handle reverse geocoding for a location
 */
function* handleReverseGeocode(latitude: number, longitude: number) {
  try {
    const address: string | null = yield call(reverseGeocode, latitude, longitude);
    if (address) {
      yield put(updateDeviceLocationAddress(address));
    }
  } catch (error) {
    log.error('Failed to reverse geocode', error, { latitude, longitude });
    // Don't set error state - address is optional
  }
}

/**
 * Migrate device location from localStorage to Redux on app init
 */
function* watchMigrateDeviceLocation() {
  yield takeEvery(MIGRATE_DEVICE_LOCATION, handleMigrateDeviceLocation);
}

function* handleMigrateDeviceLocation(): Generator<unknown, void, unknown> {
  try {
    // Check if location already exists in Redux
    const state = (yield select()) as unknown as { app?: { deviceLocation?: unknown } };
    const existingLocation = state.app?.deviceLocation;
    
    if (existingLocation) {
      // Already migrated, skip
      return;
    }
    
    // Try to load from localStorage (backward compatibility)
    const savedLocation = localStorage.getItem('device_location');
    if (savedLocation) {
      try {
        const loc = JSON.parse(savedLocation);
        if (loc.latitude && loc.longitude) {
          // Migrate to app store
          const deviceLocationData: DeviceLocation = {
            latitude: loc.latitude,
            longitude: loc.longitude,
            updatedAt: new Date().toISOString(),
          };
          yield put(setDeviceLocation(deviceLocationData));
          
          // Get address via reverse geocoding (async, non-blocking)
          yield fork(handleReverseGeocode, loc.latitude, loc.longitude);
        }
      } catch (err) {
        log.error('Failed to parse saved location', err);
      }
    }
  } catch (error) {
    log.error('Failed to migrate device location', error);
  }
}

// Root saga
export function* locationSaga() {
  yield watchFetchGPSLocation();
  yield watchMigrateDeviceLocation();
}
