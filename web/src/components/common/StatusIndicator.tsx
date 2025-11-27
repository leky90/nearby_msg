/**
 * Status Indicator Component
 * Displays a user's safety status with icon and label
 */

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { StatusType } from "../../domain/user_status";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

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

const STATUS_CONFIG: Record<
  StatusType,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  safe: {
    label: "Safe",
    icon: <CheckCircle2 className="size-4" />,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
  },
  need_help: {
    label: "Need Help",
    icon: <AlertCircle className="size-4" />,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
  },
  cannot_contact: {
    label: "Cannot Contact",
    icon: <XCircle className="size-4" />,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
  },
};

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
          config.color,
          sizeClasses[size]
        )}
      >
        <span className={config.color}>{config.icon}</span>
        <span>{config.label}</span>
      </Badge>
      {showDescription && description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  );
}
