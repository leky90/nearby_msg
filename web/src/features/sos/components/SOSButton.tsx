/**
 * SOS Button Component
 * Emergency SOS button that triggers SOS message creation
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { SOSType } from "@/shared/domain/message";
import { sendSOSToAllGroups } from "@/features/messages/services/sos-service";
import { SOSSelector } from "./SOSSelector";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import {
  selectGPSStatus,
  checkGPSStatusAction,
} from "@/features/navigation/store/appSlice";
import { showToast } from "@/shared/utils/toast";
import type { RootState } from "@/store";

export interface SOSButtonProps {
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
  onSOSSent,
  variant = "destructive",
  size = "default",
  className = "",
}: SOSButtonProps) {
  const dispatch = useDispatch();
  const gpsStatus = useSelector((state: RootState) => selectGPSStatus(state));
  const [showSelector, setShowSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check GPS status on mount
  if (!gpsStatus) {
    dispatch(checkGPSStatusAction());
  }

  const handleSOSClick = () => {
    // Re-check GPS status trước khi mở selector
    dispatch(checkGPSStatusAction());
    setShowSelector(true);
    setError(null);
  };

  const handleSOSSelected = async (sosType: SOSType) => {
    // Re-check GPS status trước khi gửi (Redux state có thể chưa update kịp)
    dispatch(checkGPSStatusAction());
    
    // sendSOSToAllGroups sẽ tự check GPS permission và location thực tế
    // Nếu GPS chưa được cấp, nó sẽ throw error với message rõ ràng
    try {
      const groupCount = await sendSOSToAllGroups(sosType);
      setShowSelector(false);
      showToast(`Đã gửi SOS thành công đến ${groupCount} nhóm!`, "success");
      onSOSSent?.();
      // Update GPS status sau khi gửi thành công
      dispatch(checkGPSStatusAction());
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Không thể gửi SOS. Vui lòng thử lại.";
      setError(errorMessage);
      showToast(errorMessage, "error");
      setShowSelector(false);
      // Re-check GPS status sau khi lỗi để update Redux state
      dispatch(checkGPSStatusAction());
    }
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
        isDisabled={gpsStatus !== "granted"}
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

      {showSelector && (
        <SOSSelector
          onSelect={handleSOSSelected}
          onClose={handleCloseSelector}
        />
      )}
    </>
  );
}
