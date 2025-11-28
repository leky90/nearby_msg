/**
 * Shared error state component for feeds
 */

interface FeedErrorStateProps {
  title: string;
  message: string;
}

export function FeedErrorState({ title, message }: FeedErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
      <p className="text-foreground/80 text-center text-base sm:text-lg font-medium">
        {title}
      </p>
      <p className="text-sm text-foreground/60 text-center">{message}</p>
    </div>
  );
}
