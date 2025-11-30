import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { createAppRouter } from "./router";
import { useDeviceLocation } from "./hooks/useDeviceLocation";
import { monitorStorageQuota } from "./services/storage-quota";
import { showToast } from "./utils/toast";
import { PWAUpdateNotification } from "./components/common/PWAUpdateNotification";
import { initAppAction } from "./store/slices/appSlice";
import {
  selectInitializationStatus,
  selectOnboardingRequired,
} from "./store/slices/appSlice";
import { selectDeviceLoading } from "./store/slices/deviceSlice";
import type { RootState } from "./store";

const router = createAppRouter();

function App() {
  const dispatch = useDispatch();

  // Read initialization state from Redux
  const initializationStatus = useSelector((state: RootState) =>
    selectInitializationStatus(state)
  );
  const onboardingRequired = useSelector((state: RootState) =>
    selectOnboardingRequired(state)
  );
  const deviceLoading = useSelector((state: RootState) =>
    selectDeviceLoading(state)
  );

  // Initialize app on mount - dispatch action to saga
  useEffect(() => {
    dispatch(initAppAction());
  }, [dispatch]);

  // Sync device location from localStorage to app store
  useDeviceLocation();

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

  // Show onboarding if required
  if (
    onboardingRequired &&
    initializationStatus === "ready" &&
    !deviceLoading
  ) {
    return (
      <ErrorBoundary>
        <OnboardingScreen
          onComplete={async () => {
            // Onboarding completion is handled by saga
            // Device registration will trigger device fetch, which will trigger service startup
          }}
        />
        <Toaster />
      </ErrorBoundary>
    );
  }

  // Show loading state while initializing or loading device
  if (
    initializationStatus === "checking" ||
    initializationStatus === "loading" ||
    deviceLoading
  ) {
    return (
      <ErrorBoundary>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Đang tải...</div>
        </div>
        <Toaster />
      </ErrorBoundary>
    );
  }

  // Show error state if initialization failed
  if (initializationStatus === "error") {
    return (
      <ErrorBoundary>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">
            Lỗi khởi tạo ứng dụng. Vui lòng tải lại trang.
          </div>
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
