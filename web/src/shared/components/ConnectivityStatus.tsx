/**
 * Connectivity Status Component
 * Displays current network connectivity status
 */

import { Wifi, WifiOff, Gauge } from "lucide-react";
import { useSelector } from "react-redux";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { selectNetworkStatus } from "@/features/navigation/store/appSlice";
import { t } from "@/shared/lib/i18n";
import type { RootState } from "@/store";

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
 * Reads network status from Redux store (managed by appSaga)
 */
export function ConnectivityStatus({
  className = "",
  showLabel = true,
  size = "md",
}: ConnectivityStatusProps) {
  const status = useSelector((state: RootState) => selectNetworkStatus(state));

  const getIcon = () => {
    switch (status) {
      case "offline":
        return (
          <WifiOff
            className={cn(
              "text-destructive",
              size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"
            )}
          />
        );
      case "slow":
        return (
          <Gauge
            className={cn(
              "text-warning",
              size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"
            )}
          />
        );
      default:
        return (
          <Wifi
            className={cn(
              "text-safety",
              size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"
            )}
          />
        );
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

  const getVariant = ():
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "safe"
    | "sos"
    | "neighborhood" => {
    switch (status) {
      case "offline":
        return "outline";
      case "slow":
        return "outline";
      default:
        return "safe"; // Use safe variant for better contrast
    }
  };

  const getBadgeClassName = () => {
    switch (status) {
      case "offline":
        return "bg-destructive/20 border-destructive/50 text-destructive font-semibold shadow-sm";
      case "slow":
        return "bg-warning/20 border-warning/50 text-warning font-semibold shadow-sm";
      default:
        return "bg-safety/20 border-safety/50 text-safety font-semibold shadow-sm"; // Better contrast for online
    }
  };

  return (
    <Badge
      variant={getVariant()}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1",
        getBadgeClassName(),
        className
      )}
    >
      {getIcon()}
      {showLabel && <span className="text-xs font-semibold">{getLabel()}</span>}
    </Badge>
  );
}
