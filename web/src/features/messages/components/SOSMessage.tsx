/**
 * SOS Message Component
 * Displays SOS messages with visual distinction using Taki UI Message
 */

import type { Message } from "@/shared/domain/message";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import {
  Message as MessageComponent,
  MessageContent,
} from "@/shared/components/ui/message";

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
    missing_person: t("sos.missingPerson"),
  };
  return labels[type] || t("sos.medical");
};

const SOS_TYPE_ICONS: Record<string, string> = {
  medical: "🏥",
  flood: "🌊",
  fire: "🔥",
  missing_person: "👤",
};

/**
 * SOS Message component
 * Displays SOS messages with prominent visual styling
 */
export function SOSMessage({ message, isOwn = false }: SOSMessageProps) {
  if (message.message_type !== "sos" || !message.sos_type) {
    return null;
  }

  const sosType = message.sos_type;
  const sosLabel = getSOSTypeLabel(sosType);
  const sosIcon = SOS_TYPE_ICONS[sosType] || "🚨";

  return (
    <MessageComponent
      from={isOwn ? "user" : "assistant"}
      className={cn(
        "rounded-lg border-2 border-sos bg-sos/10 shadow-lg",
        isOwn && "border-sos bg-sos/20"
      )}
    >
      <MessageContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{sosIcon}</span>
          <span className="font-bold text-sos text-heading-2 leading-heading-2">
            {sosLabel}
          </span>
          <span className="ml-auto rounded-full bg-sos px-3 py-1 text-caption leading-caption font-bold text-white">
            {t("common.urgent") || "KHẨN CẤP"}
          </span>
        </div>
        <div className="text-body leading-body font-medium mb-2">
          {message.content}
        </div>
        <div className="text-caption leading-caption text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </MessageContent>
    </MessageComponent>
  );
}
