/**
 * PWA Update Prompt Component
 * Shows a user-friendly notification when a new version is available
 * Uses vite-plugin-pwa's built-in update mechanism
 */

import { useEffect, useState, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { log } from "@/lib/logging/logger";

interface PWAUpdatePromptProps {
  className?: string;
}

/**
 * PWA Update Prompt Component
 * Displays a banner when a new version is available
 */
export function PWAUpdatePrompt({ className }: PWAUpdatePromptProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const isReloadingRef = useRef(false); // Prevent multiple reloads

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
      // Don't check if we're already updating or reloading
      if (isReloadingRef.current || isUpdating) {
        return;
      }

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
                !isReloadingRef.current
              ) {
                // New service worker is installed and waiting
                setUpdateAvailable(true);
                setNeedRefresh(true);
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
          !isReloadingRef.current
        ) {
          setUpdateAvailable(true);
          setNeedRefresh(true);
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
      // Only reload once
      if (!isReloadingRef.current) {
        isReloadingRef.current = true;
        // Mark that we're updating to prevent immediate re-check after reload
        sessionStorage.setItem("pwa-just-updated", "true");
        // Service worker has been activated, reload to get new version
        window.location.reload();
      }
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
  }, [isUpdating]);

  const handleUpdate = async () => {
    if (!needRefresh || isReloadingRef.current || isUpdating) {
      return;
    }

    setIsUpdating(true);
    isReloadingRef.current = true; // Prevent multiple updates
    // Mark that we're updating to prevent immediate re-check after reload
    sessionStorage.setItem("pwa-just-updated", "true");

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        // Tell the waiting service worker to skip waiting
        registration.waiting.postMessage({ type: "SKIP_WAITING" });

        // Set a timeout as fallback in case controllerchange doesn't fire
        // The controllerchange event should fire first and reload, so this is just a safety net
        setTimeout(() => {
          // Only reload if we haven't already (controllerchange should have handled it)
          // Check if we're still in the same page context and still need to reload
          if (
            isReloadingRef.current &&
            document.visibilityState === "visible"
          ) {
            window.location.reload();
          }
        }, 500);
      } else {
        // No waiting worker, reload immediately
        window.location.reload();
      }
    } catch (err) {
      log.error("Failed to update", err);
      setIsUpdating(false);
      isReloadingRef.current = false;
      // Fallback: reload anyway
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    // Show again after 1 hour
    setTimeout(
      () => {
        if (needRefresh) {
          setUpdateAvailable(true);
        }
      },
      60 * 60 * 1000
    );
  };

  if (!updateAvailable || !needRefresh) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md",
        "bg-background border border-primary/20 shadow-lg rounded-lg",
        "p-4 flex items-center gap-3 animate-in slide-in-from-bottom-5",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="size-4 text-primary" />
          <span className="font-semibold text-sm">Có bản cập nhật mới</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Phiên bản mới đã sẵn sàng. Cập nhật để có trải nghiệm tốt nhất.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={handleUpdate}
          isDisabled={isUpdating}
          className="h-8 px-3 text-xs"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="size-3 mr-1.5 animate-spin" />
              Đang cập nhật...
            </>
          ) : (
            <>
              <RefreshCw className="size-3 mr-1.5" />
              Cập nhật ngay
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-8 w-8 p-0"
          aria-label="Để sau"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
