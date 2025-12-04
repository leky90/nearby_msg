/**
 * SOS Message Component
 * Hiển thị tin nhắn SOS với màu nền tương ứng loại SOS (giống màn SOS)
 */

import { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { Message } from "@/shared/domain/message";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { MapPin, Pin, PinOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  pinMessage,
  unpinMessage,
} from "@/features/messages/services/pin-service";
import { fetchPinnedMessagesAction } from "@/features/messages/store/saga";
import { selectPinnedMessagesByGroupId } from "@/features/messages/store/slice";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import { showToast } from "@/shared/utils/toast";
import { log } from "@/shared/lib/logging/logger";
import type { RootState } from "@/store";

export interface SOSMessageProps {
  /** SOS message to display */
  message: Message;
  /** Whether this message is from current user */
  isOwn?: boolean;
}

const getSOSTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    medical: t("sos.medical"),
    flood: t("sos.flood"),
    fire: t("sos.fire"),
    // Giữ key i18n nhưng nội dung có thể được cập nhật sang "SOS mắc kẹt" trong file i18n
    missing_person: t("sos.missingPerson"),
  };
  return labels[type] || t("sos.medical");
};

const getSOSTypeDescription = (type: string): string | null => {
  const keys: Record<string, string> = {
    medical: "sos.description.medical",
    flood: "sos.description.flood",
    fire: "sos.description.fire",
    missing_person: "sos.description.missingPerson",
  };
  const key = keys[type];
  return key ? t(key) : null;
};

const SOS_TYPE_ICONS: Record<string, string> = {
  medical: "🏥",
  flood: "🌊",
  fire: "🔥",
  missing_person: "🆘",
};

// Style nền / viền / màu chữ theo loại SOS (match SOSView)
const cardStyles: Record<
  string,
  { container: string; title: string; chip: string }
> = {
  medical: {
    container:
      "bg-red-50 text-red-800 border-red-100 shadow-red-100/70 shadow-sm",
    title: "text-red-800",
    chip: "bg-red-600 text-white",
  },
  fire: {
    container:
      "bg-orange-50 text-orange-800 border-orange-100 shadow-orange-100/70 shadow-sm",
    title: "text-orange-800",
    chip: "bg-orange-600 text-white",
  },
  flood: {
    container:
      "bg-blue-50 text-blue-800 border-blue-100 shadow-blue-100/70 shadow-sm",
    title: "text-blue-800",
    chip: "bg-blue-600 text-white",
  },
  missing_person: {
    container:
      "bg-amber-50 text-amber-800 border-amber-100 shadow-amber-100/70 shadow-sm",
    title: "text-amber-800",
    chip: "bg-amber-600 text-white",
  },
};

/**
 * SOS Message component
 * Displays SOS messages with prominent visual styling and good contrast
 */
export function SOSMessage({ message, isOwn = false }: SOSMessageProps) {
  const dispatch = useDispatch();

  if (message.message_type !== "sos" || !message.sos_type) {
    return null;
  }

  // Get pinned messages for this group from Redux
  const pinnedMessages = useSelector((state: RootState) =>
    selectPinnedMessagesByGroupId(state, message.group_id)
  );

  // Check if this message is pinned by ANYONE in the group (for highlight)
  const isPinnedByAnyone = useMemo(() => {
    return pinnedMessages.some((pin) => pin.message.id === message.id);
  }, [pinnedMessages, message.id]);

  // Check if this message is pinned by CURRENT USER (for unpin button)
  const isPinnedByCurrentUser = useMemo(() => {
    const currentDeviceId = getOrCreateDeviceId();
    return pinnedMessages.some(
      (pin) =>
        pin.message.id === message.id &&
        pin.pinned_by_device_id === currentDeviceId
    );
  }, [pinnedMessages, message.id]);

  // Only show pin button if message is not pinned by anyone, or pinned by current user
  // Hide pin button if message is pinned by another user
  const shouldShowPinButton = useMemo(() => {
    return !isPinnedByAnyone || isPinnedByCurrentUser;
  }, [isPinnedByAnyone, isPinnedByCurrentUser]);

  const sosType = message.sos_type;
  const sosLabel = getSOSTypeLabel(sosType);
  const sosIcon = SOS_TYPE_ICONS[sosType] || "🚨";
  const styles = cardStyles[sosType] ?? cardStyles.medical;
  const sosDescription = getSOSTypeDescription(sosType);

  // Tách nội dung chính và phần vị trí (nếu format có chứa "Vị trí:")
  const rawContent = message.content || "";
  const locationKey = "Vị trí:";
  const locationIndex = rawContent.indexOf(locationKey);

  let mainText = rawContent;
  let locationText: string | null = null;

  if (locationIndex !== -1) {
    mainText = rawContent
      .slice(0, locationIndex)
      .trim()
      .replace(/[·\-–]+$/, "")
      .trim();
    locationText = rawContent.slice(locationIndex + locationKey.length).trim();
  }

  const handleOpenMaps = () => {
    if (!locationText) return;
    const query = encodeURIComponent(locationText);
    window.open(
      `https://www.google.com/maps?q=${query}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handlePinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      if (isPinnedByCurrentUser) {
        await unpinMessage(message.id);
      } else {
        await pinMessage(message.id, message.group_id);
      }
      // Refresh pinned messages for this group so UI updates immediately
      dispatch(fetchPinnedMessagesAction(message.group_id));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Không thể ghim tin nhắn";

      log.error("Failed to toggle pin", err, {
        messageId: message.id,
        isPinnedByCurrentUser,
      });

      // Show toast notification for user
      showToast(errorMessage, "error");
    }
  };

  return (
    <div className={cn("flex items-start gap-2", isOwn && "justify-end")}>
      {/* Pin button for owner - on the left */}
      {isOwn && shouldShowPinButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 shrink-0 transition-colors mt-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handlePinClick}
          aria-label={
            isPinnedByCurrentUser ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"
          }
        >
          {isPinnedByCurrentUser ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </Button>
      )}

      <div
        className={cn(
          "rounded-xl border px-4 py-3",
          "w-full max-w-full",
          styles.container,
          isPinnedByAnyone && "ring-2 ring-pink-400 ring-offset-1"
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{sosIcon}</span>
          <div className="flex flex-col flex-1 min-w-0">
            <span
              className={cn("font-bold text-base sm:text-lg", styles.title)}
            >
              {sosLabel}
            </span>
            {sosDescription && (
              <span className="text-[11px] text-gray-700 truncate">
                {sosDescription}
              </span>
            )}
          </div>
          <span
            className={cn(
              "ml-auto rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm",
              styles.chip
            )}
          >
            {t("common.urgent") || "KHẨN CẤP"}
          </span>
        </div>

        {mainText && (
          <div className="text-sm leading-relaxed mb-1 text-current wrap-break-word">
            {mainText}
          </div>
        )}

        {locationText && (
          <button
            type="button"
            onClick={handleOpenMaps}
            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 underline decoration-blue-400"
          >
            <MapPin className="w-3 h-3" />
            <span>{`${locationKey} ${locationText}`}</span>
          </button>
        )}

        <div className="mt-2 text-[11px] leading-none text-gray-600">
          {new Date(message.created_at).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Pin button for other users - on the right */}
      {!isOwn && shouldShowPinButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 shrink-0 transition-colors mt-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handlePinClick}
          aria-label={
            isPinnedByCurrentUser ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"
          }
        >
          {isPinnedByCurrentUser ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
