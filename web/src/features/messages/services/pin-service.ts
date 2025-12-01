/**
 * Pin Service
 * Handles pinned message operations
 */

import type { PinnedMessage } from "@/shared/domain/pinned_message";
import { post, del, get } from '@/shared/services/api';
import { getDatabase } from '@/shared/services/db';
import { getOrCreateDeviceId } from '@/features/device/services/device-storage';

/**
 * Pins a message
 * @param messageId - Message ID to pin
 * @param tag - Optional tag for the pin
 * @returns Created pinned message
 */
export async function pinMessage(messageId: string, tag?: string): Promise<PinnedMessage> {
  const response = await post<PinnedMessage>(`/messages/${messageId}/pin`, tag ? { tag } : {});

  // Store in RxDB
  const db = await getDatabase();
  await db.pinned_messages.upsert(response);

  return response;
}

/**
 * Unpins a message
 * @param messageId - Message ID to unpin
 */
export async function unpinMessage(messageId: string): Promise<void> {
  await del(`/messages/${messageId}/pin`);

  // Remove from RxDB
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const pin = await db.pinned_messages
    .findOne({
      selector: {
        device_id: deviceId,
        message_id: messageId,
      },
    })
    .exec();

  if (pin) {
    await pin.remove();
  }
}

/**
 * Gets all pinned messages for a group
 * @param groupId - Group ID
 * @returns Array of pinned messages
 */
export async function getPinnedMessages(groupId: string): Promise<PinnedMessage[]> {
  const response = await get<PinnedMessage[]>(`/groups/${groupId}/pinned`);

  // Store in RxDB
  const db = await getDatabase();
  for (const pin of response) {
    await db.pinned_messages.upsert(pin);
  }

  return response;
}

/**
 * Checks if a message is pinned by current device
 * @param messageId - Message ID to check
 * @returns True if pinned
 */
export async function isPinned(messageId: string): Promise<boolean> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const pin = await db.pinned_messages
    .findOne({
      selector: {
        device_id: deviceId,
        message_id: messageId,
      },
    })
    .exec();
  return pin !== null;
}

