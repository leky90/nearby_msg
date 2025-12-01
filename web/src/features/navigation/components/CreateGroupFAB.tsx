/**
 * Create Group FAB
 * Floating Action Button for creating a new group
 * Hidden if device has already created a group
 * Uses Redux state managed by groupSaga
 */

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { CreateGroupView } from "@/features/groups/components/CreateGroupView";
import { selectHasDeviceCreatedGroup } from "@/features/groups/store/slice";
import { checkDeviceCreatedGroupAction } from "@/features/groups/store/groupSaga";
import { cn } from "@/shared/lib/utils";
import type { RootState } from "@/store";

interface CreateGroupFABProps {
  className?: string;
}

export function CreateGroupFAB({ className }: CreateGroupFABProps) {
  const dispatch = useDispatch();
  const hasGroup = useSelector((state: RootState) =>
    selectHasDeviceCreatedGroup(state)
  );
  const [showCreateView, setShowCreateView] = useState(false);

  // Check device created group when component mounts
  useEffect(() => {
    dispatch(checkDeviceCreatedGroupAction());
  }, [dispatch]);

  // Hide FAB if device already has a group
  if (hasGroup) {
    return null;
  }

  if (showCreateView) {
    return <CreateGroupView onCancel={() => setShowCreateView(false)} />;
  }

  return (
    <div
      className={cn(
        "fixed left-4 z-40",
        "bottom-[calc(4rem+1rem+env(safe-area-inset-bottom,0px))]",
        "transition-all duration-200",
        className
      )}
    >
      <button
        onClick={() => setShowCreateView(true)}
        className={cn(
          "w-14 h-14 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-lg hover:shadow-xl",
          "flex items-center justify-center",
          "transition-all duration-200",
          "active:scale-95",
          "hover:scale-105",
          "ring-2 ring-primary/30"
        )}
        aria-label="Tạo nhóm khu vực"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
