/**
 * Shared empty state component for feeds
 */

import { Plus, Compass } from "lucide-react";

interface FeedEmptyStateProps {
  title: string;
  message: string;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  showActionButton?: boolean;
  actionButtonLabel?: string;
  onActionClick?: () => void;
}

export function FeedEmptyState({
  title,
  message,
  showCreateButton = false,
  onCreateClick,
  showActionButton = false,
  actionButtonLabel = "Thực hiện",
  onActionClick,
}: FeedEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
      <p className="text-foreground/80 text-center text-base sm:text-lg font-medium">
        {title}
      </p>
      <p className="text-sm text-foreground/60 text-center">{message}</p>
      {showCreateButton && onCreateClick && (
        <button
          onClick={onCreateClick}
          className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Tạo nhóm khu vực
        </button>
      )}
      {showActionButton && onActionClick && (
        <button
          onClick={onActionClick}
          className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
        >
          <Compass className="h-4 w-4" />
          {actionButtonLabel}
        </button>
      )}
    </div>
  );
}
