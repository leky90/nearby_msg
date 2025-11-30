/**
 * PWA Update Notification Component
 * Simple notification to inform user about updates
 * Updates happen automatically with skipWaiting: true
 * No user action required
 */

import { useEffect, useState } from "react";
import { showToast } from "@/utils/toast";
import { log } from "@/lib/logging/logger";

/**
 * PWA Update Notification Component
 * Detects service worker updates and shows a simple toast notification
 * Updates activate automatically (skipWaiting: true), so no user action needed
 */
export function PWAUpdateNotification() {
  const [hasNotified, setHasNotified] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Check if we just updated (prevent immediate re-check after reload)
    const justUpdated = sessionStorage.getItem("pwa-just-updated");
    if (justUpdated) {
      sessionStorage.removeItem("pwa-just-updated");
      // Don't check for updates immediately after an update
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let updateFoundHandler: (() => void) | null = null;

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        registration = reg;

        // Check for updates
        await registration.update();

        // Remove old listener if exists
        if (updateFoundHandler) {
          registration.removeEventListener("updatefound", updateFoundHandler);
        }

        // Listen for new service worker installing
        updateFoundHandler = () => {
          const newWorker = registration?.installing;
          if (newWorker) {
            const stateChangeHandler = () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller &&
                !hasNotified
              ) {
                // New service worker is installed and will activate automatically
                // Just notify user, no action needed
                setHasNotified(true);
                showToast(
                  "Đã có phiên bản mới. Trang sẽ tự động cập nhật...",
                  "info"
                );
                log.info("PWA update detected, will activate automatically");
              }
            };
            newWorker.addEventListener("statechange", stateChangeHandler);
          }
        };

        registration.addEventListener("updatefound", updateFoundHandler);

        // Check if there's already a waiting worker
        if (
          registration.waiting &&
          navigator.serviceWorker.controller &&
          !hasNotified
        ) {
          setHasNotified(true);
          showToast(
            "Đã có phiên bản mới. Trang sẽ tự động cập nhật...",
            "info"
          );
          log.info("PWA update waiting, will activate automatically");
        }
      } catch (err) {
        log.error("Failed to check for updates", err);
      }
    };

    // Initial check
    void checkForUpdates();

    // Check for updates every 5 minutes
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    // Listen for controller change (service worker activated)
    const handleControllerChange = () => {
      // Mark that we're updating to prevent immediate re-check after reload
      sessionStorage.setItem("pwa-just-updated", "true");
      // Service worker has been activated, reload to get new version
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
      if (registration && updateFoundHandler) {
        registration.removeEventListener("updatefound", updateFoundHandler);
      }
    };
  }, [hasNotified]);

  // This component doesn't render anything - it only shows toast notifications
  return null;
}
