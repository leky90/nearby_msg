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
  selectInitializationStatus,
  selectOnboardingRequired,
} from "@/features/navigation/store/appSlice";
import { selectDeviceLoading } from "@/features/device/store/slice";
import type { RootState } from "@/store";

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
  // Note: In development, React StrictMode will cause this to run twice
  // The saga has guards to prevent duplicate initialization
  useEffect(() => {
    // Only initialize if status is idle (not already initializing/initialized)
    if (initializationStatus === "idle") {
      dispatch(initAppAction());
    }
  }, [dispatch, initializationStatus]);

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
        <OnboardingScreen />
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
