/**
 * Message Input Component
 * Input field with send button for composing messages
 */

import { useState, type KeyboardEvent } from "react";
import { Send, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Alert, AlertDescription } from "../ui/alert";
import { cn } from "@/lib/utils";
import { showToast } from "../../utils/toast";

export interface MessageInputProps {
  /** Callback when message is sent */
  onSend: (content: string) => void | Promise<void>;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom className */
  className?: string;
}

const MAX_MESSAGE_LENGTH = 500;

/**
 * Message Input component
 * Provides input field with send button for composing messages
 */
export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  className = "",
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = content.trim();
    setError(null);

    if (!trimmed || trimmed.length === 0) {
      setError("Message cannot be empty");
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less`);
      return;
    }

    try {
      setIsSending(true);
      await onSend(trimmed);
      setContent("");
      setError(null);
      showToast("Message sent", "success");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      showToast(errorMessage, "error");
      // Keep content on error so user can retry
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const remainingChars = MAX_MESSAGE_LENGTH - content.length;
  const canSend =
    content.trim().length > 0 &&
    content.length <= MAX_MESSAGE_LENGTH &&
    !isSending;

  return (
    <div className={cn("border-t bg-background", className)}>
      {error && (
        <Alert variant="destructive" className="m-4 mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2 p-4">
        <Input
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          isDisabled={disabled || isSending}
          maxLength={MAX_MESSAGE_LENGTH}
          className="flex-1"
          aria-invalid={!!error}
          aria-describedby={error ? "message-input-error" : undefined}
          aria-label="Message input"
        />
        <Button
          onClick={handleSend}
          isDisabled={!canSend || disabled}
          size="icon"
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
        {remainingChars < 50 && (
          <span
            className={cn(
              "text-xs min-w-[2rem] text-right",
              remainingChars < 10 ? "text-destructive" : "text-muted-foreground"
            )}
            aria-live="polite"
          >
            {remainingChars}
          </span>
        )}
      </div>
      {error && (
        <p id="message-input-error" className="sr-only">
          {error}
        </p>
      )}
    </div>
  );
}
