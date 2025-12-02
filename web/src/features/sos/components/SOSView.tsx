import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Heart, Flame, Droplets, UserSearch } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { selectDeviceLocation } from "@/features/navigation/store/appSlice";
import { setActiveTab } from "@/features/navigation/store/slice";
import { selectNearbyGroups } from "@/features/groups/store/slice";
import { fetchNearbyGroupsAction } from "@/features/groups/store/groupSaga";
import { sendSOSMessageAction } from "@/features/messages/store/saga";
import type { RootState } from "@/store";
import { cn } from "@/shared/lib/utils";
import type { SOSType } from "@/shared/domain/message";
import { showToast } from "@/shared/utils/toast";
import { useSwipeGesture } from "@/shared/hooks/useSwipeGesture";

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
  const nearbyGroups = useSelector((state: RootState) =>
    selectNearbyGroups(state)
  );

  // UI-only state for hold progress
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Find nearest group from nearby groups in Redux
  const nearestGroupId = useMemo(() => {
    if (!deviceLocation || nearbyGroups.length === 0) {
      return null;
    }
    // Find nearest group by distance
    let nearest = nearbyGroups[0];
    let minDistance = Infinity;

    for (const group of nearbyGroups) {
      const dx = group.latitude - deviceLocation.latitude;
      const dy = group.longitude - deviceLocation.longitude;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = group;
      }
    }

    return nearest.id;
  }, [deviceLocation, nearbyGroups]);

  // Derive error state instead of using setState in useEffect
  const error = useMemo(() => {
    if (!deviceLocation) {
      return "Không thể lấy vị trí hiện tại. Vui lòng cài đặt vị trí.";
    }
    if (nearbyGroups.length === 0) {
      return "Không tìm thấy nhóm nào gần bạn để gửi SOS.";
    }
    return null;
  }, [deviceLocation, nearbyGroups.length]);

  // Fetch nearby groups when view mounts if not available
  useEffect(() => {
    if (!deviceLocation) {
      return;
    }

    if (nearbyGroups.length === 0) {
      // Fetch nearby groups
      dispatch(
        fetchNearbyGroupsAction({
          latitude: deviceLocation.latitude,
          longitude: deviceLocation.longitude,
          radius: 2000,
        })
      );
    }
  }, [deviceLocation, nearbyGroups.length, dispatch]);

  // Swipe down to go back
  const handleSwipeDown = useCallback(() => {
    dispatch(setActiveTab("explore"));
  }, [dispatch]);

  const swipeHandlers = useSwipeGesture({
    onSwipeDown: handleSwipeDown,
    threshold: 50,
    preventDefault: false,
  });

  const handleSOSComplete = useCallback(
    (type: SOSType = "medical") => {
      if (!nearestGroupId) {
        // Error is derived from state, no need to set it
        return;
      }

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      const actionLabel =
        quickActions.find((a) => a.type === type)?.label || "Cần giúp đỡ";

      // Dispatch Redux action - saga handles the rest
      dispatch(
        sendSOSMessageAction(
          nearestGroupId,
          type,
          `SOS khẩn cấp: ${actionLabel}`
        )
      );

      showToast("Đã gửi SOS thành công!", "success");
      dispatch(setActiveTab("explore"));

      // Reset UI state
      setHoldProgress(0);
      setIsHolding(false);
      setHoldStartTime(null);
    },
    [nearestGroupId, dispatch]
  );

  // Reset progress when not holding
  // Use requestAnimationFrame to avoid setState in effect warning
  useEffect(() => {
    if (!isHolding || !holdStartTime) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Reset progress in next tick to avoid setState in effect warning
      requestAnimationFrame(() => {
        setHoldProgress(0);
      });
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
  }, [isHolding, holdStartTime, handleSOSComplete]);

  const handleHoldStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!nearestGroupId) return;
      e.preventDefault();
      setIsHolding(true);
      setHoldStartTime(Date.now());
    },
    [nearestGroupId]
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
      if (nearestGroupId) {
        handleSOSComplete(type);
      }
      // Error is derived from state, no need to set it
    },
    [nearestGroupId, handleSOSComplete]
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
                disabled={!nearestGroupId}
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
            disabled={!nearestGroupId}
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
            <span className="relative z-10 text-center px-2">Giữ 3s</span>
          </button>

          <p className="text-white/80 text-sm text-center max-w-xs">
            Giữ nút trong 3 giây để gửi SOS khẩn cấp
          </p>
        </div>
      </div>
    </div>
  );
}
