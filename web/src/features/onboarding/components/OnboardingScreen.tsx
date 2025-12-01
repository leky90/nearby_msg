/**
 * Onboarding Screen
 * First-time user experience - requires user to enter a nickname
 */

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { MessageCircle, Loader2, MapPin, AlertCircle } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { showToast } from "@/shared/utils/toast";
import { cn } from "@/shared/lib/utils";
import { LocationInput } from "@/shared/components/LocationInput";
import { useLocationInput } from "@/shared/hooks/useLocationInput";
import { useSelector, useDispatch } from "react-redux";
import {
  selectGPSStatus,
  selectDeviceLocation,
  checkGPSStatusAction,
} from "@/features/navigation/store/appSlice";
import {
  selectDevice,
  selectJWTToken,
  selectDeviceLoading,
  selectDeviceError,
  setDeviceError,
} from "@/features/device/store/slice";
import { registerDeviceAction } from "@/features/device/store/saga";
import type { RootState } from "@/store";
import { NetworkBanner } from "@/shared/components/NetworkBanner";
import { log } from "@/shared/lib/logging/logger";
import { ConnectivityStatus } from "@/shared/components/ConnectivityStatus";
import { DeviceStatus } from "@/shared/components/DeviceStatus";
import {
  onboardingSchema,
  type OnboardingFormData,
} from "../schemas/onboarding.schema";

export function OnboardingScreen() {
  const dispatch = useDispatch();
  const hasSubmittedRef = useRef(false);

  // Form state managed by react-hook-form
  const form = useForm<OnboardingFormData>({
    resolver: standardSchemaResolver(onboardingSchema),
    defaultValues: {
      nickname: "",
      location: undefined,
    },
    // Dùng onChange để validation chạy ngay khi user gõ / paste,
    // tránh tình trạng formState.isValid luôn false khiến nút submit bị disable.
    mode: "onChange",
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  // Redux selectors
  const gpsStatus = useSelector((state: RootState) => selectGPSStatus(state));
  const deviceLocation = useSelector((state: RootState) =>
    selectDeviceLocation(state)
  );
  const device = useSelector((state: RootState) => selectDevice(state));
  const token = useSelector((state: RootState) => selectJWTToken(state));
  const deviceLoading = useSelector((state: RootState) =>
    selectDeviceLoading(state)
  );
  const deviceError = useSelector((state: RootState) =>
    selectDeviceError(state)
  );

  // Clear any stale device registration errors when onboarding screen mounts
  useEffect(() => {
    dispatch(setDeviceError(null));
  }, [dispatch]);

  const locationInput = useLocationInput({
    onLocationSet: (location) => {
      setValidationError(null);
      // Sync location to form
      if (location) {
        form.setValue("location", {
          latitude: location.latitude,
          longitude: location.longitude,
        });
        form.trigger("location");
      }
    },
  });

  // Watch for registration completion after submission
  useEffect(() => {
    if (!hasSubmittedRef.current) {
      return;
    }

    // Check for errors (excluding RxDB internal errors)
    if (
      deviceError &&
      !deviceError.includes("RxDB") &&
      !deviceError.includes("DB8")
    ) {
      showToast(deviceError, "error");
      hasSubmittedRef.current = false;
      return;
    }

    // Check if registration completed successfully
    if (device?.nickname && token && !deviceLoading) {
      log.info("Registration completed successfully", {
        deviceId: device.id,
        hasToken: !!token,
      });
      showToast(
        "Chào mừng bạn đến với ứng dụng trò chuyện hàng xóm!",
        "success"
      );
      hasSubmittedRef.current = false;
    }
  }, [device, token, deviceLoading, deviceError]);

  // Sync location to form (from deviceLocation or locationInput)
  // Only sync if location is already available, don't auto-request GPS
  useEffect(() => {
    const location = deviceLocation || locationInput.location;
    if (location) {
      form.setValue("location", {
        latitude: location.latitude,
        longitude: location.longitude,
      });
      if (locationInput.location) {
        form.trigger("location");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deviceLocation?.latitude,
    deviceLocation?.longitude,
    locationInput.location?.latitude,
    locationInput.location?.longitude,
  ]);

  // Check GPS status on mount (for UI display only, don't auto-request GPS)
  useEffect(() => {
    // Dispatch action to check GPS status (saga will handle the service call)
    // This is only for displaying the correct UI state (button vs manual input)
    if (!gpsStatus) {
      dispatch(checkGPSStatusAction());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (data: OnboardingFormData) => {
    setValidationError(null);

    // Validate location is required (business logic - location is optional in schema but required here)
    if (!locationInput.location) {
      const locationErr =
        "Vui lòng chọn vị trí bằng cách nhấn 'Lấy vị trí từ GPS' hoặc 'Nhập thủ công'.";
      setValidationError(locationErr);
      showToast(locationErr, "error");
      return;
    }

    // Dispatch registration action - saga will handle the rest
    dispatch(registerDeviceAction({ nickname: data.nickname.trim() }));
    hasSubmittedRef.current = true;
    setValidationError(null);

    // Registration completion will be handled by useEffect watching Redux state
    // No need to poll or wait here - useEffect will call onComplete when ready
  };

  const shouldShowDeviceError =
    hasSubmittedRef.current && deviceError && !form.formState.errors.nickname;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Status Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ConnectivityStatus showLabel={true} size="sm" />
          </div>
          <DeviceStatus showLabels={true} />
        </div>
        <NetworkBanner />
      </div>

      {/* Onboarding Content */}
      <div className="flex flex-col items-center justify-center flex-1 p-4">
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="nickname" className="text-sm font-medium">
                Tên hiển thị
              </label>
              <Input
                id="nickname"
                {...form.register("nickname")}
                placeholder="Nhập tên của bạn"
                maxLength={50}
                autoFocus
                disabled={deviceLoading}
                className={cn(
                  (validationError ||
                    deviceError ||
                    form.formState.errors.nickname) &&
                    "border-destructive"
                )}
                aria-invalid={
                  !!(
                    validationError ||
                    deviceError ||
                    form.formState.errors.nickname
                  )
                }
                aria-describedby={
                  form.formState.errors.nickname ? "nickname-error" : undefined
                }
              />
              {form.formState.errors.nickname && (
                <p id="nickname-error" className="text-sm text-destructive">
                  {form.formState.errors.nickname.message}
                </p>
              )}
              {(validationError || shouldShowDeviceError) && (
                <p className="text-sm text-destructive">
                  {validationError || shouldShowDeviceError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {form.watch("nickname")?.length || 0}/50 ký tự. Chỉ được dùng
                chữ, số, khoảng trắng và dấu gạch ngang.
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
                <p className="text-xs text-info">
                  Vui lòng cấp quyền GPS hoặc nhập link Google Maps để xác định
                  vị trí của bạn
                </p>
              )}

              {/* Show alert if GPS is denied */}
              {!locationInput.location && gpsStatus === "denied" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    GPS đã bị từ chối. Vui lòng cấp quyền GPS trong cài đặt
                    trình duyệt hoặc nhập link Google Maps bên dưới.
                  </AlertDescription>
                </Alert>
              )}

              {/* Location Input */}
              <LocationInput
                locationInput={locationInput}
                showInstructions={true}
                disabled={deviceLoading}
              />
            </div>

            <button
              type="submit"
              className="w-full h-12 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-default outline-none border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              disabled={
                deviceLoading ||
                !form.watch("nickname")?.trim() ||
                !locationInput.location ||
                !form.formState.isValid
              }
            >
              {deviceLoading ? (
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
    </div>
  );
}
