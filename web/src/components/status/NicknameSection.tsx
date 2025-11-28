/**
 * Nickname Section Component
 * Editable nickname display and input
 */

import { useState, useEffect } from "react";
import { Edit2, Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDevice } from "@/hooks/useDevice";
import { updateDeviceNickname } from "@/services/device-service";
import { Input } from "@/components/ui/input";
import { validateNickname } from "@/domain/device";
import { showToast } from "@/utils/toast";

export function NicknameSection() {
  const { device, loading: isLoadingDevice } = useDevice();
  const queryClient = useQueryClient();
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState(device?.nickname || "");

  useEffect(() => {
    if (device?.nickname) {
      setNicknameValue(device.nickname);
    }
  }, [device?.nickname]);

  const updateNicknameMutation = useMutation({
    mutationFn: updateDeviceNickname,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device"] });
      setIsEditingNickname(false);
      showToast("Đã cập nhật tên thành công", "success");
    },
    onError: (error: Error) => {
      showToast(error.message || "Lỗi khi cập nhật tên", "error");
    },
  });

  const handleSaveNickname = () => {
    const trimmed = nicknameValue.trim();
    const error = validateNickname(trimmed);
    if (error) {
      showToast(error, "error");
      return;
    }
    updateNicknameMutation.mutate(trimmed);
  };

  const handleCancelEdit = () => {
    setNicknameValue(device?.nickname || "");
    setIsEditingNickname(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/70">
        Tên hiển thị
      </label>
      {isEditingNickname ? (
        <div className="flex items-center gap-2">
          <Input
            value={nicknameValue}
            onChange={(e) => setNicknameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveNickname();
              } else if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
            maxLength={50}
            className="flex-1"
            autoFocus
            disabled={updateNicknameMutation.isPending}
          />
          <button
            type="button"
            onClick={handleSaveNickname}
            disabled={updateNicknameMutation.isPending}
            className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Lưu"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={updateNicknameMutation.isPending}
            className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Hủy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
        <p className="text-xs text-muted-foreground">
          {nicknameValue.length}/50 ký tự
        </p>
      )}
    </div>
  );
}
