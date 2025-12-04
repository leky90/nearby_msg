import { useCallback, useEffect, useMemo } from "react";
import { Heart, Flame, Droplets, UserRound } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setActiveTab } from "@/features/navigation/store/slice";
import { sendSOSToAllGroups } from "@/features/messages/services/sos-service";
import type { RootState } from "@/store";
import { cn } from "@/shared/lib/utils";
import type { SOSType } from "@/shared/domain/message";
import { showToast } from "@/shared/utils/toast";
import {
  selectGPSStatus,
  checkGPSStatusAction,
} from "@/features/navigation/store/appSlice";

const quickActions: {
  type: SOSType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { type: "medical", icon: Heart, label: "SOS cấp cứu" },
  { type: "fire", icon: Flame, label: "SOS cháy nổ" },
  { type: "flood", icon: Droplets, label: "SOS lũ lụt" },
  { type: "missing_person", icon: UserRound, label: "SOS mắc kẹt" },
];

const actionStyles: Record<SOSType, string> = {
  medical:
    "bg-red-50 text-red-700 hover:bg-red-100 shadow-red-100 border-red-100",
  fire: "bg-orange-50 text-orange-700 hover:bg-orange-100 shadow-orange-100 border-orange-100",
  flood:
    "bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-blue-100 border-blue-100",
  missing_person:
    "bg-amber-50 text-amber-700 hover:bg-amber-100 shadow-amber-100 border-amber-100",
};

export function SOSView() {
  const dispatch = useDispatch();
  const gpsStatus = useSelector((state: RootState) => selectGPSStatus(state));

  // Kiểm tra trạng thái GPS khi mở màn
  useEffect(() => {
    if (!gpsStatus) {
      dispatch(checkGPSStatusAction());
    }
  }, [gpsStatus, dispatch]);

  // Thông báo lỗi theo trạng thái GPS
  const error = useMemo(() => {
    if (gpsStatus === "denied") {
      return "GPS đã bị từ chối. Vui lòng cấp quyền GPS trong cài đặt trình duyệt để gửi SOS.";
    }
    if (gpsStatus === "unavailable") {
      return "Trình duyệt của bạn không hỗ trợ GPS.";
    }
    return null;
  }, [gpsStatus]);

  const handleSendSOS = useCallback(
    async (type: SOSType) => {
      // Re-check GPS status trước khi gửi (Redux state có thể chưa update kịp)
      dispatch(checkGPSStatusAction());

      // Đợi một chút để Redux state được update (nếu có)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // sendSOSToAllGroups sẽ tự check GPS permission và location thực tế
      // Nếu GPS chưa được cấp, nó sẽ throw error với message rõ ràng
      try {
        const groupCount = await sendSOSToAllGroups(type);
        showToast(`Đã gửi SOS thành công đến ${groupCount} nhóm!`, "success");
        dispatch(setActiveTab("explore"));
        // Update GPS status sau khi gửi thành công
        dispatch(checkGPSStatusAction());
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Không thể gửi SOS. Vui lòng thử lại.";
        showToast(errorMessage, "error");
        // Re-check GPS status sau khi lỗi để update Redux state
        dispatch(checkGPSStatusAction());
      }
    },
    [dispatch]
  );

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="flex-1 w-full flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Error Message */}
        {error && (
          <div className="mb-4 max-w-md w-full bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm text-center shadow-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="max-w-md w-full text-center mb-6">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
            Gửi SOS khẩn cấp
          </h1>
          <p className="text-sm text-gray-600">
            Chọn loại SOS phù hợp. Hệ thống sẽ gửi tin nhắn SOS tới tất cả nhóm
            bạn đang tham gia kèm vị trí GPS hiện tại của bạn.
          </p>
        </div>

        {/* SOS Type Buttons */}
        <div className="grid grid-cols-2 gap-4 max-w-md w-full">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.type}
                onClick={() => handleSendSOS(action.type)}
                className={cn(
                  "rounded-2xl px-4 py-5 flex flex-col items-center justify-center gap-2",
                  "shadow-md transition-all active:scale-95 border",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  actionStyles[action.type]
                )}
                aria-label={action.label}
              >
                <Icon className="w-7 h-7" />
                <span className="text-sm font-semibold text-center">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-500 max-w-md text-center">
          Lưu ý: SOS chỉ được gửi khi bạn cấp quyền truy cập GPS. Điều này giúp
          mọi người xác định chính xác vị trí hiện tại của bạn.
        </p>
      </div>
    </div>
  );
}
