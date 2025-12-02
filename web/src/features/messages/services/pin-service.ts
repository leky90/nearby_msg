/**
 * Pin Service
 * Handles pinned message operations
 * Uses RxDB-first approach with mutation queue for offline support
 */

import type { PinnedMessage } from "@/shared/domain/pinned_message";
import { getDatabase } from '@/shared/services/db';
import { getOrCreateDeviceId } from '@/features/device/services/device-storage';
import { queueMutation } from '@/features/replication/services/mutation-queue';
import { generateId } from "@/shared/utils/id";

/**
 * Pins a message
 * Uses optimistic update: creates pinned message in RxDB immediately, queues mutation for sync
 * @param messageId - Message ID to pin
 * @param groupId - Group ID of the message
 * @param tag - Optional tag for the pin
 * @returns Created pinned message (optimistic)
 */
export async function pinMessage(
  messageId: string,
  groupId: string,
  tag?: string
): Promise<PinnedMessage> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();

  // Create optimistic pinned message in RxDB immediately
  const optimisticPin: PinnedMessage = {
    id: generateId(),
    message_id: messageId,
    group_id: groupId,
    device_id: deviceId,
    pinned_at: now,
    tag,
  };

  // Store optimistic pin in RxDB
  await db.pinned_messages.upsert(optimisticPin);

  // Queue mutation for sync (replication will push to server)
  await queueMutation(
    'pin_message',
    'pinned_messages',
    {
      message_id: messageId,
      tag: tag || null,
    },
    optimisticPin.id
  );

  return optimisticPin;
}

/**
 * Unpins a message
 * Uses optimistic update: removes from RxDB immediately, queues mutation for sync
 * @param messageId - Message ID to unpin
 */
export async function unpinMessage(messageId: string): Promise<void> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();

  // Find and remove optimistic pin from RxDB
  const pin = await db.pinned_messages
    .findOne({
      selector: {
        device_id: deviceId,
        message_id: messageId,
      },
    })
    .exec();

  if (pin) {
    const pinId = pin.id;
    await pin.remove();

    // Queue mutation for sync (replication will push to server)
    await queueMutation(
      'unpin_message',
      'pinned_messages',
      {
        message_id: messageId,
      },
      pinId
    );
  }
}

/**
 * Gets all pinned messages for a group
 * RxDB-first approach: reads from local cache, replication keeps it fresh
 * @param groupId - Group ID
 * @returns Array of pinned messages from RxDB
 */
export async function getPinnedMessages(groupId: string): Promise<PinnedMessage[]> {
  const db = await getDatabase();

  // Get all messages for this group from RxDB
  const messages = await db.messages
    .find({
      selector: {
        group_id: groupId,
      },
    })
    .exec();

  const messageIds = new Set(messages.map((m) => m.id));

  // Get all pinned messages for these message IDs from RxDB
  const pinnedDocs = await db.pinned_messages
    .find({
      selector: {
        message_id: { $in: Array.from(messageIds) },
      },
    })
    .exec();

  return pinnedDocs.map((doc) => doc.toJSON() as PinnedMessage);
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

