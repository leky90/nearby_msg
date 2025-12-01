/**
 * Status Summary Component
 * Displays a summary of safety statuses in a group
 */

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { StatusSummary as StatusSummaryType } from "@/features/status/services/status-service";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";

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
        <CardContent className="p-4 text-center text-body leading-body text-muted-foreground">
          {t("component.statusSummary.noStatus") ||
            "Chưa có thông tin trạng thái"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-heading-2 leading-heading-2">
          {t("component.statusSummary.title") || "Trạng thái An toàn Nhóm"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-safety" />
              <span className="text-body leading-body">{t("status.safe")}</span>
            </div>
            <Badge
              variant="safe"
              className="bg-safety/10 text-safety border-safety/20"
            >
              {safe_count}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-warning" />
              <span className="text-body leading-body">
                {t("status.needHelp")}
              </span>
            </div>
            <Badge
              variant="outline"
              className="bg-warning/10 text-warning border-warning/20"
            >
              {need_help_count}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-sos" />
              <span className="text-body leading-body">
                {t("status.cannotContact")}
              </span>
            </div>
            <Badge variant="sos" className="bg-sos/10 text-sos border-sos/20">
              {cannot_contact_count}
            </Badge>
          </div>

          <div className="mt-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-body leading-body font-medium">
                {t("component.statusSummary.total", { count: total_count })}
              </span>
              <Badge variant="outline">{total_count}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
