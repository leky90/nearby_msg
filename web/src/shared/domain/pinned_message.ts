/**
 * Pinned Message domain model
 * Represents a message marked as important within a group
 */

export interface PinnedMessage {
  id: string; // NanoID (21 chars)
  message_id: string; // NanoID (21 chars)
  group_id: string; // NanoID (21 chars)
  device_id: string; // NanoID (21 chars)
  pinned_at: string; // ISO timestamp
  tag?: string; // 1-50 characters
}

export interface PinnedMessageCreateRequest {
  message_id: string; // NanoID (21 chars)
  tag?: string; // 1-50 characters
}

/**
 * Validates pinned message tag
 * @param tag - Tag to validate
 * @returns Error message if invalid, null if valid
 */
export function validatePinnedMessageTag(tag: string): string | null {
  if (tag.length < 1 || tag.length > 50) {
    return 'Tag must be 1-50 characters';
  }
  return null;
}

