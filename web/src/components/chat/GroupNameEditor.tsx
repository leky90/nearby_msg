/**
 * Group Name Editor Component
 * Inline editing for group name
 */

import { useState, useEffect } from "react";
import { Edit2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateGroupName } from "@/services/group-service";
import { useDispatch } from "react-redux";
import { fetchGroupDetailsAction } from "@/store/sagas/groupSaga";
import { showToast } from "@/utils/toast";
import type { Group } from "@/domain/group";
import { log } from "@/lib/logging/logger";

export interface GroupNameEditorProps {
  group: Group;
  isCreator: boolean;
  onGroupUpdated?: (group: Group) => void;
}

export function GroupNameEditor({
  group,
  isCreator,
  onGroupUpdated,
}: GroupNameEditorProps) {
  const dispatch = useDispatch();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(group.name);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setEditedName(group.name);
  }, [group.name]);

  const handleStartEdit = () => {
    setIsEditingName(true);
    setEditedName(group.name);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName(group.name);
  };

  const handleSaveName = async () => {
    // Double-check permission before saving
    if (!isCreator) {
      showToast("Chỉ chủ sở hữu mới có quyền chỉnh sửa tên khu vực", "error");
      setIsEditingName(false);
      return;
    }

    const trimmed = editedName.trim();
    if (!trimmed) {
      showToast("Tên khu vực không được để trống", "error");
      return;
    }
    if (trimmed.length > 100) {
      showToast("Tên khu vực không được quá 100 ký tự", "error");
      return;
    }
    if (trimmed === group.name) {
      setIsEditingName(false);
      return;
    }

    setIsUpdating(true);
    try {
      const updatedGroup = await updateGroupName(group.id, trimmed);
      setIsEditingName(false);

      // Update Redux state by refetching group details and nearby groups
      dispatch(fetchGroupDetailsAction(group.id));
      // Note: nearby groups will be refreshed when user navigates back to feed
      // For now, we'll just update the local group state

      onGroupUpdated?.(updatedGroup);
      showToast("Đã cập nhật tên khu vực", "success");
    } catch (err) {
      log.error("Failed to update group name", err, {
        groupId: group.id,
        newName: trimmed,
      });
      let errorMessage = "Không thể cập nhật tên khu vực";

      if (err instanceof Error) {
        // Check for permission errors
        if (
          err.message.includes("only the creator") ||
          err.message.includes("Forbidden")
        ) {
          errorMessage = "Chỉ chủ sở hữu mới có quyền chỉnh sửa tên khu vực";
        } else {
          errorMessage = err.message;
        }
      }

      showToast(errorMessage, "error");
      setIsEditingName(false);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isEditingName) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Input
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleSaveName();
            } else if (e.key === "Escape") {
              handleCancelEdit();
            }
          }}
          maxLength={100}
          disabled={isUpdating}
          className="h-6 text-sm px-2 py-0 flex-1 min-w-0"
          autoFocus
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSaveName}
          isDisabled={isUpdating}
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
          variant="ghost"
          size="sm"
          onClick={handleCancelEdit}
          isDisabled={isUpdating}
          className="h-6 w-6 p-0 shrink-0"
          aria-label="Hủy"
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-sm font-semibold truncate">{group.name}</h2>
      {isCreator && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStartEdit}
          className="h-6 w-6 p-0 shrink-0"
          aria-label="Chỉnh sửa tên"
        >
          <Edit2 className="size-3" />
        </Button>
      )}
    </>
  );
}
