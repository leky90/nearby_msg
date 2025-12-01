/**
 * Utility functions for parsing Google Maps URLs
 */

import { log } from "@/shared/lib/logging/logger";

/**
 * Parses Google Maps URL and extracts latitude and longitude
 * Supports various Google Maps URL formats:
 * - https://maps.google.com/?q=lat,lng
 * - https://www.google.com/maps?q=lat,lng
 * - https://www.google.com/maps/@lat,lng,zoom
 * - https://www.google.com/maps/place/name/@lat,lng,zoom
 * - https://maps.google.com/maps?ll=lat,lng
 * 
 * @param url - Google Maps URL
 * @returns Object with latitude and longitude, or null if parsing fails
 */
export function parseGoogleMapsUrl(url: string): { latitude: number; longitude: number } | null {
  try {
    // Remove whitespace
    const cleanUrl = url.trim();

    // Try to extract coordinates from various URL formats
    let lat: number | null = null;
    let lng: number | null = null;

    // Format 1: ?q=lat,lng or &q=lat,lng
    const qMatch = cleanUrl.match(/[?&]q=([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
    if (qMatch) {
      lat = parseFloat(qMatch[1]);
      lng = parseFloat(qMatch[2]);
    }

    // Format 2: @lat,lng or @lat,lng,zoom
    if (!lat || !lng) {
      const atMatch = cleanUrl.match(/@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
      if (atMatch) {
        lat = parseFloat(atMatch[1]);
        lng = parseFloat(atMatch[2]);
      }
    }

    // Format 3: ?ll=lat,lng or &ll=lat,lng
    if (!lat || !lng) {
      const llMatch = cleanUrl.match(/[?&]ll=([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
      if (llMatch) {
        lat = parseFloat(llMatch[1]);
        lng = parseFloat(llMatch[2]);
      }
    }

    // Format 4: Direct coordinates in URL (lat,lng)
    if (!lat || !lng) {
      const coordMatch = cleanUrl.match(/([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
      }
    }

    // Validate coordinates
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      // Check if coordinates are in valid range
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    return null;
  } catch (error) {
    log.error("Failed to parse Google Maps URL", error, { url });
    return null;
  }
}

/**
 * Validates if a string looks like a Google Maps URL or contains coordinates
 * @param input - Input string to validate
 * @returns True if input looks like a valid Google Maps URL or coordinates
 */
export function isValidGoogleMapsInput(input: string): boolean {
  const trimmed = input.trim();
  
  // Check if it's a URL
  if (trimmed.includes('google.com/maps') || trimmed.includes('maps.google.com')) {
    return true;
  }
  
  // Check if it's coordinates (lat,lng format)
  const coordPattern = /^[+-]?\d+\.?\d*,[+-]?\d+\.?\d*$/;
  if (coordPattern.test(trimmed)) {
    return true;
  }
  
  return false;
}

