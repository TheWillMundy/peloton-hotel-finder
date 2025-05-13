import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cubic bezier function (from reference)
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return function(t: number) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const term1 = Math.pow(1 - t, 3) * 0; // Assuming P0 is (0,0)
    const term2 = 3 * Math.pow(1 - t, 2) * t * y1;
    const term3 = 3 * (1 - t) * Math.pow(t, 2) * y2;
    const term4 = Math.pow(t, 3) * 1; // Assuming P3 is (1,1)
    return term1 + term2 + term3 + term4;
  }
}

// Add this utility function for calculating distance between coordinates
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert degrees to radians
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Generates a bounding box string suitable for city searches (wide, ~10km)
 * in the format expected by the hotelService.
 * Mirrors the backend hotelService.generateWideBbox logic.
 */
export const generateWideBboxForService = (lat: number, lng: number): string => {
  // Create a bounding box roughly 10km around the point
  const offset = 0.1; // ~10km at mid-latitudes
  const bboxJson = JSON.stringify({
    coords: [
      [lat - offset, lng - offset], // SW
      [lat + offset, lng - offset], // NW
      [lat + offset, lng + offset], // NE
      [lat - offset, lng + offset], // SE
    ],
    center: { lat, lng },
  });
  console.log("[Utils] Generated wide bbox:", bboxJson);
  return bboxJson;
};

/**
 * Converts a Mapbox bounding box [minLng, minLat, maxLng, maxLat]
 * to the JSON string format expected by the hotelService.
 */
export const convertMapboxBboxToServiceBboxJson = (
  mapboxBbox: [number, number, number, number],
  center: { lat: number; lng: number }
): string => {
  console.log("[Utils] Converting Mapbox bbox:", mapboxBbox);
  
  // Mapbox uses [minLng, minLat, maxLng, maxLat] format
  const [minLng, minLat, maxLng, maxLat] = mapboxBbox;
  
  // For hotelService, coords are in [lat, lng] pairs in this order: SW, NW, NE, SE
  // This matches the backend generateWideBbox implementation
  const bboxJson = JSON.stringify({
    coords: [
      [minLat, minLng], // SW [lat, lng]
      [maxLat, minLng], // NW [lat, lng]
      [maxLat, maxLng], // NE [lat, lng]
      [minLat, maxLng], // SE [lat, lng]
    ],
    center: center, // Use the provided center
  });
  
  console.log("[Utils] Converted to service bbox format:", bboxJson);
  return bboxJson;
};

/**
 * Determines the API query bounding box string.
 * Prefers using a Mapbox-provided bbox for the city if available,
 * otherwise generates a wide bbox around the city's center.
 */
export const determineApiQueryBbox = (
  cityMapboxFeature: import('@/app/components/search/CitySearchInput').MapboxGeocodingFeature
): string => {
  console.log("[Utils] Determining API query bbox for feature:", cityMapboxFeature);
  
  if (cityMapboxFeature.mapboxBbox) {
    console.log("[Utils] Using mapboxBbox from feature for consistent caching");
    return convertMapboxBboxToServiceBboxJson(
      cityMapboxFeature.mapboxBbox,
      { lat: cityMapboxFeature.lat, lng: cityMapboxFeature.lng }
    );
  }
  
  // Fallback if Mapbox doesn't provide a bbox for the city feature
  console.log("[Utils] No mapboxBbox available, generating wide bbox");
  return generateWideBboxForService(cityMapboxFeature.lat, cityMapboxFeature.lng);
};
