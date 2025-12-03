/**
 * Group domain model
 * Represents a community chat room for a geographic area
 */

export type GroupType = 
  | 'village'           // Thôn
  | 'hamlet'           // Xóm
  | 'residential_group' // Tổ dân phố
  | 'street_block'     // Khu phố
  | 'ward'             // Phường
  | 'commune'          // Xã
  | 'apartment'        // Chung cư
  | 'residential_area' // Khu dân cư
  | 'other';           // Khác

export type RadiusOption = 500 | 1000 | 2000;

export interface Group {
  id: string; // NanoID (21 chars)
  name: string; // 1-100 characters
  type: GroupType;
  latitude: number; // -90 to 90
  longitude: number; // -180 to 180
  region_code?: string; // 2-10 characters
  creator_device_id: string | null; // NanoID (21 chars) or null when creator device is deleted
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface GroupCreateRequest {
  name: string; // 1-100 characters
  type: GroupType;
  latitude: number;
  longitude: number;
  region_code?: string;
}

export interface NearbyGroupsRequest {
  latitude: number;
  longitude: number;
  radius: number; // 500, 1000, or 2000 meters
}

export interface NearbyGroupsResponse {
  groups: Group[];
  distances?: number[]; // Distance in meters for each group
}

/**
 * Validates group type
 * @param type - Group type to validate
 * @returns True if valid
 */
export function isValidGroupType(type: string): type is GroupType {
  return [
    'village',
    'hamlet',
    'residential_group',
    'street_block',
    'ward',
    'commune',
    'apartment',
    'residential_area',
    'other'
  ].includes(type);
}

/**
 * Validates latitude
 * @param latitude - Latitude to validate
 * @returns Error message if invalid, null if valid
 */
export function validateLatitude(latitude: number): string | null {
  if (latitude < -90 || latitude > 90) {
    return 'Latitude must be between -90 and 90';
  }
  return null;
}

/**
 * Validates longitude
 * @param longitude - Longitude to validate
 * @returns Error message if invalid, null if valid
 */
export function validateLongitude(longitude: number): string | null {
  if (longitude < -180 || longitude > 180) {
    return 'Longitude must be between -180 and 180';
  }
  return null;
}

/**
 * Validates group name
 * @param name - Group name to validate
 * @returns Error message if invalid, null if valid
 */
export function validateGroupName(name: string): string | null {
  if (name.length < 1 || name.length > 100) {
    return 'Group name must be 1-100 characters';
  }
  return null;
}

/**
 * Validates group data
 * @param group - Group to validate
 * @returns Error message if invalid, null if valid
 */
export function validateGroup(group: Group): string | null {
  const nameErr = validateGroupName(group.name);
  if (nameErr) return nameErr;
  if (!isValidGroupType(group.type)) return 'Invalid group type';
  const latErr = validateLatitude(group.latitude);
  if (latErr) return latErr;
  const lonErr = validateLongitude(group.longitude);
  if (lonErr) return lonErr;
  return null;
}

/**
 * Validates group creation request
 * @param request - Group creation request to validate
 * @returns Error message if invalid, null if valid
 */
export function validateGroupCreateRequest(request: GroupCreateRequest): string | null {
  const nameErr = validateGroupName(request.name);
  if (nameErr) return nameErr;
  if (!isValidGroupType(request.type)) return 'Invalid group type';
  const latErr = validateLatitude(request.latitude);
  if (latErr) return latErr;
  const lonErr = validateLongitude(request.longitude);
  if (lonErr) return lonErr;
  return null;
}

/**
 * Calculates distance between two points using Haversine formula
 * 
 * Note: This is a standard geographic distance calculation. For more complex
 * geographic operations, consider using a library like 'geolib' or 'turf.js',
 * but for simple distance calculations, this implementation is sufficient.
 * 
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

