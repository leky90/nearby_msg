import { useState, useEffect, useRef } from "react";
import { X, Heart, Flame, Droplets, UserSearch } from "lucide-react";
import { createSOSMessage, checkSOSCooldown } from "@/services/message-service";
import { getOrCreateDeviceId } from "@/services/device-storage";
import { discoverNearbyGroups } from "@/services/group-service";
import { getCurrentLocation } from "@/services/location-service";
import { cn } from "@/lib/utils";
import type { SOSType } from "@/domain/message";
import { showToast } from "@/utils/toast";

interface SOSOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSOSSent?: (type?: SOSType) => void;
  className?: string;
}

const HOLD_DURATION = 3000; // 3 seconds

const quickActions: {
  type: SOSType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { type: "medical", icon: Heart, label: "Cứu thương" },
  { type: "fire", icon: Flame, label: "Cháy" },
  { type: "flood", icon: Droplets, label: "Lũ lụt" },
  { type: "missing_person", icon: UserSearch, label: "Mất tích" },
];

export function SOSOverlay({
  isOpen,
  onClose,
  onSOSSent,
  className,
}: SOSOverlayProps) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Get nearest group for SOS (if no group selected)
  const [nearestGroupId, setNearestGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Find nearest group when overlay opens
      const findNearestGroup = async () => {
        try {
          const location = await getCurrentLocation();
          if (location) {
            const result = await discoverNearbyGroups({
              latitude: location.latitude,
              longitude: location.longitude,
              radius: 2000, // 2km max
            });
            if (result.groups.length > 0) {
              setNearestGroupId(result.groups[0].id);
            }
          }
        } catch (err) {
          console.error("Failed to find nearest group:", err);
        }
      };
      findNearestGroup();
    } else {
      // Reset state when closed
      setHoldProgress(0);
      setIsHolding(false);
      setHoldStartTime(null);
      setError(null);
      setNearestGroupId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isHolding || !holdStartTime) {
      setHoldProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    // Update progress every 16ms (~60fps)
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - holdStartTime;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        handleSOSComplete();
      }
    }, 16);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isHolding, holdStartTime]);

  const handleSOSComplete = async () => {
    if (!nearestGroupId) {
      setError("Không tìm thấy nhóm gần nhất. Vui lòng thử lại.");
      setIsHolding(false);
      setHoldStartTime(null);
      setHoldProgress(0);
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      const deviceId = getOrCreateDeviceId();
      const cooldownError = checkSOSCooldown(deviceId);
      if (cooldownError) {
        setError(cooldownError);
        setIsHolding(false);
        setHoldStartTime(null);
        setHoldProgress(0);
        return;
      }

      await createSOSMessage(nearestGroupId, "medical"); // Default to medical if no quick action
      onSOSSent?.();
      showToast("SOS đã được gửi", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi SOS");
      setIsHolding(false);
      setHoldStartTime(null);
      setHoldProgress(0);
    } finally {
      setIsSending(false);
    }
  };

  const handleHoldStart = () => {
    if (!nearestGroupId) {
      setError("Đang tìm nhóm gần nhất...");
      return;
    }
    setIsHolding(true);
    setHoldStartTime(Date.now());
    setError(null);
  };

  const handleHoldEnd = () => {
    setIsHolding(false);
    setHoldStartTime(null);
    setHoldProgress(0);
  };

  const handleQuickAction = async (type: SOSType) => {
    if (!nearestGroupId) {
      setError("Đang tìm nhóm gần nhất...");
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      const deviceId = getOrCreateDeviceId();
      const cooldownError = checkSOSCooldown(deviceId);
      if (cooldownError) {
        setError(cooldownError);
        return;
      }

      await createSOSMessage(nearestGroupId, type);
      onSOSSent?.(type);
      showToast("SOS đã được gửi", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi SOS");
    } finally {
      setIsSending(false);
    }
  };

  // Handle swipe down to dismiss
  const [swipeStart, setSwipeStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStart(e.touches[0].clientY);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStart !== null) {
      const deltaY = e.touches[0].clientY - swipeStart;
      // If swiped down more than 100px, close overlay
      if (deltaY > 100) {
        onClose();
        setSwipeStart(null);
      }
    }
  };
  const handleTouchEnd = () => {
    setSwipeStart(null);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[100]",
        "bg-sos/95 backdrop-blur-sm",
        "flex flex-col items-center justify-center",
        "p-4 sm:p-6",
        "w-full max-w-full h-full",
        "overflow-x-hidden overflow-y-auto",
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Close if clicking outside the main button area
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors z-10"
        aria-label="Đóng"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Error Message */}
      {error && (
        <div className="absolute top-16 left-4 right-4 bg-white text-destructive px-4 py-2 rounded-lg text-sm text-center font-medium shadow-lg">
          {error}
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-8 justify-center">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.type}
              onClick={() => handleQuickAction(action.type)}
              disabled={isSending || !nearestGroupId}
              className={cn(
                "bg-white/20 hover:bg-white/30 active:bg-white/40",
                "rounded-full p-3 sm:p-4 text-white",
                "transition-all active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex flex-col items-center gap-1 sm:gap-2",
                "min-w-[60px] sm:min-w-[80px]"
              )}
              aria-label={action.label}
            >
              <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
              <span className="text-[10px] sm:text-xs font-medium">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Hold Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onMouseDown={handleHoldStart}
          onMouseUp={handleHoldEnd}
          onMouseLeave={handleHoldEnd}
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
          disabled={isSending || !nearestGroupId}
          className={cn(
            "relative w-28 h-28 sm:w-32 sm:h-32 rounded-full",
            "bg-white text-sos",
            "flex items-center justify-center",
            "font-bold text-base sm:text-lg",
            "transition-transform active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-2xl"
          )}
          aria-label="Giữ để gửi SOS"
        >
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 45}%`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - holdProgress / 100)}%`}
              className="text-white/30"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 45}%`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - holdProgress / 100)}%`}
              className="text-white transition-all duration-75"
            />
          </svg>

          {/* Button Text */}
          <span className="relative z-10 text-center px-2">
            {isSending ? "Đang gửi..." : "Giữ 3s"}
          </span>
        </button>

        <p className="text-white/90 text-sm sm:text-base text-center max-w-xs font-medium">
          Giữ nút trong 3 giây để gửi SOS khẩn cấp
        </p>
      </div>
    </div>
  );
}
