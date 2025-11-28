/**
 * Message Grouping Utilities
 * Functions for grouping messages by sender and time
 */

import type { Message } from "@/domain/message";
import type { Device } from "@/domain/device";
import { formatMessageDate } from "@/components/chat/MessageBubble";

export interface GroupedMessage {
  message: Message;
  isFirstInGroup: boolean;
  showDateSeparator: boolean;
  dateLabel?: string;
  device?: Device | null;
}

const GROUP_TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes

/**
 * Groups messages by sender and time
 * Messages from the same sender within 5 minutes are grouped together
 */
export function groupMessages(
  messages: Message[],
  _currentDeviceId: string,
  deviceCache: Map<string, Device>
): GroupedMessage[] {
  if (messages.length === 0) return [];

  const grouped: GroupedMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const prevMessage = i > 0 ? messages[i - 1] : null;

    // Check if we need a date separator
    let showDateSeparator = false;
    let dateLabel: string | undefined;

    if (!prevMessage) {
      // First message always shows date
      showDateSeparator = true;
      dateLabel = formatMessageDate(message.created_at);
    } else {
      const prevDate = new Date(prevMessage.created_at);
      const currentDate = new Date(message.created_at);
      const prevDay = new Date(
        prevDate.getFullYear(),
        prevDate.getMonth(),
        prevDate.getDate()
      );
      const currentDay = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      );

      if (prevDay.getTime() !== currentDay.getTime()) {
        showDateSeparator = true;
        dateLabel = formatMessageDate(message.created_at);
      }
    }

    // Check if this is the first message in a group
    let isFirstInGroup = true;
    if (prevMessage) {
      const prevTime = new Date(prevMessage.created_at).getTime();
      const currentTime = new Date(message.created_at).getTime();
      const timeDiff = currentTime - prevTime;

      // Same sender and within time threshold
      if (
        prevMessage.device_id === message.device_id &&
        timeDiff <= GROUP_TIME_THRESHOLD
      ) {
        isFirstInGroup = false;
      }
    }

    // Get device info from cache
    const device = deviceCache.get(message.device_id) || null;

    grouped.push({
      message,
      isFirstInGroup,
      showDateSeparator,
      dateLabel,
      device,
    });
  }

  return grouped;
}
