/**
 * Utility functions for copying coordinates to clipboard
 */

import { showToast } from "./toast";
import { log } from "../lib/logging/logger";

/**
 * Formats coordinates with maximum precision
 * @param latitude - Latitude value
 * @param longitude - Longitude value
 * @returns Formatted string "lat,lng" with maximum precision
 */
export function formatCoordinatesDetailed(
  latitude: number,
  longitude: number
): string {
  // Use maximum precision (up to 15 decimal places for double precision)
  // But typically 8-10 decimal places is sufficient for most use cases
  return `${latitude.toFixed(10)},${longitude.toFixed(10)}`;
}

/**
 * Copies coordinates to clipboard with detailed precision
 * @param latitude - Latitude value
 * @param longitude - Longitude value
 * @returns Promise that resolves when copy is complete
 */
export async function copyCoordinates(
  latitude: number,
  longitude: number
): Promise<void> {
  try {
    const coordinates = formatCoordinatesDetailed(latitude, longitude);
    await navigator.clipboard.writeText(coordinates);
    showToast("Đã copy tọa độ!", "success");
  } catch (err) {
    log.error("Failed to copy coordinates", err, { latitude, longitude });
    showToast("Không thể copy tọa độ", "error");
  }
}
