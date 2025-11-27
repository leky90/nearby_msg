/**
 * SOS Button Component
 * Emergency SOS button that triggers SOS message creation
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { SOSType } from "../../domain/message";
import {
  createSOSMessage,
  checkSOSCooldown,
} from "../../services/message-service";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { SOSSelector } from "./SOSSelector";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";

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
  const [showSelector, setShowSelector] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSOSClick = () => {
    if (!groupId) {
      setError("No group selected");
      return;
    }

    // Check cooldown
    const deviceId = getOrCreateDeviceId();
    const cooldownError = checkSOSCooldown(deviceId);
    if (cooldownError) {
      setError(cooldownError);
      return;
    }

    setShowSelector(true);
    setError(null);
  };

  const handleSOSSelected = async (sosType: SOSType) => {
    if (!groupId) return;

    try {
      setIsSending(true);
      setError(null);
      await createSOSMessage(groupId, sosType);
      setShowSelector(false);
      onSOSSent?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send SOS message"
      );
    } finally {
      setIsSending(false);
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
        variant={variant}
        size={size}
        onClick={handleSOSClick}
        isDisabled={isSending || !groupId}
        aria-label="Send Emergency SOS"
        className={className}
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
