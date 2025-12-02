/**
 * Nickname Section Component
 * Editable nickname display and input
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Edit2, Check, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { updateDeviceAction } from "@/features/device/store/saga";
import {
  selectDevice,
  selectDeviceLoading,
  selectDeviceError,
} from "@/features/device/store/slice";
import { Input } from "@/shared/components/ui/input";
import type { RootState } from "@/store";
import {
  nicknameSchema,
  type NicknameFormData,
} from "../schemas/nickname.schema";
import { useFormUpdateHandler } from "@/shared/hooks/useFormUpdateHandler";

// Constants
const BUTTON_BASE_CLASSES =
  "h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors";
const BUTTON_DISABLED_CLASSES =
  "disabled:opacity-50 disabled:pointer-events-none";

export function NicknameSection() {
  const device = useSelector((state: RootState) => selectDevice(state));
  const isLoadingDevice = useSelector((state: RootState) =>
    selectDeviceLoading(state)
  );
  const dispatch = useDispatch();
  const [isEditingNickname, setIsEditingNickname] = useState(false);

  // Form state managed by react-hook-form (mode: onBlur for inline editing)
  const form = useForm<NicknameFormData>({
    resolver: standardSchemaResolver(nicknameSchema),
    defaultValues: {
      nickname: device?.nickname || "",
    },
    mode: "onBlur",
  });

  // Get loading and error states from Redux
  const isUpdating = useSelector((state: RootState) =>
    selectDeviceLoading(state)
  );
  const updateError = useSelector((state: RootState) =>
    selectDeviceError(state)
  );

  // Handle update success/error using custom hook (SOLID - Single Responsibility)
  const { handleSubmit: handleUpdateSubmit, handleCancel: handleUpdateCancel } =
    useFormUpdateHandler({
      form,
      isEditing: isEditingNickname,
      isUpdating,
      updateError,
      currentValue: device?.nickname,
      onCloseEdit: () => setIsEditingNickname(false),
      successMessage: "Đã cập nhật tên thành công",
    });

  // Update form when device nickname changes in Redux (only when not editing)
  useEffect(() => {
    if (device?.nickname && !isEditingNickname) {
      const currentFormValue = form.getValues("nickname");
      if (currentFormValue !== device.nickname) {
        form.reset({ nickname: device.nickname });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.nickname, isEditingNickname]);

  const onSubmit = (data: NicknameFormData) => {
    const trimmedNickname = handleUpdateSubmit(data.nickname);
    dispatch(updateDeviceAction({ nickname: trimmedNickname }));
  };

  const handleCancelEdit = () => {
    form.reset({ nickname: device?.nickname || "" });
    setIsEditingNickname(false);
    handleUpdateCancel();
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
            className={`${BUTTON_BASE_CLASSES} ${BUTTON_DISABLED_CLASSES}`}
            aria-label="Lưu"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={isUpdating}
            className={`${BUTTON_BASE_CLASSES} ${BUTTON_DISABLED_CLASSES}`}
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
            className={BUTTON_BASE_CLASSES}
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
