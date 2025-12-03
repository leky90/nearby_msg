import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { Toaster } from "@/shared/components/ui/sonner";
import { OnboardingScreen } from "@/features/onboarding/components/OnboardingScreen";
import { createAppRouter } from "./router";
import { monitorStorageQuota } from "@/shared/services/storage-quota";
import { showToast } from "@/shared/utils/toast";
import { PWAUpdateNotification } from "@/shared/components/PWAUpdateNotification";
import { initAppAction } from "@/features/navigation/store/appSlice";
import {
  selectDevice,
  selectDeviceLoading,
  selectIsRegistered,
} from "@/features/device/store/slice";
import type { RootState } from "@/store";

const router = createAppRouter();

function App() {
  const dispatch = useDispatch();

  // Read device state from Redux
  const device = useSelector((state: RootState) => selectDevice(state));
  const deviceLoading = useSelector((state: RootState) =>
    selectDeviceLoading(state)
  );
  const isRegistered = useSelector((state: RootState) =>
    selectIsRegistered(state)
  );

  // Initialize app on mount - dispatch action to saga
  // Note: In development, React StrictMode will cause this to run twice
  // The saga has guards to prevent duplicate initialization
  useEffect(() => {
    // Initialize if device is not loaded yet (not registered or loading)
    if (!isRegistered && !deviceLoading) {
      dispatch(initAppAction());
    }
  }, [dispatch, isRegistered, deviceLoading]);

  // Monitor storage quota
  useEffect(() => {
    const cleanup = monitorStorageQuota((status, message) => {
      if (message) {
        if (status === "exceeded") {
          showToast(message, "error");
        } else if (status === "critical") {
          showToast(message, "warning");
        } else if (status === "warning") {
          showToast(message, "info");
        }
      }
    });

    return cleanup;
  }, []);

  // Determine if onboarding is needed based on device state
  // Onboarding needed if:
  // 1. Device is not registered (device === null), OR
  // 2. Device exists but has no nickname (needs onboarding to set nickname)
  const needsOnboarding = !device || !device.nickname;

  // Show onboarding if needed and not loading
  if (needsOnboarding && !deviceLoading) {
    return (
      <ErrorBoundary>
        <OnboardingScreen />
        <Toaster />
      </ErrorBoundary>
    );
  }

  // Show loading state while device is loading
  if (deviceLoading) {
    return (
      <ErrorBoundary>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Đang tải...</div>
        </div>
        <Toaster />
      </ErrorBoundary>
    );
  }

  // App is ready - show main interface
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster />
      <PWAUpdateNotification />
    </ErrorBoundary>
  );
}

export default App;
