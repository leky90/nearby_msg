/**
 * Onboarding Screen
 * First-time user experience - requires user to enter a nickname
 */

import { useState, useEffect } from "react";
import { MessageCircle, Loader2, MapPin, AlertCircle } from "lucide-react";
import { useDevice } from "@/hooks/useDevice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateNickname } from "@/domain/device";
import { showToast } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { getGPSStatus } from "@/services/device-status";
import { isGeolocationAvailable } from "@/services/location-service";
import { LocationInput } from "@/components/common/LocationInput";
import { useLocationInput } from "@/hooks/useLocationInput";
import { useAppStore } from "@/stores/app-store";

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { registerDevice, loading } = useDevice(false); // Don't fetch device during onboarding
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { gpsStatus, setGPSStatus } = useAppStore();

  const locationInput = useLocationInput({
    saveToStorage: true,
    storageKey: "device_location",
  });

  // Check GPS status on mount
  useEffect(() => {
    const checkGPSStatus = async () => {
      // If location is already set in app store, don't auto-request GPS
      const { deviceLocation } = useAppStore.getState();
      if (deviceLocation) {
        return;
      }

      // If location is already set in this hook, don't auto-request GPS
      if (locationInput.location) {
        return;
      }

      // Use cached status if available, otherwise check
      let status = gpsStatus;
      if (!status) {
        status = await getGPSStatus();
        setGPSStatus(status);
      }

      if (status === "granted") {
        // Try to get location if permission is granted
        try {
          await locationInput.handleRequestGPS();
        } catch (err) {
          console.error("Failed to get location:", err);
        }
      } else if (status === "denied" || status === "unavailable") {
        locationInput.setShowManualInput(true);
      }
    };
    void checkGPSStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRequestGPSPermission = async () => {
    if (!isGeolocationAvailable()) {
      showToast("Trình duyệt của bạn không hỗ trợ GPS", "error");
      locationInput.setShowManualInput(true);
      return;
    }

    // Trigger permission request by calling getCurrentLocation
    try {
      await locationInput.handleRequestGPS();
      const newStatus = await getGPSStatus();
      setGPSStatus(newStatus);
    } catch (err) {
      console.error("Failed to request GPS permission:", err);
      const newStatus = await getGPSStatus();
      setGPSStatus(newStatus);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = nickname.trim();
    const validationError = validateNickname(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Validate location is required
    if (!locationInput.location) {
      setError("Vui lòng cài đặt vị trí GPS trước khi bắt đầu");
      showToast("Vui lòng cài đặt vị trí GPS trước khi bắt đầu", "error");
      return;
    }

    try {
      await registerDevice({ nickname: trimmed });
      showToast("Chào mừng bạn đến với Nearby Community Chat!", "success");
      // Wait a bit for device to be saved to RxDB and token to be set
      setTimeout(() => {
        onComplete();
      }, 100);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Lỗi khi đăng ký. Vui lòng thử lại.";
      setError(message);
      showToast(message, "error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Chào mừng bạn!</h1>
          <p className="text-muted-foreground">
            Vui lòng nhập tên hiển thị để bắt đầu sử dụng ứng dụng
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="nickname" className="text-sm font-medium">
              Tên hiển thị
            </label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError(null);
              }}
              placeholder="Nhập tên của bạn"
              maxLength={50}
              autoFocus
              disabled={loading}
              className={cn(error && "border-destructive")}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              {nickname.length}/50 ký tự. Chỉ được dùng chữ, số, khoảng trắng và
              dấu gạch ngang.
            </p>
          </div>

          {/* GPS Location Section - Required */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Vị trí <span className="text-destructive">*</span>
              </label>
              {locationInput.location && (
                <div className="flex items-center gap-1.5 text-xs text-safety">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Đã lấy vị trí</span>
                </div>
              )}
            </div>
            {!locationInput.location && (
              <p className="text-xs text-muted-foreground">
                Vui lòng cấp quyền GPS hoặc nhập link Google Maps để xác định vị
                trí của bạn
              </p>
            )}

            {/* Show GPS permission request button if not granted */}
            {!locationInput.location && gpsStatus !== "granted" && (
              <div className="space-y-2">
                {gpsStatus === "denied" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      GPS đã bị từ chối. Vui lòng cấp quyền GPS trong cài đặt
                      trình duyệt hoặc nhập link Google Maps bên dưới.
                    </AlertDescription>
                  </Alert>
                )}
                {gpsStatus === "prompt" && isGeolocationAvailable() && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleRequestGPSPermission}
                    isDisabled={locationInput.isLoadingLocation || loading}
                    className="w-full"
                  >
                    {locationInput.isLoadingLocation ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Đang lấy vị trí...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Cấp quyền GPS
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Location Input */}
            <LocationInput
              locationInput={locationInput}
              showInstructions={true}
              disabled={loading}
            />

            {/* Error message if location is missing */}
            {!locationInput.location && (
              <p className="text-xs text-destructive">
                Vị trí là bắt buộc. Vui lòng cài đặt vị trí để tiếp tục.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full h-12 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-default outline-none border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            disabled={loading || !nickname.trim() || !locationInput.location}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Bắt đầu"
            )}
          </button>
          {!locationInput.location && (
            <p className="text-xs text-center text-muted-foreground">
              Vui lòng cài đặt vị trí để có thể bắt đầu
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
