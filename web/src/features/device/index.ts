/**
 * Device Feature Module
 * Public API exports for the device feature
 */

// Hooks
export { useDevice } from "./hooks/useDevice";

// Services
export { registerDeviceMutation, fetchDevice, updateDeviceNickname } from "./services/device-service";
export { getOrCreateDeviceId, setDeviceId, getDeviceId } from "./services/device-storage";
export { getBatteryStatus, subscribeToBatteryStatus } from "./services/device-status";

// Store
export { default as deviceSlice, setDevice, setDeviceLoading, setDeviceError, setJWTToken } from "./store/slice";
export { deviceSaga, fetchDeviceAction, registerDeviceAction, updateDeviceAction } from "./store/saga";

// Types
export type * from "./types";
