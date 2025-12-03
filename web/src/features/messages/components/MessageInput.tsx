/**
 * Message Input Component
 * Modern chat input with quick message suggestions
 */

import { useState, useRef, type KeyboardEvent } from "react";
import { Send, AlertCircle, Loader2, Pin } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils";
import { showToast } from "@/shared/utils/toast";
import { t } from "@/shared/lib/i18n";

export interface MessageInputProps {
  /** Callback when message is sent */
  onSend: (content: string) => void | Promise<void>;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom className */
  className?: string;
  /** Callback when pin button is clicked */
  onPinClick?: () => void;
  /** Number of pinned messages */
  pinnedCount?: number;
}

const MAX_MESSAGE_LENGTH = 500;

/**
 * Quick message suggestions for emergency situations
 */
const QUICK_MESSAGES = [
  {
    category: "Cần giúp đỡ",
    messages: [
      "Tôi cần nước uống",
      "Tôi cần lương thực",
      "Tôi cần sạc điện thoại",
      "Tôi cần hỗ trợ y tế",
      "Tôi cần thuốc men",
      "Tôi cần chỗ ở tạm",
      "Tôi cần quần áo",
      "Tôi cần chăn màn",
    ],
  },
  {
    category: "Có thể hỗ trợ",
    messages: [
      "Tôi có nước uống",
      "Tôi có lương thực",
      "Tôi có thể sạc điện",
      "Tôi có thể hỗ trợ y tế",
      "Tôi có chỗ ở tạm",
      "Tôi có quần áo",
      "Tôi có chăn màn",
    ],
  },
  {
    category: "Thông tin",
    messages: [
      "Tất cả an toàn",
      "Đã có điện",
      "Đã có nước",
      "Đường đã thông",
      "Cần tránh khu vực này",
    ],
  },
];

/**
 * Message Input component
 * Modern chat input with quick message suggestions
 */
export function MessageInput({
  onSend,
  disabled = false,
  placeholder = t("component.messageInput.placeholder"),
  className = "",
  onPinClick,
  pinnedCount = 0,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = async () => {
    const trimmed = content.trim();
    setError(null);

    if (!trimmed || trimmed.length === 0) {
      setError(t("component.messageInput.messageCannotBeEmpty"));
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(
        t("component.messageInput.messageTooLong", { max: MAX_MESSAGE_LENGTH })
      );
      return;
    }

    try {
      setIsSending(true);
      await onSend(trimmed);
      setContent("");
      setError(null);
      // Don't show toast - message appears in chat naturally
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("component.messageInput.failedToSend");
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
      if (!isSending && content.trim().length > 0) {
        void handleSend();
      }
    }
  };

  const handleSuggestionClick = (message: string) => {
    // Clear any pending blur timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    setContent(message);
    setShowSuggestions(false);

    // Auto-focus input after selecting suggestion
    setTimeout(() => {
      const input = document.querySelector(
        'input[aria-label="Nhập tin nhắn"]'
      ) as HTMLInputElement;
      input?.focus();
    }, 50);
  };

  const remainingChars = MAX_MESSAGE_LENGTH - content.length;
  const canSend =
    content.trim().length > 0 &&
    content.length <= MAX_MESSAGE_LENGTH &&
    !isSending &&
    !disabled;

  return (
    <div className={cn("bg-background", className)}>
      {error && (
        <Alert variant="destructive" className="m-4 mb-2 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick message suggestions - only show when focused and input is empty */}
      {isFocused && showSuggestions && content.length === 0 && (
        <div className="px-4 pt-3 pb-2 border-b bg-muted/30">
          <div className="space-y-2">
            {QUICK_MESSAGES.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground px-1">
                  {category.category}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {category.messages.map((message, msgIndex) => (
                    <Button
                      key={msgIndex}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-7 px-3 text-xs rounded-full",
                        "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                        "transition-colors"
                      )}
                      onMouseDown={(e) => {
                        // Prevent input blur when clicking suggestion
                        e.preventDefault();
                      }}
                      onClick={() => handleSuggestionClick(message)}
                      type="button"
                    >
                      {message}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 p-4">
        {/* Pin button - left side of input */}
        {onPinClick && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPinClick}
              className="h-12 w-12 rounded-full shrink-0"
              aria-label="Xem tin nhắn đã ghim"
            >
              <Pin className="size-5" />
            </Button>
            {pinnedCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none">
                {pinnedCount > 9 ? "9+" : pinnedCount}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 relative">
          <Input
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
              // Hide suggestions when typing
              if (e.target.value.length > 0) {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              // Clear any pending blur timeout
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
              }
              setIsFocused(true);
              // Show suggestions when focused and input is empty
              if (content.length === 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
              // Delay hiding suggestions to allow clicking on them
              blurTimeoutRef.current = setTimeout(() => {
                setShowSuggestions(false);
                blurTimeoutRef.current = null;
              }, 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            maxLength={MAX_MESSAGE_LENGTH}
            className={cn(
              "h-12 pr-12 rounded-full border-2 transition-all",
              "focus:border-primary focus:ring-0",
              error && "border-destructive focus:border-destructive",
              "text-sm"
            )}
            aria-invalid={!!error}
            aria-describedby={error ? "message-input-error" : undefined}
            aria-label="Nhập tin nhắn"
          />

          {/* Character count - show when approaching limit */}
          {remainingChars < 50 && (
            <span
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium",
                remainingChars < 10
                  ? "text-destructive"
                  : remainingChars < 20
                    ? "text-warning"
                    : "text-muted-foreground"
              )}
              aria-live="polite"
            >
              {remainingChars}
            </span>
          )}
        </div>

        <Button
          onClick={handleSend}
          isDisabled={!canSend}
          size="default"
          className={cn(
            "h-12 w-12 rounded-full shrink-0 transition-all",
            canSend && "hover:scale-105 active:scale-95"
          )}
          aria-label="Gửi tin nhắn"
        >
          {isSending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>

      {error && (
        <p id="message-input-error" className="sr-only">
          {error}
        </p>
      )}
    </div>
  );
}
