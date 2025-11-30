/**
 * Create Group FAB
 * Floating Action Button for creating a new group
 * Hidden if device has already created a group
 */

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { CreateGroupView } from "@/components/groups/CreateGroupView";
import { getDeviceCreatedGroup } from "@/services/group-service";
import { getDatabase } from "@/services/db";
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
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);

  // Check if device already has a group and watch for changes
  useEffect(() => {
    let subscription: (() => void) | null = null;

    const checkAndWatchGroup = async () => {
      const deviceId = localStorage.getItem("device_id") || "";
      if (!deviceId) {
        setHasGroup(false);
        return;
      }

      const db = await getDatabase();

      // Initial check
      const existingGroup = await getDeviceCreatedGroup();
      setHasGroup(existingGroup !== null);

      // Watch for changes (reactive query)
      // Subscribe to groups collection filtered by creator_device_id
      const query = db.groups.find({
        selector: { creator_device_id: deviceId },
      });

      const sub = query.$.subscribe((docs) => {
        setHasGroup(docs.length > 0);
      });

      subscription = () => sub.unsubscribe();
    };

    void checkAndWatchGroup();

    return () => {
      if (subscription) {
        subscription();
      }
    };
  }, []);

  // Hide FAB if device already has a group
  if (hasGroup === true) {
    return null;
  }

  if (showCreateView) {
    return (
      <CreateGroupView
        onGroupCreated={(group) => {
          setShowCreateView(false);
          setHasGroup(true); // Hide FAB immediately after group creation
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
