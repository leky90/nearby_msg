/**
 * Network Banner Component
 * Displays full-width network status banner below header
 */

import { useState, useEffect } from "react";
import { Wifi, WifiOff, Gauge } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  getNetworkStatus,
  subscribeToNetworkStatus,
  type NetworkStatus,
} from "@/shared/services/network-status";
import { t } from "@/shared/lib/i18n";

export interface NetworkBannerProps {
  /** Custom className */
  className?: string;
}

/**
 * Network Banner component
 * Shows full-width network status banner below header
 */
export function NetworkBanner({ className = "" }: NetworkBannerProps) {
  const [status, setStatus] = useState<NetworkStatus>(getNetworkStatus());

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  // Don't show banner when online
  if (status === "online") {
    return null;
  }

  const getIcon = () => {
    switch (status) {
      case "offline":
        return <WifiOff className="h-5 w-5" />;
      case "slow":
        return <Gauge className="h-5 w-5" />;
      default:
        return <Wifi className="h-5 w-5" />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case "offline":
        return t("network.offline");
      case "slow":
        return t("network.syncing");
      default:
        return t("network.online");
    }
  };

  const getBgColor = () => {
    switch (status) {
      case "offline":
        return "bg-muted-semantic text-white";
      case "slow":
        return "bg-warning text-white";
      default:
        return "bg-safety text-white";
    }
  };

  return (
    <div
      className={cn(
        "w-full px-4 py-2 flex items-center gap-2 text-sm font-medium",
        getBgColor(),
        className
      )}
    >
      {getIcon()}
      <span>{getLabel()}</span>
    </div>
  );
}
