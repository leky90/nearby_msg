/**
 * Hook to sync device location from localStorage to app store on mount
 * Migrates old localStorage data to app store via saga
 */

import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { selectDeviceLocation } from "@/store/slices/appSlice";
import { migrateDeviceLocationAction } from "@/store/sagas/locationSaga";
import type { RootState } from "@/store";

export function useDeviceLocation() {
  const dispatch = useDispatch();
  const deviceLocation = useSelector((state: RootState) => selectDeviceLocation(state));

  useEffect(() => {
    // If no location in store, dispatch action to migrate from localStorage
    // Saga will handle the migration and reverse geocoding
    if (!deviceLocation) {
      dispatch(migrateDeviceLocationAction());
    }
  }, [deviceLocation, dispatch]);
}
