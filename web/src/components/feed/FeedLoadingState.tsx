/**
 * Shared loading state component for feeds
 */

import { Skeleton } from "@/components/ui/skeleton";

export function FeedLoadingState() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[500px] w-full rounded-lg" />
      ))}
    </div>
  );
}
