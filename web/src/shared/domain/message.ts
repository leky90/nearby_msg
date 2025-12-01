/**
 * Message domain model
 * Represents a communication within a group
 */

export type MessageType = 'text' | 'sos' | 'status_update';

export type SOSType = 'medical' | 'flood' | 'fire' | 'missing_person';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface Message {
  id: string; // NanoID (21 chars)
  group_id: string; // NanoID (21 chars)
  device_id: string; // NanoID (21 chars)
  content: string; // 1-500 characters
  message_type: MessageType;
  sos_type?: SOSType; // Required if message_type is 'sos'
  tags?: string[]; // Optional tags
  pinned: boolean;
  created_at: string; // ISO timestamp
  device_sequence?: number; // Device-local sequence number
  synced_at?: string; // ISO timestamp
  sync_status?: SyncStatus; // Client-side sync status
}

export interface MessageCreateRequest {
  group_id: string; // NanoID (21 chars)
  content: string; // 1-500 characters
  message_type: MessageType;
  sos_type?: SOSType; // Required if message_type is 'sos'
  tags?: string[];
  device_sequence?: number;
}

/**
 * Validates message type
 * @param type - Message type to validate
 * @returns True if valid
 */
export function isValidMessageType(type: string): type is MessageType {
  return ['text', 'sos', 'status_update'].includes(type);
}

/**
 * Validates SOS type
 * @param type - SOS type to validate
 * @returns True if valid
 */
export function isValidSOSType(type: string): type is SOSType {
  return ['medical', 'flood', 'fire', 'missing_person'].includes(type);
}

/**
 * Validates message content
 * @param content - Message content to validate
 * @returns Error message if invalid, null if valid
 */
export function validateMessageContent(content: string): string | null {
  if (content.length < 1 || content.length > 500) {
    return 'Message content must be 1-500 characters';
  }
  // Check for control characters (except newline)
  // eslint-disable-next-line no-control-regex
  const controlCharPattern = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/;
  if (controlCharPattern.test(content)) {
    return 'Message content contains invalid characters';
  }
  return null;
}

/**
 * Validates message data
 * @param message - Message to validate
 * @returns Error message if invalid, null if valid
 */
export function validateMessage(message: Message): string | null {
  const contentErr = validateMessageContent(message.content);
  if (contentErr) return contentErr;
  if (!isValidMessageType(message.message_type)) return 'Invalid message type';
  
  if (message.message_type === 'sos') {
    if (!message.sos_type) {
      return 'SOS type is required for SOS messages';
    }
    if (!isValidSOSType(message.sos_type)) {
      return 'Invalid SOS type';
    }
  } else if (message.sos_type) {
    return 'SOS type should only be set for SOS messages';
  }
  
  return null;
}

/**
 * Validates message creation request
 * @param request - Message creation request to validate
 * @returns Error message if invalid, null if valid
 */
export function validateMessageCreateRequest(request: MessageCreateRequest): string | null {
  const contentErr = validateMessageContent(request.content);
  if (contentErr) return contentErr;
  if (!isValidMessageType(request.message_type)) return 'Invalid message type';
  
  if (request.message_type === 'sos') {
    if (!request.sos_type) {
      return 'SOS type is required for SOS messages';
    }
    if (!isValidSOSType(request.sos_type)) {
      return 'Invalid SOS type';
    }
  } else if (request.sos_type) {
    return 'SOS type should only be set for SOS messages';
  }
  
  return null;
}

