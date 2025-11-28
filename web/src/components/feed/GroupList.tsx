/**
 * GroupList Component
 * Renders a virtualized list of groups
 * Single Responsibility: Group list rendering and virtualization
 */

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { GroupListItem } from './GroupListItem';
import { formatDistance } from '@/utils/distance';
import type { GroupDetail } from '@/hooks/useGroupDetails';

export interface GroupListProps {
  /** Group details to render */
  groupDetails: GroupDetail[];
  /** Callback when group is selected */
  onGroupSelect: (groupId: string) => void;
  /** Callback when favorite is toggled */
  onFavoriteToggle: (groupId: string, shouldFavorite: boolean) => void;
  /** Optional className */
  className?: string;
}

/**
 * GroupList component
 * Renders virtualized list of groups
 */
export function GroupList({
  groupDetails,
  onGroupSelect,
  onFavoriteToggle,
  className,
}: GroupListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: groupDetails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated list item height
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className={cn(className, 'overflow-y-auto overflow-x-hidden')}
      style={{
        height: '100%',
        width: '100%',
        maxWidth: '100%',
        overscrollBehaviorY: 'contain',
        overscrollBehaviorX: 'none',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          maxWidth: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const detail = groupDetails[virtualItem.index];
          if (!detail) return null;

          const {
            group,
            distance,
            latestMessagePreview,
            unreadCount,
            isFavorited,
          } = detail;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                maxWidth: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-2 sm:px-4 py-1.5"
            >
              <GroupListItem
                group={group}
                distance={distance}
                distanceDisplay={distance !== null ? formatDistance(distance) : ""}
                latestMessagePreview={latestMessagePreview}
                isFavorited={isFavorited}
                unreadCount={unreadCount}
                onClick={() => onGroupSelect(group.id)}
                onFavoriteToggle={(newIsFavorited) =>
                  onFavoriteToggle(group.id, newIsFavorited)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
