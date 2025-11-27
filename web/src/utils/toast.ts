/**
 * Toast utility functions
 * Helper functions for showing toast notifications using Sonner
 */

import { toast } from "sonner";

export type ToastType = "success" | "error" | "info" | "warning";

/**
 * Helper function to show a toast notification
 * Can be called from anywhere in the app
 */
export function showToast(
  message: string,
  type: ToastType = "info",
  duration?: number
): void {
  const options = duration ? { duration } : undefined;

  switch (type) {
    case "success":
      toast.success(message, options);
      break;
    case "error":
      toast.error(message, options);
      break;
    case "warning":
      toast.warning(message, options);
      break;
    case "info":
    default:
      toast.info(message, options);
      break;
  }
}

