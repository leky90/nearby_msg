/**
 * Status Indicator Component
 * Displays a user's safety status with icon and label
 */

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { StatusType } from "../../domain/user_status";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export interface StatusIndicatorProps {
  /** Status type to display */
  statusType: StatusType;
  /** Optional description */
  description?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show description */
  showDescription?: boolean;
  /** Custom className */
  className?: string;
}

const getStatusConfig = (): Record<
  StatusType,
  { label: string; icon: React.ReactNode; color: string; bgColor: string; textColor: string }
> => ({
  safe: {
    label: t("status.safe"),
    icon: <CheckCircle2 className="size-4" />,
    color: "text-safety",
    bgColor: "bg-safety/10 border-safety/20",
    textColor: "text-safety",
  },
  need_help: {
    label: t("status.needHelp"),
    icon: <AlertCircle className="size-4" />,
    color: "text-warning",
    bgColor: "bg-warning/10 border-warning/20",
    textColor: "text-warning",
  },
  cannot_contact: {
    label: t("status.cannotContact"),
    icon: <XCircle className="size-4" />,
    color: "text-sos",
    bgColor: "bg-sos/10 border-sos/20",
    textColor: "text-sos",
  },
});

/**
 * Status Indicator component
 * Displays a user's safety status
 */
export function StatusIndicator({
  statusType,
  description,
  size = "md",
  showDescription = false,
  className = "",
}: StatusIndicatorProps) {
  const STATUS_CONFIG = getStatusConfig();
  const config = STATUS_CONFIG[statusType];
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-1.5",
          config.bgColor,
          config.textColor,
          sizeClasses[size]
        )}
      >
        <span className={config.textColor}>{config.icon}</span>
        <span>{config.label}</span>
      </Badge>
      {showDescription && description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  );
}
