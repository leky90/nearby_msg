/**
 * Hook for managing location input state and logic
 * Handles GPS location, Google Maps URL parsing, and manual input
 */

import { useState, useCallback, useEffect } from "react";
import { getCurrentLocation, isGeolocationAvailable } from "@/features/groups/services/location-service";
import { parseGoogleMapsUrl } from "@/shared/utils/google-maps";
import { reverseGeocode } from "@/features/groups/services/geocoding-service";
import { useSelector, useDispatch } from "react-redux";
import { selectDeviceLocation, setDeviceLocation, updateDeviceLocationAddress } from "@/features/navigation/store/appSlice";
import type { RootState } from "@/store";
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

export function useLocationInput(options: UseLocationInputOptions = {}) {
  const {
    onLocationSet,
  } = options;

  const dispatch = useDispatch();
  const deviceLocation = useSelector((state: RootState) => selectDeviceLocation(state));
  const [location, setLocation] = useState<Location | null>(
    deviceLocation ? { latitude: deviceLocation.latitude, longitude: deviceLocation.longitude } : null
  );
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [isParsingUrl, setIsParsingUrl] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Sync with app store on mount (only if location is not explicitly set to null)
  // This allows reset() to work properly
  const [hasBeenReset, setHasBeenReset] = useState(false);
  
  useEffect(() => {
    if (deviceLocation && !location && !hasBeenReset) {
      setLocation({
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
      });
    }
  }, [deviceLocation, location, hasBeenReset]);

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
      if (loc) {
        const newLocation = {
          latitude: loc.latitude,
          longitude: loc.longitude,
        };
        
        // Check if location actually changed (to avoid unnecessary toasts)
        const locationChanged = 
          !deviceLocation ||
          Math.abs(deviceLocation.latitude - newLocation.latitude) > 0.0001 ||
          Math.abs(deviceLocation.longitude - newLocation.longitude) > 0.0001;
        
        setLocation(newLocation);
        setShowManualInput(false);
        
        // Update app store (always sync to app store)
        const deviceLocationData = {
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          updatedAt: new Date().toISOString(),
        };
        dispatch(setDeviceLocation(deviceLocationData));
        
        // Try to get address via reverse geocoding
        reverseGeocode(newLocation.latitude, newLocation.longitude)
          .then((address) => {
            if (address) {
              dispatch(updateDeviceLocationAddress(address));
            }
          })
          .catch((err) => {
            log.error("Failed to reverse geocode", err, { latitude: newLocation.latitude, longitude: newLocation.longitude });
          });
        
        onLocationSet?.(newLocation);
        
        // Only show toast if location actually changed AND showSuccessToast is true
        // This prevents duplicate toasts when called from multiple places
        if (locationChanged && showSuccessToast) {
          showToast("Đã cập nhật vị trí từ GPS thành công!", "success");
        }
      } else {
        setLocationError(
          "Không thể lấy vị trí. Vui lòng thử lại hoặc nhập thủ công."
        );
        setShowManualInput(true);
      }
    } catch (err) {
      log.error("Failed to get GPS location", err);
      setLocationError(
        "Lỗi khi lấy vị trí từ GPS. Vui lòng thử lại hoặc nhập thủ công."
      );
      setShowManualInput(true);
    } finally {
      setIsLoadingLocation(false);
    }
  }, [onLocationSet, dispatch, deviceLocation]);

  const handleGoogleMapsUrlChange = useCallback((value: string) => {
    setGoogleMapsUrl(value);
    setLocationError(null);
    if (location) setLocation(null);
  }, [location]);

  const handleParseGoogleMapsUrl = useCallback(async () => {
    if (!googleMapsUrl.trim()) {
      setLocationError("Vui lòng nhập link Google Maps hoặc tọa độ (lat,lng)");
      return;
    }

    setIsParsingUrl(true);
    setLocationError(null);
    if (location) setLocation(null);

    try {
      const parsed = parseGoogleMapsUrl(googleMapsUrl);
      if (parsed) {
        setLocation(parsed);
        
        // Update app store (always sync to app store)
        const deviceLocationData = {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          updatedAt: new Date().toISOString(),
        };
        dispatch(setDeviceLocation(deviceLocationData));
        
        // Try to get address via reverse geocoding
        reverseGeocode(parsed.latitude, parsed.longitude)
          .then((address) => {
            if (address) {
              dispatch(updateDeviceLocationAddress(address));
            }
          })
          .catch((err) => {
            log.error("Failed to reverse geocode", err, { latitude: parsed.latitude, longitude: parsed.longitude });
          });
        
        onLocationSet?.(parsed);
        showToast("Đã cập nhật tọa độ từ link Google Maps thành công!", "success");
        setShowManualInput(false);
        setGoogleMapsUrl("");
      } else {
        setLocationError(
          "Không thể trích xuất tọa độ từ link. Vui lòng kiểm tra định dạng hoặc nhập thủ công."
        );
        setLocation(null);
      }
    } catch (err) {
      log.error("Failed to parse Google Maps URL", err, { url: googleMapsUrl });
      setLocationError("Lỗi khi xử lý link. Vui lòng thử lại.");
      setLocation(null);
    } finally {
      setIsParsingUrl(false);
    }
  }, [googleMapsUrl, location, onLocationSet, dispatch]);

  const handleShowManualInput = useCallback(() => {
    setShowManualInput(true);
    setLocation(null);
    setGoogleMapsUrl("");
  }, []);

  const reset = useCallback(() => {
    setLocation(null);
    setShowManualInput(false);
    setGoogleMapsUrl("");
    setLocationError(null);
    setIsLoadingLocation(false);
    setIsParsingUrl(false);
    setHasBeenReset(true);
    
    // Clear from app store
    dispatch(setDeviceLocation(null));
  }, [dispatch]);

  return {
    location,
    isLoadingLocation,
    showManualInput,
    googleMapsUrl,
    isParsingUrl,
    locationError,
    setLocation,
    setShowManualInput,
    handleRequestGPS,
    handleGoogleMapsUrlChange,
    handleParseGoogleMapsUrl,
    handleShowManualInput,
    reset,
  };
}

export type UseLocationInputReturn = ReturnType<typeof useLocationInput>;
