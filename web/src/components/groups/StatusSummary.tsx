/**
 * Status Summary Component
 * Displays a summary of safety statuses in a group
 */

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { StatusSummary as StatusSummaryType } from "../../services/status-service";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

export interface StatusSummaryProps {
  /** Status summary data */
  summary: StatusSummaryType;
  /** Custom className */
  className?: string;
}

/**
 * Status Summary component
 * Displays a summary of safety statuses in a group
 */
export function StatusSummary({ summary, className = "" }: StatusSummaryProps) {
  const { safe_count, need_help_count, cannot_contact_count, total_count } =
    summary;

  if (total_count === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          No status information available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Group Safety Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-600" />
              <span className="text-sm">Safe</span>
            </div>
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              {safe_count}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-yellow-600" />
              <span className="text-sm">Need Help</span>
            </div>
            <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">
              {need_help_count}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-red-600" />
              <span className="text-sm">Cannot Contact</span>
            </div>
            <Badge variant="secondary" className="bg-red-50 text-red-700">
              {cannot_contact_count}
            </Badge>
          </div>

          <div className="mt-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <Badge variant="outline">{total_count}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
