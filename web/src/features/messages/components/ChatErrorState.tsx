/**
 * Chat Error State Component
 * Displays error state for chat page
 */

import { RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { t } from "@/shared/lib/i18n";

export interface ChatErrorStateProps {
  error: Error;
  onBack: () => void;
  onRefresh: () => void;
}

export function ChatErrorState({
  error,
  onBack,
  onRefresh,
}: ChatErrorStateProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 bg-background">
      <p className="text-destructive text-center">
        {t("page.chat.errorLoadingMessages")}: {error.message}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Trở về
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </Button>
      </div>
    </div>
  );
}
