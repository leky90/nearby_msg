import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Flame, Droplets, UserSearch } from "lucide-react";
import { createSOSMessage, checkSOSCooldown } from "@/services/message-service";
import { getOrCreateDeviceId } from "@/services/device-storage";
import { discoverNearbyGroups } from "@/services/group-service";
import { getCurrentLocation } from "@/services/location-service";
import { useSelector, useDispatch } from "react-redux";
import { selectDeviceLocation } from "@/store/slices/appSlice";
import { setActiveTab } from "@/store/slices/navigationSlice";
import type { RootState } from "@/store";
import { cn } from "@/lib/utils";
import type { SOSType } from "@/domain/message";
import { showToast } from "@/utils/toast";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { log } from "@/lib/logging/logger";

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

export function SOSView() {
  const dispatch = useDispatch();
  const deviceLocation = useSelector((state: RootState) =>
    selectDeviceLocation(state)
  );
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const [nearestGroupId, setNearestGroupId] = useState<string | null>(null);

  // Swipe down to go back
  const handleSwipeDown = useCallback(() => {
    if (!isSending) {
      dispatch(setActiveTab("explore"));
    }
  }, [dispatch, isSending]);

  const swipeHandlers = useSwipeGesture({
    onSwipeDown: handleSwipeDown,
    threshold: 50,
    preventDefault: false,
  });

  // deviceLocation is already available from selector above

  useEffect(() => {
    // Find nearest group when view mounts
    const findNearestGroup = async () => {
      try {
        // Prefer deviceLocation from store, fallback to GPS
        const location = deviceLocation
          ? {
              latitude: deviceLocation.latitude,
              longitude: deviceLocation.longitude,
              accuracy: undefined,
              timestamp: Date.now(),
            }
          : await getCurrentLocation();

        if (location) {
          const result = await discoverNearbyGroups({
            latitude: location.latitude,
            longitude: location.longitude,
            radius: 2000,
          });
          if (result.groups.length > 0) {
            setNearestGroupId(result.groups[0].id);
          } else {
            setError("Không tìm thấy nhóm nào gần bạn để gửi SOS.");
          }
        } else {
          setError("Không thể lấy vị trí hiện tại. Vui lòng cài đặt vị trí.");
        }
      } catch (err) {
        log.error("Failed to find nearest group", err);
        setError("Lỗi khi tìm nhóm gần nhất. Vui lòng thử lại.");
      }
    };
    findNearestGroup();
  }, [deviceLocation]);

  useEffect(() => {
    if (!isHolding || !holdStartTime) {
      setHoldProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

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

  const handleSOSComplete = useCallback(
    async (type: SOSType = "medical") => {
      if (isSending) return;

      setIsSending(true);
      setError(null);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      try {
        const deviceId = getOrCreateDeviceId();
        const location = await getCurrentLocation();
        if (!location) {
          setError("Không thể gửi SOS: Không có thông tin vị trí.");
          setIsSending(false);
          return;
        }

        const cooldownError = checkSOSCooldown(deviceId);
        if (cooldownError) {
          setError("Bạn vừa gửi SOS. Vui lòng đợi trước khi gửi lại.");
          setIsSending(false);
          return;
        }

        if (!nearestGroupId) {
          setError("Không tìm thấy nhóm nào gần bạn để gửi SOS.");
          setIsSending(false);
          return;
        }

        const actionLabel =
          quickActions.find((a) => a.type === type)?.label || "Cần giúp đỡ";
        await createSOSMessage(
          nearestGroupId,
          type,
          `SOS khẩn cấp: ${actionLabel}`
        );

        showToast("Đã gửi SOS thành công!", "success");
        setActiveTab("explore");
      } catch (err) {
        log.error("Failed to send SOS", err, { sosType: type });
        setError("Lỗi khi gửi SOS. Vui lòng thử lại.");
      } finally {
        setIsSending(false);
        setHoldProgress(0);
        setIsHolding(false);
        setHoldStartTime(null);
      }
    },
    [isSending, nearestGroupId, setActiveTab]
  );

  const handleHoldStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isSending || !nearestGroupId) return;
      e.preventDefault();
      setIsHolding(true);
      setHoldStartTime(Date.now());
      setError(null);
    },
    [isSending, nearestGroupId]
  );

  const handleHoldEnd = useCallback(() => {
    if (isHolding && holdProgress < 100) {
      setIsHolding(false);
      setHoldProgress(0);
      setHoldStartTime(null);
    }
  }, [isHolding, holdProgress]);

  const handleQuickAction = useCallback(
    (type: SOSType) => {
      if (!isSending && nearestGroupId) {
        handleSOSComplete(type);
      } else if (!nearestGroupId) {
        setError("Không tìm thấy nhóm nào gần bạn để gửi SOS.");
      }
    },
    [isSending, nearestGroupId, handleSOSComplete]
  );

  return (
    <div className="h-full w-full flex flex-col">
      <div
        {...swipeHandlers.handlers}
        className={cn(
          "flex-1 w-full",
          "bg-sos/95 backdrop-blur-sm",
          "flex flex-col items-center justify-center",
          "p-4 sm:p-6"
        )}
      >
        {/* Error Message */}
        {error && (
          <div className="absolute top-16 left-4 right-4 bg-white text-destructive px-4 py-2 rounded-lg text-sm text-center shadow-lg">
            {error}
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.type}
                onClick={() => handleQuickAction(action.type)}
                disabled={isSending || !nearestGroupId}
                className={cn(
                  "bg-white/20 hover:bg-white/30",
                  "rounded-full p-3 sm:p-4 text-white",
                  "transition-all active:scale-95",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex flex-col items-center gap-1 sm:gap-2",
                  "min-w-[80px] sm:min-w-[100px]"
                )}
                aria-label={action.label}
              >
                <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
                <span className="text-xs sm:text-sm">{action.label}</span>
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

          <p className="text-white/80 text-sm text-center max-w-xs">
            Giữ nút trong 3 giây để gửi SOS khẩn cấp
          </p>
        </div>
      </div>
    </div>
  );
}
