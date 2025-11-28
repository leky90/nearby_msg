/**
 * Hook to sync device location from localStorage to app store on mount
 * Migrates old localStorage data to app store
 */

import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { reverseGeocode } from "@/services/geocoding-service";

export function useDeviceLocation() {
  const { deviceLocation, setDeviceLocation, updateDeviceLocationAddress } =
    useAppStore();

  useEffect(() => {
    // If no location in store, try to load from localStorage (backward compatibility)
    if (!deviceLocation) {
      const savedLocation = localStorage.getItem("device_location");
      if (savedLocation) {
        try {
          const loc = JSON.parse(savedLocation);
          if (loc.latitude && loc.longitude) {
            // Migrate to app store
            const deviceLocation = {
              latitude: loc.latitude,
              longitude: loc.longitude,
              updatedAt: new Date().toISOString(),
            };
            setDeviceLocation(deviceLocation);

            // Try to get address via reverse geocoding
            reverseGeocode(loc.latitude, loc.longitude)
              .then((address) => {
                if (address) {
                  updateDeviceLocationAddress(address);
                }
              })
              .catch((err) => {
                console.error("Failed to reverse geocode:", err);
              });
          }
        } catch (err) {
          console.error("Failed to parse saved location:", err);
        }
      }
    }
  }, [deviceLocation, setDeviceLocation, updateDeviceLocationAddress]);
}
