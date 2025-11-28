/**
 * Shared loading state component for feeds
 */

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface FeedLoadingStateProps {
  onBack?: () => void;
}

export function FeedLoadingState({ onBack }: FeedLoadingStateProps) {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      {onBack && (
        <div className="flex justify-start mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Trở về
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4 flex-1">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[500px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
