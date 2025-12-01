/**
 * Create Group View - Simplified
 * Full-screen view for creating a new group from empty state
 */

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { LocationInput } from "@/shared/components/LocationInput";
import { useLocationInput } from "@/shared/hooks/useLocationInput";
import { useSelector, useDispatch } from "react-redux";
import { createGroupAction } from "@/features/groups/store/groupSaga";
import { selectDeviceCreatedGroup } from "@/features/groups/store/slice";
import type { RootState } from "@/store";
import { showToast } from "@/shared/utils/toast";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import type { Group } from "@/shared/domain/group";
import {
  createGroupSchema,
  type CreateGroupFormData,
} from "../schemas/group-form.schema";

interface CreateGroupViewProps {
  onCancel: () => void;
}

const getGroupTypes = (): Array<{ value: Group["type"]; label: string }> => [
  // Cấp nhỏ nhất - đặt lên đầu
  { value: "village", label: t("group.type.village") },
  { value: "hamlet", label: t("group.type.hamlet") },
  { value: "residential_group", label: t("group.type.residential_group") },
  { value: "street_block", label: t("group.type.street_block") },
  // Cấp xã/phường
  { value: "ward", label: t("group.type.ward") },
  { value: "commune", label: t("group.type.commune") },
  // Khu vực đặc biệt
  { value: "apartment", label: t("group.type.apartment") },
  { value: "residential_area", label: t("group.type.residential_area") },
  // Khác
  { value: "other", label: t("group.type.other") },
];

export function CreateGroupView({ onCancel }: CreateGroupViewProps) {
  const dispatch = useDispatch();
  const deviceCreatedGroup = useSelector((state: RootState) =>
    selectDeviceCreatedGroup(state)
  );
  const GROUP_TYPES = getGroupTypes();

  // Form state managed by react-hook-form
  const form = useForm<CreateGroupFormData>({
    resolver: standardSchemaResolver(createGroupSchema),
    defaultValues: {
      name: "",
      type: "village",
      latitude: 0,
      longitude: 0,
    },
    mode: "onSubmit",
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const isCreating = form.formState.isSubmitting;

  const locationInput = useLocationInput({
    onLocationSet: (location) => {
      setValidationError(null);
      // Sync location to form
      if (location) {
        form.setValue("latitude", location.latitude);
        form.setValue("longitude", location.longitude);
        form.trigger(["latitude", "longitude"]);
      }
    },
  });

  // Update error when device created group exists
  useEffect(() => {
    if (deviceCreatedGroup) {
      setValidationError(
        "Bạn đã tạo nhóm khu vực. Mỗi thiết bị chỉ có thể tạo một nhóm."
      );
    }
  }, [deviceCreatedGroup]);

  // Sync location to form (only from locationInput when user selects)
  // Don't sync deviceLocation - user must explicitly choose location for the group
  useEffect(() => {
    if (locationInput.location) {
      form.setValue("latitude", locationInput.location.latitude);
      form.setValue("longitude", locationInput.location.longitude);
      form.trigger(["latitude", "longitude"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationInput.location?.latitude, locationInput.location?.longitude]);

  const onSubmit = (data: CreateGroupFormData) => {
    setValidationError(null);

    if (deviceCreatedGroup) {
      setValidationError(
        "Bạn đã tạo nhóm khu vực. Mỗi thiết bị chỉ có thể tạo một nhóm."
      );
      return;
    }

    if (!locationInput.location) {
      setValidationError(
        "Vui lòng chọn vị trí bằng cách nhấn 'Lấy vị trí từ GPS' hoặc 'Nhập thủ công'."
      );
      return;
    }

    // Dispatch action to create group (saga will handle service call and offline queuing)
    dispatch(
      createGroupAction({
        name: data.name.trim(),
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
      })
    );

    // Show success message and close view optimistically
    // The created group will be available in Redux store via Groups RxDB listener
    // Parent component can listen to Redux state changes to detect new group
    showToast("Đang tạo nhóm khu vực...", "info");
    onCancel(); // Close view after dispatching action
  };

  return (
    <div className="h-full w-full overflow-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center px-4 py-3">
          <h1 className="text-lg font-semibold flex-1">
            Tạo nhóm theo khu vực
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
        {(validationError ||
          form.formState.errors.root ||
          Object.keys(form.formState.errors).length > 0) && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-3">
              <p>
                {validationError ||
                  form.formState.errors.root?.message ||
                  Object.values(form.formState.errors)[0]?.message}
              </p>
              {validationError &&
                validationError.includes("Không thể lấy vị trí") && (
                  <div className="mt-3 pt-3 border-t border-destructive/20 space-y-2">
                    <p className="text-xs font-medium">
                      Hướng dẫn lấy link Google Maps:
                    </p>
                    <ol className="text-xs list-decimal list-inside space-y-1 ml-2">
                      <li>Mở Google Maps trên điện thoại hoặc máy tính</li>
                      <li>Tìm vị trí của bạn trên bản đồ</li>
                      <li>Nhấn và giữ vào vị trí để đánh dấu</li>
                      <li>Chọn "Chia sẻ" hoặc nhấn vào biểu tượng chia sẻ</li>
                      <li>Copy link và dán vào ô nhập liệu bên dưới</li>
                    </ol>
                  </div>
                )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Location Input */}
          <LocationInput
            locationInput={locationInput}
            showInstructions={false}
            disabled={isCreating || !!deviceCreatedGroup}
          />

          {/* Group Type */}
          <div className="space-y-2">
            <Label htmlFor="group-type">Loại khu vực</Label>
            <Controller
              name="type"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={
                    locationInput.isLoadingLocation ||
                    isCreating ||
                    !!deviceCreatedGroup
                  }
                >
                  <SelectTrigger id="group-type">
                    <SelectValue placeholder="Chọn loại khu vực" />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_TYPES.map((groupType) => (
                      <SelectItem key={groupType.value} value={groupType.value}>
                        {groupType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Tên khu vực</Label>
            <Input
              id="group-name"
              {...form.register("name")}
              placeholder="Ví dụ: Xóm ABC, Thôn Đông, Phường 5"
              maxLength={100}
              autoFocus={!locationInput.showManualInput}
              disabled={
                locationInput.isLoadingLocation ||
                isCreating ||
                !!deviceCreatedGroup
              }
              className={cn(
                (validationError || form.formState.errors.name) &&
                  "border-destructive"
              )}
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={
                form.formState.errors.name ? "group-name-error" : undefined
              }
            />
            {form.formState.errors.name && (
              <p id="group-name-error" className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {form.watch("name")?.length || 0}/100 ký tự. Nhập tên
              thôn/xóm/phường/xã để dễ nhận biết khu vực trong tình huống khẩn
              cấp.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onPress={onCancel}
              isDisabled={isCreating || !!deviceCreatedGroup}
              className="flex-1"
            >
              {deviceCreatedGroup ? "Đóng" : "Hủy"}
            </Button>
            <button
              type="submit"
              disabled={
                locationInput.isLoadingLocation ||
                isCreating ||
                !form.watch("name")?.trim() ||
                !locationInput.location ||
                !form.formState.isValid ||
                !!deviceCreatedGroup
              }
              className="flex-1 h-12 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-default outline-none border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                "Tạo nhóm khu vực"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
