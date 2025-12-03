/**
 * Favorite Button Component
 * Handles favorite toggle functionality
 * Manages its own isFavorited state from Redux
 */

import { Star } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { selectIsFavoriteGroup } from "@/features/groups/store/slice";
import { toggleFavoriteAction } from "@/features/groups/store/groupSaga";
import { t } from "@/shared/lib/i18n";
import type { RootState } from "@/store";

export interface FavoriteButtonProps {
  groupId: string;
  className?: string;
}

export function FavoriteButton({ groupId, className }: FavoriteButtonProps) {
  const dispatch = useDispatch();

  // Read favorite status from Redux store (consistent with GroupListItem)
  const isFavorited = useSelector((state: RootState) =>
    selectIsFavoriteGroup(state, groupId)
  );

  // Handle favorite toggle - dispatch Redux action directly
  const handleFavoriteToggle = () => {
    dispatch(toggleFavoriteAction(groupId));
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleFavoriteToggle}
      className={cn("h-8 w-8 p-0", isFavorited && "text-yellow-500", className)}
      aria-label={isFavorited ? t("button.unfavorite") : t("button.favorite")}
    >
      <Star className={cn("h-4 w-4", isFavorited && "fill-current")} />
    </Button>
  );
}
