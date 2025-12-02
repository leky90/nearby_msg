/**
 * Chat Empty State Component
 * Displays empty state when no group is selected
 */

import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { t } from "@/shared/lib/i18n";

export interface ChatEmptyStateProps {
  onBack: () => void;
}

export function ChatEmptyState({ onBack }: ChatEmptyStateProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 bg-background">
      <p className="text-muted-foreground">{t("page.chat.noGroupSelected")}</p>
      <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Trở về
      </Button>
    </div>
  );
}
