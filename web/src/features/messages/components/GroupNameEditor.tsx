/**
 * Group Name Editor Component
 * Inline editing for group name
 */

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Edit2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useDispatch, useSelector } from "react-redux";
import { updateGroupNameAction } from "@/features/groups/store/groupSaga";
import {
  selectGroupLoading,
  selectGroupError,
} from "@/features/groups/store/slice";
import { selectDevice } from "@/features/device/store/slice";
import { showToast } from "@/shared/utils/toast";
import type { Group } from "@/shared/domain/group";
import type { RootState } from "@/store";
import {
  groupNameSchema,
  type GroupNameFormData,
} from "../schemas/group-name.schema";

export interface GroupNameEditorProps {
  group: Group;
}

export function GroupNameEditor({ group }: GroupNameEditorProps) {
  // All hooks must be called before any early returns (Rules of Hooks)
  const dispatch = useDispatch();
  const [isEditingName, setIsEditingName] = useState(false);

  // Calculate isCreator from Redux state (moved from ChatHeader)
  const device = useSelector((state: RootState) => selectDevice(state));
  const isCreator = useMemo(() => {
    if (!device?.id) return false;
    return group.creator_device_id === device.id;
  }, [group.creator_device_id, device?.id]);

  // Form state managed by react-hook-form (mode: onBlur for inline editing)
  const form = useForm<GroupNameFormData>({
    resolver: standardSchemaResolver(groupNameSchema),
    defaultValues: {
      name: group.name,
    },
    mode: "onBlur", // Validate on blur for better UX in inline editing
  });

  // Get loading and error states from Redux
  const isUpdating = useSelector((state: RootState) =>
    selectGroupLoading(state, group.id)
  );
  const updateError = useSelector((state: RootState) =>
    selectGroupError(state, group.id)
  );

  // Update form when group name changes in Redux (only when not editing)
  // All hooks must be called before any early returns
  useEffect(() => {
    if (!isEditingName) {
      form.reset({ name: group.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.name, isEditingName]);

  // Handle update success/error from Redux
  useEffect(() => {
    if (!isEditingName) return;

    if (updateError) {
      // Update failed - show error and close editing mode
      showToast(updateError, "error");
      form.setError("root", { message: updateError });
      // Note: setState in effect is acceptable here for error handling

      setIsEditingName(false);
    } else if (!isUpdating && group.name === form.getValues("name")?.trim()) {
      // Update succeeded - name matches what we tried to save, and not loading anymore
      showToast("Đã cập nhật tên khu vực", "success");
      setIsEditingName(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateError, isUpdating, isEditingName, group.name]);

  const handleStartEdit = () => {
    setIsEditingName(true);
    form.reset({ name: group.name });
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    form.reset({ name: group.name });
  };

  const onSubmit = (data: GroupNameFormData) => {
    // Double-check permission before saving
    if (!isCreator) {
      showToast("Chỉ chủ sở hữu mới có quyền chỉnh sửa tên khu vực", "error");
      setIsEditingName(false);
      return;
    }

    const trimmed = data.name.trim();
    if (trimmed === group.name) {
      setIsEditingName(false);
      return;
    }

    // Dispatch Redux action - saga handles the update
    // Loading and error states are managed by Redux
    dispatch(updateGroupNameAction(group.id, trimmed));

    // Don't close editing mode immediately - wait for success/error from Redux
    // Success: group.name will update in Redux, useEffect will close editing mode
    // Error: updateError will be set, useEffect will show error and close editing mode
  };

  if (isEditingName) {
    return (
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Input
            {...form.register("name")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                form.handleSubmit(onSubmit)();
              } else if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
            maxLength={100}
            disabled={isUpdating}
            className="h-6 text-sm px-2 py-0 flex-1 min-w-0"
            autoFocus
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={
              form.formState.errors.name ? "group-name-error" : undefined
            }
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            isDisabled={isUpdating || !form.formState.isValid}
            className="h-6 w-6 p-0 shrink-0"
            aria-label="Lưu"
          >
            {isUpdating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancelEdit}
            isDisabled={isUpdating}
            className="h-6 w-6 p-0 shrink-0"
            aria-label="Hủy"
          >
            <X className="size-3" />
          </Button>
        </form>
        {form.formState.errors.name && (
          <p
            id="group-name-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleStartEdit}
        className="h-6 w-6 p-0 shrink-0"
        aria-label="Chỉnh sửa tên"
      >
        <Edit2 className="size-3" />
      </Button>
    </>
  );
}
