/**
 * Create Group View - Simplified
 * Full-screen view for creating a new group from empty state
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { createGroup } from "@/services/group-service";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LocationInput } from "@/components/common/LocationInput";
import { useLocationInput } from "@/hooks/useLocationInput";
import { useAppStore } from "@/stores/app-store";
import { showToast } from "@/utils/toast";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Group } from "@/domain/group";

interface CreateGroupViewProps {
  onGroupCreated: (group: Group) => void;
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

export function CreateGroupView({
  onGroupCreated,
  onCancel,
}: CreateGroupViewProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<Group["type"]>("village");
  const [error, setError] = useState<string | null>(null);
  const GROUP_TYPES = getGroupTypes();

  const locationInput = useLocationInput({
    saveToStorage: false,
    onLocationSet: () => {
      setError(null);
    },
  });

  // Load current location on mount
  useEffect(() => {
    const loadLocation = async () => {
      // If location is already set in app store, use it
      const { deviceLocation } = useAppStore.getState();
      if (deviceLocation) {
        // Location already exists, don't request again
        return;
      }

      // If location is already set in this hook, use it
      if (locationInput.location) {
        return;
      }

      try {
        await locationInput.handleRequestGPS();
        if (!locationInput.location) {
          setError(
            "Không thể lấy vị trí. Vui lòng bật GPS hoặc nhập link Google Maps."
          );
          locationInput.setShowManualInput(true);
        }
      } catch (err) {
        console.error("Failed to get location:", err);
        setError(
          "Không thể lấy vị trí. Vui lòng bật GPS hoặc nhập link Google Maps."
        );
        locationInput.setShowManualInput(true);
      }
    };

    void loadLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: {
      name: string;
      type: Group["type"];
      latitude: number;
      longitude: number;
    }) => {
      return createGroup(groupData);
    },
    onSuccess: (group) => {
      // Invalidate groups queries to refresh feeds
      queryClient.invalidateQueries({ queryKey: ["nearby-groups"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-groups"] });
      showToast("Đã tạo nhóm khu vực thành công!", "success");
      onGroupCreated(group);
    },
    onError: (err) => {
      const errorMessage =
        err instanceof Error ? err.message : "Không thể tạo nhóm";
      if (
        errorMessage.includes("already created") ||
        errorMessage.includes("409")
      ) {
        setError(
          "Bạn đã tạo nhóm khu vực. Mỗi thiết bị chỉ có thể tạo một nhóm."
        );
      } else {
        setError(errorMessage);
      }
      showToast(errorMessage, "error");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên khu vực");
      return;
    }

    if (trimmed.length > 100) {
      setError("Tên khu vực không được quá 100 ký tự");
      return;
    }

    if (!locationInput.location) {
      setError("Không thể lấy vị trí. Vui lòng bật GPS.");
      return;
    }

    createGroupMutation.mutate({
      name: trimmed,
      type,
      latitude: locationInput.location.latitude,
      longitude: locationInput.location.longitude,
    });
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
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-3">
              <p>{error}</p>
              {error.includes("Không thể lấy vị trí") && (
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Input */}
          <LocationInput
            locationInput={locationInput}
            showInstructions={false}
            disabled={createGroupMutation.isPending}
          />

          {/* Group Type */}
          <div className="space-y-2">
            <Label htmlFor="group-type">Loại khu vực</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as Group["type"])}
              disabled={
                locationInput.isLoadingLocation || createGroupMutation.isPending
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
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Tên khu vực</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Ví dụ: Xóm ABC, Thôn Đông, Phường 5"
              maxLength={100}
              autoFocus={!locationInput.showManualInput}
              disabled={
                locationInput.isLoadingLocation || createGroupMutation.isPending
              }
              className={cn(error && "border-destructive")}
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/100 ký tự. Nhập tên thôn/xóm/phường/xã để dễ nhận
              biết khu vực trong tình huống khẩn cấp.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onPress={onCancel}
              isDisabled={createGroupMutation.isPending}
              className="flex-1"
            >
              Hủy
            </Button>
            <button
              type="submit"
              disabled={
                locationInput.isLoadingLocation ||
                createGroupMutation.isPending ||
                !name.trim() ||
                !locationInput.location
              }
              className="flex-1 h-12 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-default outline-none border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {createGroupMutation.isPending ? (
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
