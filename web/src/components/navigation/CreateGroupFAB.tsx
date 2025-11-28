/**
 * Create Group FAB
 * Floating Action Button for creating a new group
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateGroupView } from "@/components/groups/CreateGroupView";
import { cn } from "@/lib/utils";
import type { Group } from "@/domain/group";

interface CreateGroupFABProps {
  onGroupCreated?: (group: Group) => void;
  className?: string;
}

export function CreateGroupFAB({
  onGroupCreated,
  className,
}: CreateGroupFABProps) {
  const [showCreateView, setShowCreateView] = useState(false);

  if (showCreateView) {
    return (
      <CreateGroupView
        onGroupCreated={(group) => {
          setShowCreateView(false);
          onGroupCreated?.(group);
        }}
        onCancel={() => setShowCreateView(false)}
      />
    );
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
