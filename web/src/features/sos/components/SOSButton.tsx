/**
 * SOS Button Component
 * Emergency SOS button that triggers SOS message creation
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useDispatch } from "react-redux";
import type { SOSType } from "@/shared/domain/message";
import { sendSOSMessageAction } from "@/features/messages/store/saga";
import { SOSSelector } from "./SOSSelector";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export interface SOSButtonProps {
  /** Group ID to send SOS message to */
  groupId?: string;
  /** Callback when SOS message is sent */
  onSOSSent?: () => void;
  /** Button variant */
  variant?: "default" | "destructive" | "secondary" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  /** Custom className */
  className?: string;
}

/**
 * SOS Button component
 * Displays an emergency SOS button that opens SOS type selector
 */
export function SOSButton({
  groupId,
  onSOSSent,
  variant = "destructive",
  size = "default",
  className = "",
}: SOSButtonProps) {
  const dispatch = useDispatch();
  const [showSelector, setShowSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSOSClick = () => {
    if (!groupId) {
      setError("Chưa chọn nhóm");
      return;
    }

    setShowSelector(true);
    setError(null);
  };

  const handleSOSSelected = (sosType: SOSType) => {
    if (!groupId) return;

    // Dispatch Redux action - saga handles the rest
    dispatch(sendSOSMessageAction(groupId, sosType));
    setShowSelector(false);
    onSOSSent?.();
  };

  const handleCloseSelector = () => {
    setShowSelector(false);
    setError(null);
  };

  const isIconOnly =
    size === "icon" || size === "icon-sm" || size === "icon-lg";

  return (
    <>
      <Button
        variant={variant === "destructive" ? "sos" : variant}
        size={size === "sm" ? "default" : size} // Ensure minimum h-12
        onClick={handleSOSClick}
        isDisabled={!groupId}
        aria-label={t("button.sendSOS")}
        className={cn(className, "min-h-12")}
      >
        <AlertTriangle className="size-4" />
        {!isIconOnly && <span>SOS</span>}
      </Button>

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showSelector && groupId && (
        <SOSSelector
          onSelect={handleSOSSelected}
          onClose={handleCloseSelector}
        />
      )}
    </>
  );
}
