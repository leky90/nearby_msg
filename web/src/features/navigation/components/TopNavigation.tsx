import { ConnectivityStatus } from "@/shared/components/ConnectivityStatus";
import { DeviceStatus } from "@/shared/components/DeviceStatus";
import { cn } from "@/shared/lib/utils";

interface TopNavigationProps {
  className?: string;
}

export function TopNavigation({ className }: TopNavigationProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-40",
        "bg-background/80 backdrop-blur-lg border-b",
        "pt-[env(safe-area-inset-top,0px)]",
        "h-14 w-full max-w-full",
        "overflow-x-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-2 sm:px-4 gap-2">
        {/* Network Status - Left */}
        <div className="flex items-center min-w-0 shrink-0 gap-2">
          <ConnectivityStatus size="sm" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Device Status - Right (Battery & GPS) */}
        <div className="flex items-center min-w-0 shrink-0">
          <DeviceStatus />
        </div>
      </div>
    </header>
  );
}
