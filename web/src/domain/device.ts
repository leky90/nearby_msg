/**
 * Device domain model
 * Represents a user's installation of the app
 */

export interface Device {
  id: string; // NanoID (21 chars)
  nickname: string; // 1-50 characters
  public_key?: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface DeviceCreateRequest {
  nickname?: string; // Optional, will be auto-generated if not provided
}

export interface DeviceUpdateRequest {
  nickname: string; // 1-50 characters
}

/**
 * Validates nickname format
 * @param nickname - Nickname to validate
 * @returns Error message if invalid, null if valid
 */
export function validateNickname(nickname: string): string | null {
  if (nickname.length < 1 || nickname.length > 50) {
    return 'Nickname must be 1-50 characters';
  }
  // Check for valid characters: alphanumeric, spaces, hyphens
  const validPattern = /^[a-zA-Z0-9\s-]+$/;
  if (!validPattern.test(nickname)) {
    return 'Nickname can only contain letters, numbers, spaces, and hyphens';
  }
  return null;
}

/**
 * Validates device data
 * @param device - Device to validate
 * @returns Error message if invalid, null if valid
 */
export function validateDevice(device: Device): string | null {
  return validateNickname(device.nickname);
}

/**
 * Generates a random nickname for new users
 * @returns Random nickname string
 */
export function generateRandomNickname(): string {
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `Neighbor-${randomPart}`;
}

