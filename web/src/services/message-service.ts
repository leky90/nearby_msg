/**
 * Message service
 * Handles message creation, SOS cooldown tracking, and message operations
 */

import type { Message, MessageCreateRequest, SOSType } from '../domain/message';
import { validateMessageCreateRequest } from '../domain/message';
import { generateId } from '../utils/id';
import { getDatabase } from './db';
import { getOrCreateDeviceId } from './device-storage';

// SOS cooldown duration (30 seconds)
const SOS_COOLDOWN_DURATION = 30 * 1000; // milliseconds

// Store last SOS timestamp per device (in localStorage for persistence)
const LAST_SOS_KEY_PREFIX = 'last_sos_';

/**
 * Gets the last SOS timestamp for a device
 * @param deviceId - Device ID
 * @returns Last SOS timestamp or null
 */
function getLastSOSTimestamp(deviceId: string): number | null {
  const key = `${LAST_SOS_KEY_PREFIX}${deviceId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  return parseInt(stored, 10);
}

/**
 * Records that a device sent an SOS message
 * @param deviceId - Device ID
 */
function recordSOSMessage(deviceId: string): void {
  const key = `${LAST_SOS_KEY_PREFIX}${deviceId}`;
  localStorage.setItem(key, Date.now().toString());
}

/**
 * Checks if a device can send an SOS message (30 second cooldown)
 * @param deviceId - Device ID
 * @returns Error message if cooldown active, null if allowed
 */
export function checkSOSCooldown(deviceId: string): string | null {
  const lastSOS = getLastSOSTimestamp(deviceId);
  if (!lastSOS) {
    return null; // No previous SOS, allowed
  }

  const timeSinceLastSOS = Date.now() - lastSOS;
  if (timeSinceLastSOS < SOS_COOLDOWN_DURATION) {
    const remaining = Math.ceil((SOS_COOLDOWN_DURATION - timeSinceLastSOS) / 1000);
    return `SOS cooldown active: please wait ${remaining} more seconds`;
  }

  return null;
}

/**
 * Creates an SOS message
 * @param groupId - Group ID
 * @param sosType - SOS type
 * @param content - Optional message content
 * @returns Created message
 */
async function persistMessage(payload: Message): Promise<Message> {
  const db = await getDatabase();
  await db.messages.insert(payload);
  return payload;
}

export async function createMessage(request: MessageCreateRequest): Promise<Message> {
  const deviceId = getOrCreateDeviceId();
  const validationError = validateMessageCreateRequest(request);
  if (validationError) {
    throw new Error(validationError);
  }

  const message: Message = {
    id: generateId(),
    group_id: request.group_id,
    device_id: deviceId,
    content: request.content,
    message_type: request.message_type,
    sos_type: request.sos_type,
    tags: request.tags,
    pinned: false,
    created_at: new Date().toISOString(),
    device_sequence: request.device_sequence,
    sync_status: 'pending',
  };

  return persistMessage(message);
}

export async function createSOSMessage(
  groupId: string,
  sosType: SOSType,
  content?: string
): Promise<Message> {
  const deviceId = getOrCreateDeviceId();
  const cooldownError = checkSOSCooldown(deviceId);
  if (cooldownError) {
    throw new Error(cooldownError);
  }

  const message = await createMessage({
    group_id: groupId,
    content: content || getSOSDefaultContent(sosType),
    message_type: 'sos',
    sos_type: sosType,
    tags: ['urgent'],
  });

  recordSOSMessage(deviceId);
  return message;
}

/**
 * Gets default content for SOS message based on type
 * @param sosType - SOS type
 * @returns Default message content
 */
function getSOSDefaultContent(sosType: SOSType): string {
  const contentMap: Record<SOSType, string> = {
    medical: '🚨 Medical Emergency - Need immediate help!',
    flood: '🚨 Flood Emergency - Need evacuation assistance!',
    fire: '🚨 Fire Emergency - Need immediate help!',
    missing_person: '🚨 Missing Person - Need help locating!',
  };
  return contentMap[sosType] || '🚨 Emergency - Need help!';
}

/**
 * Creates a regular text message
 * @param groupId - Group ID
 * @param content - Message content
 * @returns Created message
 */
export async function createTextMessage(groupId: string, content: string): Promise<Message> {
  return createMessage({
    group_id: groupId,
    content,
    message_type: 'text',
  });
}

/**
 * Gets unread message count for a group
 * Unread = messages created after the last time user viewed the group
 * For now, we'll use a simplified approach: count messages user hasn't sent
 * @param groupId - Group ID
 * @param lastReadAt - Optional timestamp of last read (ISO string)
 * @returns Unread message count
 */
export async function getUnreadCount(
  groupId: string,
  lastReadAt?: string
): Promise<number> {
  const db = await getDatabase();
  const deviceId = getOrCreateDeviceId();

  // Build query selector
  const selector: {
    group_id: string;
    device_id: { $ne: string };
    created_at?: { $gt: string };
  } = {
    group_id: groupId,
    device_id: { $ne: deviceId }, // Exclude own messages
  };

  // If lastReadAt is provided, only count messages after that time
  if (lastReadAt) {
    selector.created_at = { $gt: lastReadAt };
  }

  const unreadMessages = await db.messages.find({ selector }).exec();
  return unreadMessages.length;
}

