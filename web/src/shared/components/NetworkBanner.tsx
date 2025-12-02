/**
 * Network Banner Component
 * Displays full-width network status banner below header
 */

import { Wifi, WifiOff, Gauge } from "lucide-react";
import { useSelector } from "react-redux";
import { cn } from "@/shared/lib/utils";
import { selectNetworkStatus } from "@/features/navigation/store/appSlice";
import { t } from "@/shared/lib/i18n";
import type { RootState } from "@/store";

export interface NetworkBannerProps {
  /** Custom className */
  className?: string;
}

/**
 * Network Banner component
 * Shows full-width network status banner below header
 * Reads network status from Redux store (managed by appSaga)
 */
export function NetworkBanner({ className = "" }: NetworkBannerProps) {
  const status = useSelector((state: RootState) => selectNetworkStatus(state));

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
