/**
 * Hook to sync device location from localStorage to app store on mount
 * Migrates old localStorage data to app store
 */

import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { selectDeviceLocation, setDeviceLocation, updateDeviceLocationAddress } from "@/store/slices/appSlice";
import type { RootState } from "@/store";
import { reverseGeocode } from "@/services/geocoding-service";
import { log } from "@/lib/logging/logger";

export function useDeviceLocation() {
  const dispatch = useDispatch();
  const deviceLocation = useSelector((state: RootState) => selectDeviceLocation(state));

  useEffect(() => {
    // If no location in store, try to load from localStorage (backward compatibility)
    if (!deviceLocation) {
      const savedLocation = localStorage.getItem("device_location");
      if (savedLocation) {
        try {
          const loc = JSON.parse(savedLocation);
          if (loc.latitude && loc.longitude) {
            // Migrate to app store
            const deviceLocationData = {
              latitude: loc.latitude,
              longitude: loc.longitude,
              updatedAt: new Date().toISOString(),
            };
            dispatch(setDeviceLocation(deviceLocationData));

            // Try to get address via reverse geocoding
            reverseGeocode(loc.latitude, loc.longitude)
              .then((address) => {
                if (address) {
                  dispatch(updateDeviceLocationAddress(address));
                }
              })
              .catch((err) => {
                log.error("Failed to reverse geocode", err, { latitude: loc.latitude, longitude: loc.longitude });
              });
          }
        } catch (err) {
          log.error("Failed to parse saved location", err);
        }
      }
    }
  }, [deviceLocation, dispatch]);
}
