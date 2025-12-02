/**
 * Chat Loading State Component
 * Displays loading skeleton for chat page
 */

import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export function ChatLoadingState() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header skeleton */}
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className="space-y-4 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn("flex", i % 2 === 0 && "justify-end")}>
              <div
                className={cn(
                  "space-y-2 max-w-[75%]",
                  i % 2 === 0 && "items-end"
                )}
              >
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input skeleton */}
      <div className="border-t bg-background p-4">
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
