import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { createAppRouter } from "./router";
import { useDevice } from "./hooks/useDevice";
import { monitorStorageQuota } from "./services/storage-quota";
import { showToast } from "./utils/toast";
import { startReplication } from "./services/replication";
import { getDeviceId } from "./services/device-storage";

const router = createAppRouter();

function App() {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [shouldFetchDevice, setShouldFetchDevice] = useState(false);

  // Check if device is already registered (has device ID and token)
  useEffect(() => {
    const deviceId = getDeviceId();
    const token = localStorage.getItem("jwt_token");
    // If we have device ID and token, we can try to fetch device
    if (deviceId && token) {
      setShouldFetchDevice(true);
    } else {
      // No device ID or token - needs onboarding
      setShouldFetchDevice(false);
      setOnboardingComplete(false);
    }
  }, []);

  // Initialize device registration only if we should fetch
  const { device, loading: deviceLoading } = useDevice(shouldFetchDevice);

  // Check if device has nickname (onboarding complete)
  useEffect(() => {
    if (device?.nickname) {
      // Device exists and has nickname - onboarding complete
      setOnboardingComplete(true);
      // Start replication after device is confirmed
      const token = localStorage.getItem("jwt_token");
      if (token) {
        startReplication();
      }
    } else if (!deviceLoading && shouldFetchDevice && !device) {
      // Device not found or has no nickname - needs onboarding
      // Only reset if we actually tried to fetch but got nothing
      setOnboardingComplete(false);
      setShouldFetchDevice(false);
    }
  }, [device, deviceLoading, shouldFetchDevice]);

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

  // Show onboarding if device doesn't have nickname
  if (!onboardingComplete && !deviceLoading) {
    return (
      <ErrorBoundary>
        <OnboardingScreen
          onComplete={async () => {
            // Enable device fetching after registration
            setShouldFetchDevice(true);
            // Start replication after successful registration
            startReplication();
            // Note: onboardingComplete will be set to true when device is fetched and has nickname
          }}
        />
        <Toaster />
      </ErrorBoundary>
    );
  }

  // Show loading state while checking device
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

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
