/**
 * Nickname Section Component
 * Editable nickname display and input
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Edit2, Check, X } from "lucide-react";
import { useDevice } from "@/features/device/hooks/useDevice";
import { useDispatch, useSelector } from "react-redux";
import { updateDeviceAction } from "@/features/device/store/saga";
import {
  selectDeviceLoading,
  selectDeviceError,
} from "@/features/device/store/slice";
import { Input } from "@/shared/components/ui/input";
import { showToast } from "@/shared/utils/toast";
import type { RootState } from "@/store";
import {
  nicknameSchema,
  type NicknameFormData,
} from "../schemas/nickname.schema";

export function NicknameSection() {
  const { device, loading: isLoadingDevice } = useDevice();
  const dispatch = useDispatch();
  const [isEditingNickname, setIsEditingNickname] = useState(false);

  // Form state managed by react-hook-form (mode: onBlur for inline editing)
  const form = useForm<NicknameFormData>({
    resolver: standardSchemaResolver(nicknameSchema),
    defaultValues: {
      nickname: device?.nickname || "",
    },
    mode: "onBlur", // Validate on blur for better UX in inline editing
  });

  // Get loading and error states from Redux
  const isUpdating = useSelector((state: RootState) =>
    selectDeviceLoading(state)
  );
  const updateError = useSelector((state: RootState) =>
    selectDeviceError(state)
  );

  // Update form when device nickname changes in Redux
  useEffect(() => {
    if (device?.nickname && !isEditingNickname) {
      form.reset({ nickname: device.nickname });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.nickname, isEditingNickname]);

  // Handle update errors from Redux
  useEffect(() => {
    if (updateError && isEditingNickname) {
      showToast(updateError, "error");
      form.setError("root", { message: updateError });
      setIsEditingNickname(false);
    } else if (
      !isUpdating &&
      isEditingNickname &&
      !updateError &&
      device?.nickname === form.getValues("nickname")?.trim()
    ) {
      // Update succeeded
      showToast("Đã cập nhật tên thành công", "success");
      setIsEditingNickname(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateError, isUpdating, isEditingNickname, device?.nickname]);

  const onSubmit = (data: NicknameFormData) => {
    // Dispatch Redux action - saga handles the update
    dispatch(updateDeviceAction({ nickname: data.nickname.trim() }));
    // Don't close editing mode immediately - wait for success/error from Redux
  };

  const handleCancelEdit = () => {
    form.reset({ nickname: device?.nickname || "" });
    setIsEditingNickname(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/70">
        Tên hiển thị
      </label>
      {isEditingNickname ? (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex items-center gap-2"
        >
          <Input
            {...form.register("nickname")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                form.handleSubmit(onSubmit)();
              } else if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
            maxLength={50}
            className="flex-1"
            autoFocus
            disabled={isUpdating}
            aria-invalid={!!form.formState.errors.nickname}
            aria-describedby={
              form.formState.errors.nickname ? "nickname-error" : undefined
            }
          />
          {form.formState.errors.nickname && (
            <span id="nickname-error" className="sr-only" role="alert">
              {form.formState.errors.nickname.message}
            </span>
          )}
          <button
            type="submit"
            disabled={isUpdating || !form.formState.isValid}
            className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Lưu"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={isUpdating}
            className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Hủy"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-base font-medium">
            {isLoadingDevice
              ? "Đang tải..."
              : device?.nickname || "Chưa có tên"}
          </p>
          <button
            type="button"
            onClick={() => setIsEditingNickname(true)}
            className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Chỉnh sửa tên"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {isEditingNickname && (
        <div>
          {form.formState.errors.nickname && (
            <p className="text-xs text-destructive mb-1">
              {form.formState.errors.nickname.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {form.watch("nickname")?.length || 0}/50 ký tự
          </p>
        </div>
      )}
    </div>
  );
}
