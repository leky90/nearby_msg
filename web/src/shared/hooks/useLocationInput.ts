/**
 * Hook for managing location input state and logic
 * Handles GPS location, Google Maps URL parsing, and manual input
 */

import { useState, useCallback } from "react";
import { getCurrentLocation, isGeolocationAvailable } from "@/features/groups/services/location-service";
import { parseGoogleMapsUrl } from "@/shared/utils/google-maps";
import { reverseGeocode } from "@/features/groups/services/geocoding-service";
import { useSelector, useDispatch } from "react-redux";
import { selectDeviceLocation, setDeviceLocation, updateDeviceLocationAddress } from "@/features/navigation/store/appSlice";
import type { RootState, AppDispatch } from "@/store";
import { showToast } from "@/shared/utils/toast";
import { log } from "@/shared/lib/logging/logger";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface UseLocationInputOptions {
  /** Callback when location is successfully set */
  onLocationSet?: (location: Location) => void;
}

// Constants
const LOCATION_CHANGE_THRESHOLD = 0.0001;

// Helper functions (DRY principle)
const createDeviceLocationData = (location: Location) => ({
  latitude: location.latitude,
  longitude: location.longitude,
  updatedAt: new Date().toISOString(),
});

const hasLocationChanged = (
  oldLocation: { latitude: number; longitude: number } | null,
  newLocation: Location
): boolean => {
  if (!oldLocation) return true;
  return (
    Math.abs(oldLocation.latitude - newLocation.latitude) > LOCATION_CHANGE_THRESHOLD ||
    Math.abs(oldLocation.longitude - newLocation.longitude) > LOCATION_CHANGE_THRESHOLD
  );
};

// Helper function - not a hook, so we use a simple function type
const updateLocationWithGeocoding = (
  location: Location,
  dispatch: AppDispatch,
  onLocationSet?: (location: Location) => void
) => {
  const deviceLocationData = createDeviceLocationData(location);
  dispatch(setDeviceLocation(deviceLocationData));

  // Try to get address via reverse geocoding (fire-and-forget)
  reverseGeocode(location.latitude, location.longitude)
    .then((address) => {
      if (address) {
        dispatch(updateDeviceLocationAddress(address));
      }
    })
    .catch((err) => {
      log.error("Failed to reverse geocode", err, {
        latitude: location.latitude,
        longitude: location.longitude,
      });
    });

  onLocationSet?.(location);
};

export function useLocationInput(options: UseLocationInputOptions = {}) {
  const {
    onLocationSet,
  } = options;

  const dispatch = useDispatch<AppDispatch>();
  const deviceLocation = useSelector((state: RootState) => selectDeviceLocation(state));
  
  // Derive location from Redux state instead of maintaining local state
  const location: Location | null = deviceLocation
    ? { latitude: deviceLocation.latitude, longitude: deviceLocation.longitude }
    : null;
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [isParsingUrl, setIsParsingUrl] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const clearLocation = useCallback(() => {
    if (deviceLocation) {
      dispatch(setDeviceLocation(null));
    }
  }, [deviceLocation, dispatch]);

  const handleRequestGPS = useCallback(async (showSuccessToast = true) => {
    if (!isGeolocationAvailable()) {
      setLocationError("Trình duyệt của bạn không hỗ trợ GPS.");
      setShowManualInput(true);
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const loc = await getCurrentLocation();
      if (!loc) {
        setLocationError("Không thể lấy vị trí. Vui lòng thử lại hoặc nhập thủ công.");
        setShowManualInput(true);
        return;
      }

      const newLocation: Location = {
        latitude: loc.latitude,
        longitude: loc.longitude,
      };

      const locationChanged = hasLocationChanged(deviceLocation, newLocation);
      setShowManualInput(false);

      updateLocationWithGeocoding(newLocation, dispatch, onLocationSet);

      if (locationChanged && showSuccessToast) {
        showToast("Đã cập nhật vị trí từ GPS thành công!", "success");
      }
    } catch (err) {
      log.error("Failed to get GPS location", err);
      setLocationError("Lỗi khi lấy vị trí từ GPS. Vui lòng thử lại hoặc nhập thủ công.");
      setShowManualInput(true);
    } finally {
      setIsLoadingLocation(false);
    }
  }, [onLocationSet, dispatch, deviceLocation]);

  const handleGoogleMapsUrlChange = useCallback((value: string) => {
    setGoogleMapsUrl(value);
    setLocationError(null);
    clearLocation();
  }, [clearLocation]);

  const handleParseGoogleMapsUrl = useCallback(async () => {
    if (!googleMapsUrl.trim()) {
      setLocationError("Vui lòng nhập link Google Maps hoặc tọa độ (lat,lng)");
      return;
    }

    setIsParsingUrl(true);
    setLocationError(null);
    clearLocation();

    try {
      const parsed = parseGoogleMapsUrl(googleMapsUrl);
      if (!parsed) {
        setLocationError(
          "Không thể trích xuất tọa độ từ link. Vui lòng kiểm tra định dạng hoặc nhập thủ công."
        );
        return;
      }

      updateLocationWithGeocoding(parsed, dispatch, onLocationSet);
      showToast("Đã cập nhật tọa độ từ link Google Maps thành công!", "success");
      setShowManualInput(false);
      setGoogleMapsUrl("");
    } catch (err) {
      log.error("Failed to parse Google Maps URL", err, { url: googleMapsUrl });
      setLocationError("Lỗi khi xử lý link. Vui lòng thử lại.");
    } finally {
      setIsParsingUrl(false);
    }
  }, [googleMapsUrl, clearLocation, onLocationSet, dispatch]);

  const handleShowManualInput = useCallback(() => {
    setShowManualInput(true);
    clearLocation();
    setGoogleMapsUrl("");
  }, [clearLocation]);

  const reset = useCallback(() => {
    setShowManualInput(false);
    setGoogleMapsUrl("");
    setLocationError(null);
    setIsLoadingLocation(false);
    setIsParsingUrl(false);
    clearLocation();
  }, [clearLocation]);

  return {
    location,
    isLoadingLocation,
    showManualInput,
    googleMapsUrl,
    isParsingUrl,
    locationError,
    setShowManualInput,
    handleRequestGPS,
    handleGoogleMapsUrlChange,
    handleParseGoogleMapsUrl,
    handleShowManualInput,
    reset,
  };
}

export type UseLocationInputReturn = ReturnType<typeof useLocationInput>;
