/**
 * Device Status Component
 * Displays battery and GPS status
 */

import { useState, useEffect } from "react";
import { Battery, BatteryCharging, MapPin, MapPinOff } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import {
  getBatteryStatus,
  getGPSStatus,
  subscribeToBatteryStatus,
  subscribeToGPSStatus,
  type BatteryStatus,
  type GPSStatus,
} from "@/services/device-status";

export interface DeviceStatusProps {
  /** Custom className */
  className?: string;
  /** Show labels */
  showLabels?: boolean;
}

/**
 * Device Status component
 * Shows battery level and GPS permission status
 */
export function DeviceStatus({
  className = "",
  showLabels = true,
}: DeviceStatusProps) {
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  const [gpsStatus, setGPSStatus] = useState<GPSStatus>("prompt");

  useEffect(() => {
    // Initial load
    getBatteryStatus().then(setBattery);
    getGPSStatus().then(setGPSStatus);

    // Subscribe to changes
    const cleanupBattery = subscribeToBatteryStatus(setBattery);
    const cleanupGPS = subscribeToGPSStatus(setGPSStatus);

    return () => {
      cleanupBattery();
      cleanupGPS();
    };
  }, []);

  const getBatteryIcon = () => {
    if (!battery || !battery.available) {
      return null;
    }

    if (battery.charging) {
      return <BatteryCharging className="w-3.5 h-3.5" />;
    }

    return <Battery className="w-3.5 h-3.5" />;
  };

  const getBatteryColor = () => {
    if (!battery || !battery.available) {
      return "text-muted-foreground/70";
    }

    if (battery.charging) {
      return "text-safety font-semibold";
    }

    if (battery.level <= 0.2) {
      return "text-destructive font-semibold";
    }

    if (battery.level <= 0.5) {
      return "text-warning font-semibold";
    }

    return "text-safety font-semibold";
  };

  const getBatteryLevel = () => {
    if (!battery || !battery.available) {
      return null;
    }
    return Math.round(battery.level * 100);
  };

  const getGPSIcon = () => {
    if (gpsStatus === "granted") {
      return <MapPin className="w-3.5 h-3.5" />;
    }
    return <MapPinOff className="w-3.5 h-3.5" />;
  };

  const getGPSColor = () => {
    switch (gpsStatus) {
      case "granted":
        return "text-safety font-semibold";
      case "denied":
        return "text-destructive font-semibold";
      case "prompt":
        return "text-warning font-semibold";
      default:
        return "text-muted-foreground/70 font-semibold";
    }
  };

  const getGPSLabel = () => {
    switch (gpsStatus) {
      case "granted":
        return "GPS";
      case "denied":
        return "GPS";
      case "prompt":
        return "GPS";
      default:
        return "GPS";
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Battery Status */}
      {battery && battery.available && (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1 px-2 py-0.5",
            "bg-background/80 border-border/70 backdrop-blur-sm",
            getBatteryColor(),
            "shadow-sm"
          )}
        >
          {getBatteryIcon()}
          {showLabels && (
            <span className="text-xs font-semibold">{getBatteryLevel()}%</span>
          )}
        </Badge>
      )}

      {/* GPS Status */}
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-1 px-2 py-0.5",
          "bg-background/80 border-border/70 backdrop-blur-sm",
          getGPSColor(),
          "shadow-sm"
        )}
      >
        {getGPSIcon()}
        {showLabels && (
          <span className="text-xs font-semibold">{getGPSLabel()}</span>
        )}
      </Badge>
    </div>
  );
}
