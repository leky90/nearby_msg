/**
 * Pin Service
 * Handles pinned message operations
 * Uses RxDB-first approach with mutation queue for offline support
 */

import type { PinnedMessage } from "@/shared/domain/pinned_message";
import { getDatabase } from "@/shared/services/db";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import { queueMutation } from "@/features/replication/services/mutation-queue";
import { generateId } from "@/shared/utils/id";

/**
 * Pins a message
 * Uses optimistic update: creates pinned message in RxDB immediately, sends via WebSocket
 * Note: Each user can pin max 5 messages per group
 * @param messageId - Message ID to pin
 * @param groupId - Group ID of the message
 * @param tag - Optional tag for the pin
 * @returns Created pinned message (optimistic)
 * @throws Error if user has already pinned 5 messages
 */
export async function pinMessage(
  messageId: string,
  groupId: string,
  tag?: string
): Promise<PinnedMessage> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();

  // Check if user has already pinned 5 messages in this group
  const userPins = await db.pinned_messages
    .find({
      selector: {
        group_id: groupId,
        device_id: deviceId,
      },
    })
    .exec();

  if (userPins.length >= 5) {
    throw new Error(
      "Bạn chỉ có thể ghim tối đa 5 tin nhắn. Vui lòng bỏ ghim tin nhắn khác trước."
    );
  }

  // Check if this message is already pinned by this user
  const existingPin = userPins.find((pin) => pin.message_id === messageId);
  if (existingPin) {
    // Already pinned, return existing
    return existingPin.toJSON() as PinnedMessage;
  }

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

  // Send via WebSocket for real-time sync
  try {
    const { sendWebSocketMessageAction } = await import(
      "@/features/websocket/store/saga"
    );
    const { store } = await import("@/store");

    store.dispatch(
      sendWebSocketMessageAction({
        type: "pin_message",
        payload: {
          messageId,
          groupId,
          tag: tag || null,
          pinnedAt: now,
        },
      })
    );
  } catch (error) {
    // If WebSocket fails, fall back to mutation queue
    await queueMutation(
      "pin_message",
      "pinned_messages",
      {
        message_id: messageId,
        tag: tag || null,
      },
      optimisticPin.id
    );
  }

  return optimisticPin;
}

/**
 * Unpins a message
 * Uses optimistic update: removes from RxDB immediately, sends via WebSocket
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
    const groupId = pin.group_id;
    await pin.remove();

    // Send via WebSocket for real-time sync
    try {
      const { sendWebSocketMessageAction } = await import(
        "@/features/websocket/store/saga"
      );
      const { store } = await import("@/store");

      store.dispatch(
        sendWebSocketMessageAction({
          type: "unpin_message",
          payload: {
            messageId,
            groupId,
          },
        })
      );
    } catch (error) {
      // If WebSocket fails, fall back to mutation queue
      await queueMutation(
        "unpin_message",
        "pinned_messages",
        {
          message_id: messageId,
        },
        pinId
      );
    }
  }
}

/**
 * Gets all pinned messages for a group
 * RxDB-first approach: reads from local cache, replication keeps it fresh
 * @param groupId - Group ID
 * @returns Array of pinned messages from RxDB
 */
export async function getPinnedMessages(
  groupId: string
): Promise<PinnedMessage[]> {
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
 * Checks if a message is pinned in the group (by anyone)
 * @param messageId - Message ID to check
 * @param groupId - Group ID
 * @returns True if message is pinned by anyone in the group
 */
export async function isPinned(
  messageId: string,
  groupId: string
): Promise<boolean> {
  const db = await getDatabase();
  const pin = await db.pinned_messages
    .findOne({
      selector: {
        group_id: groupId,
        message_id: messageId,
      },
    })
    .exec();
  return pin !== null;
}

/**
 * Checks if a message is pinned by the current user
 * @param messageId - Message ID to check
 * @param groupId - Group ID
 * @returns True if pinned by current user
 */
export async function isMessagePinnedByCurrentUser(
  messageId: string,
  groupId: string
): Promise<boolean> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const pin = await db.pinned_messages
    .findOne({
      selector: {
        group_id: groupId,
        device_id: deviceId,
        message_id: messageId,
      },
    })
    .exec();
  return pin !== null;
}

/**
 * Gets count of messages pinned by current user in a group
 * @param groupId - Group ID
 * @returns Number of messages pinned by current user
 */
export async function getUserPinCount(groupId: string): Promise<number> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();
  const userPins = await db.pinned_messages
    .find({
      selector: {
        group_id: groupId,
        device_id: deviceId,
      },
    })
    .exec();
  return userPins.length;
}
