import { useEffect } from "react";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { Home } from "./pages/Home";
import { monitorStorageQuota } from "./services/storage-quota";
import { showToast } from "./utils/toast";
import "./App.css";

function App() {
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

  return (
    <ErrorBoundary>
      <Home />
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
