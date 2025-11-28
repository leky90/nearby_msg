/**
 * Distance formatting utilities
 */

/**
 * Formats distance in meters to a human-readable string
 * @param distance - Distance in meters
 * @returns Formatted string (e.g., "500m" or "1.2km")
 */
export function formatDistance(distance: number | null | undefined): string {
  if (!distance) return "Không xác định";
  if (distance < 1000) return `${Math.round(distance)}m`;
  return `${(distance / 1000).toFixed(1)}km`;
}

