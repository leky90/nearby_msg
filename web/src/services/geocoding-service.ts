/**
 * Geocoding Service
 * Handles reverse geocoding (coordinates to address)
 */

export interface GeocodingResult {
  address: string;
  formattedAddress?: string;
}

/**
 * Reverse geocoding using browser's Geolocation API
 * Falls back to simple coordinate display if API unavailable
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    // Use browser's built-in geocoding if available (Chrome/Edge)
    // Note: This requires user permission and may not work in all browsers
    if ('geolocation' in navigator && 'geocode' in navigator) {
      // This is not a standard API, so we'll use a different approach
    }

    // Fallback: Use a free reverse geocoding service
    // Using OpenStreetMap Nominatim (free, no API key required)
    // Using zoom=18 for maximum detail (building level)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&extratags=1`,
      {
        headers: {
          'User-Agent': 'NearbyMsg/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }

    const data = await response.json();
    
    if (data.error) {
      return null;
    }

    // Format address from response
    const address = data.address;
    if (!address) {
      return null;
    }

    // Build detailed formatted address with priority order
    // More specific to less specific: house_number > road > village/hamlet > ward > city > state > country
    const parts: string[] = [];
    
    // Most specific: house number and road
    if (address.house_number) {
      parts.push(address.house_number);
    }
    if (address.road) {
      parts.push(address.road);
    }
    
    // Neighborhood level
    if (address.neighbourhood) parts.push(address.neighbourhood);
    else if (address.suburb) parts.push(address.suburb);
    
    // Village/Hamlet/Town level
    if (address.village) parts.push(address.village);
    else if (address.hamlet) parts.push(address.hamlet);
    else if (address.town) parts.push(address.town);
    
    // Administrative level
    if (address.ward) parts.push(address.ward);
    else if (address.commune) parts.push(address.commune);
    
    // City/District level
    if (address.city) parts.push(address.city);
    else if (address.district) parts.push(address.district);
    else if (address.municipality) parts.push(address.municipality);
    
    // State/Province level
    if (address.state) parts.push(address.state);
    else if (address.province) parts.push(address.province);
    
    // Country level
    if (address.country) parts.push(address.country);

    // If we have detailed parts, use them; otherwise fall back to display_name
    if (parts.length > 0) {
      return parts.join(', ');
    }
    
    // Fallback to display_name if available
    return data.display_name || null;
  } catch (err) {
    console.error('Reverse geocoding failed:', err);
    // Return null on error - we'll just show coordinates
    return null;
  }
}

/**
 * Gets a short address string for display
 * Falls back to coordinates if geocoding fails
 */
export async function getLocationDisplayName(
  latitude: number,
  longitude: number
): Promise<string> {
  const address = await reverseGeocode(latitude, longitude);
  if (address) {
    return address;
  }
  // Fallback to coordinates
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
