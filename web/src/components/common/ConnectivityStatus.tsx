/**
 * Connectivity Status Component
 * Displays current network connectivity status
 */

import { useState, useEffect } from "react";
import { Wifi, WifiOff, Gauge } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { getNetworkStatus, subscribeToNetworkStatus, type NetworkStatus } from "../../services/network-status";
import { t } from "@/lib/i18n";

export interface ConnectivityStatusProps {
  /** Custom className */
  className?: string;
  /** Show detailed status text */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Connectivity Status component
 * Shows current network connectivity with icon and optional label
 */
export function ConnectivityStatus({
  className = "",
  showLabel = true,
  size = "md",
}: ConnectivityStatusProps) {
  const [status, setStatus] = useState<NetworkStatus>(getNetworkStatus());

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const getIcon = () => {
    switch (status) {
      case "offline":
        return <WifiOff className={cn("text-muted-semantic", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} />;
      case "slow":
        return <Gauge className={cn("text-warning", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} />;
      default:
        return <Wifi className={cn("text-safety", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case "offline":
        return t("component.connectivityStatus.offline");
      case "slow":
        return t("component.connectivityStatus.syncing");
      default:
        return t("component.connectivityStatus.online");
    }
  };

  const getVariant = (): "default" | "secondary" | "destructive" | "outline" | "safe" | "warning" => {
    switch (status) {
      case "offline":
        return "outline";
      case "slow":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <Badge
      variant={getVariant()}
      className={cn("flex items-center gap-1.5", className)}
    >
      {getIcon()}
      {showLabel && <span className="text-xs">{getLabel()}</span>}
    </Badge>
  );
}

