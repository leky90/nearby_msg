import { call, put, takeLatest, fork } from 'redux-saga/effects';
import { getCurrentLocation } from "@/features/groups/services/location-service";
import { reverseGeocode } from "@/features/groups/services/geocoding-service";
import { setDeviceLocation, updateDeviceLocationAddress } from '@/features/navigation/store/appSlice';
import { log } from "@/shared/lib/logging/logger";
import type { DeviceLocation } from '@/features/navigation/store/appSlice';

// Action types
const FETCH_GPS_LOCATION = 'location/fetchGPSLocation';

// Action creators
export const fetchGPSLocationAction = () => ({ type: FETCH_GPS_LOCATION });

// Sagas
/**
 * Watch for fetch GPS location actions
 * Uses takeLatest to cancel previous location fetches when new request comes in
 * Prevents duplicate GPS requests when called rapidly
 */
function* watchFetchGPSLocation() {
  yield takeLatest(FETCH_GPS_LOCATION, handleFetchGPSLocation);
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
 * Root location saga
 * 
 * Debouncing/Throttling Patterns:
 * - takeLatest: Used for fetchGPSLocation (cancels previous location fetches when new request comes in)
 */
export function* locationSaga() {
  yield watchFetchGPSLocation();
}
