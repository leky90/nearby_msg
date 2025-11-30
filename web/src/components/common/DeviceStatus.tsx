/**
 * Device Status Component
 * Displays battery and GPS status
 */

import { useState, useEffect } from "react";
import {
  Battery,
  BatteryCharging,
  MapPin,
  MapPinOff,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { useSelector } from "react-redux";
import { selectDeviceLocation } from "@/store/slices/appSlice";
import type { RootState } from "@/store";
import { copyCoordinates } from "@/utils/copy-coordinates";
import {
  getBatteryStatus,
  subscribeToBatteryStatus,
  type BatteryStatus,
} from "@/services/device-status";

export interface DeviceStatusProps {
  /** Custom className */
  className?: string;
  /** Show labels */
  showLabels?: boolean;
}

/**
 * Device Status component
 * Shows battery level and GPS location status (based on whether location is configured)
 */
export function DeviceStatus({
  className = "",
  showLabels = true,
}: DeviceStatusProps) {
  const deviceLocation = useSelector((state: RootState) =>
    selectDeviceLocation(state)
  );
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Initial load
    getBatteryStatus().then(setBattery);

    // Subscribe to battery changes
    const cleanupBattery = subscribeToBatteryStatus(setBattery);

    return () => {
      cleanupBattery();
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
    if (deviceLocation) {
      return <MapPin className="w-3.5 h-3.5" />;
    }
    return <MapPinOff className="w-3.5 h-3.5" />;
  };

  const getGPSColor = () => {
    if (deviceLocation) {
      return "text-safety font-semibold";
    }
    return "text-muted-foreground/70 font-semibold";
  };

  const getGPSLabel = () => {
    if (deviceLocation) {
      // Show coordinates if location is set
      return `${deviceLocation.latitude.toFixed(4)}, ${deviceLocation.longitude.toFixed(4)}`;
    }
    return "GPS";
  };

  const handleCopyCoordinates = async () => {
    if (deviceLocation) {
      await copyCoordinates(deviceLocation.latitude, deviceLocation.longitude);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          "shadow-sm",
          deviceLocation &&
            "cursor-pointer hover:bg-background/90 transition-colors"
        )}
        onClick={deviceLocation ? handleCopyCoordinates : undefined}
        title={deviceLocation ? "Click để copy tọa độ" : undefined}
      >
        {getGPSIcon()}
        {showLabels && (
          <span className="text-xs font-semibold">{getGPSLabel()}</span>
        )}
        {deviceLocation && (
          <div className="ml-0.5">
            {copied ? (
              <Check className="w-3 h-3 text-safety" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground/70" />
            )}
          </div>
        )}
      </Badge>
    </div>
  );
}
