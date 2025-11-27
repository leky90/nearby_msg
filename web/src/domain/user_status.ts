/**
 * User Status domain model
 * Represents a user's current safety/need state
 */

export type StatusType = 'safe' | 'need_help' | 'cannot_contact';

export interface UserStatus {
  id: string; // NanoID (21 chars)
  device_id: string; // NanoID (21 chars)
  status_type: StatusType;
  description?: string; // 1-200 characters
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface UserStatusCreateRequest {
  status_type: StatusType;
  description?: string; // 1-200 characters
}

export interface UserStatusUpdateRequest {
  status_type: StatusType;
  description?: string; // 1-200 characters
}

export interface StatusSummary {
  safe: number;
  need_help: number;
  cannot_contact: number;
  total: number;
}

/**
 * Validates status type
 * @param type - Status type to validate
 * @returns True if valid
 */
export function isValidStatusType(type: string): type is StatusType {
  return ['safe', 'need_help', 'cannot_contact'].includes(type);
}

/**
 * Validates status description
 * @param description - Description to validate
 * @returns Error message if invalid, null if valid
 */
export function validateStatusDescription(description: string): string | null {
  if (description.length < 1 || description.length > 200) {
    return 'Description must be 1-200 characters';
  }
  return null;
}

/**
 * Validates user status data
 * @param status - User status to validate
 * @returns Error message if invalid, null if valid
 */
export function validateUserStatus(status: UserStatus): string | null {
  if (!isValidStatusType(status.status_type)) {
    return 'Invalid status type';
  }
  if (status.description) {
    const descErr = validateStatusDescription(status.description);
    if (descErr) return descErr;
  }
  return null;
}

/**
 * Validates user status creation request
 * @param request - User status creation request to validate
 * @returns Error message if invalid, null if valid
 */
export function validateUserStatusCreateRequest(request: UserStatusCreateRequest): string | null {
  if (!isValidStatusType(request.status_type)) {
    return 'Invalid status type';
  }
  if (request.description) {
    const descErr = validateStatusDescription(request.description);
    if (descErr) return descErr;
  }
  return null;
}

