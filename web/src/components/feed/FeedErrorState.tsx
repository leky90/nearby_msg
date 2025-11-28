/**
 * Shared error state component for feeds
 */

import { RefreshCw, ArrowLeft, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/stores/navigation-store";
import { showToast } from "@/utils/toast";

interface FeedErrorStateProps {
  title: string;
  message: string;
  onRefresh?: () => void;
  onBack?: () => void;
  isGPSError?: boolean;
}

export function FeedErrorState({
  title,
  message,
  onRefresh,
  onBack,
  isGPSError = false,
}: FeedErrorStateProps) {
  const { setActiveTab } = useNavigationStore();
  const [copied, setCopied] = useState(false);
  const googleMapsUrl = "https://www.google.com/maps";

  const handleGoToSettings = () => {
    setActiveTab("status");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(googleMapsUrl);
      setCopied(true);
      showToast("Đã copy link Google Maps", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      showToast("Không thể copy link", "error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-4 max-w-md mx-auto">
      <p className="text-foreground/80 text-center text-base sm:text-lg font-medium">
        {title}
      </p>
      <p className="text-sm text-foreground/60 text-center">{message}</p>

      {isGPSError ? (
        <div className="w-full space-y-4 mt-4">
          {/* Settings Button */}
          <Button
            variant="default"
            size="sm"
            onClick={handleGoToSettings}
            className="w-full gap-2"
          >
            <Settings className="h-4 w-4" />
            Đi tới cài đặt vị trí
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Trở về
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="default"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Làm mới
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
