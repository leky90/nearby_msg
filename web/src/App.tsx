import { useEffect } from "react";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { Home } from "./pages/Home";
import { useDevice } from "./hooks/useDevice";
import { monitorStorageQuota } from "./services/storage-quota";
import { showToast } from "./utils/toast";
import "./App.css";

function App() {
  // Initialize device registration on app startup
  // This will automatically register device if not found, and store JWT token
  const { device, loading: deviceLoading, error: deviceError } = useDevice();

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

  // Log device registration status (for debugging)
  useEffect(() => {
    if (device) {
      console.log("Device registered:", device.id);
    }
    if (deviceError) {
      console.warn("Device registration error:", deviceError);
    }
  }, [device, deviceError]);

  return (
    <ErrorBoundary>
      <Home />
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
