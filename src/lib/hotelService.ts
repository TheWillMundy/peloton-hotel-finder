import {
  fetchPelotonHotels,
  transformPelotonHotelData,
  type ClientHotel,
  type RawPelotonHotel,
} from "./pelotonAPI";
import { unstable_cache as nextCache } from "next/cache";
import Fuse from "fuse.js";
import { calculateDistance } from "./utils";

// Type for search parameters
interface HotelSearchParams {
  lat: number;
  lng: number;
  searchTerm: string;
  featureType?: string;
  providedCityBbox?: string | null;
}

// Type for the response from the service
interface HotelSearchResponse {
  hotels: ClientHotel[];
  cityCenter: [number, number]; // [lng, lat] for Mapbox
  cityBbox: string; // The bbox used for the search
}

/**
 * Helper function to get and transform hotel data with caching
 * This is the core function that fetches data from Peloton and applies transformations
 */
const getAndTransformHotels = async (bboxJson: string, searchTerm: string): Promise<ClientHotel[]> => {
  console.log(`[hotelService] Fetching hotels with bboxJson: ${bboxJson}`);
  
  // Fetch raw data from Peloton API
  const rawHotels: RawPelotonHotel[] = await fetchPelotonHotels({ 
    bboxJson, 
    searchTermForPelotonCsrf: searchTerm
  });
  
  // Transform the raw data to our client-friendly format
  return transformPelotonHotelData(rawHotels);
};

/**
 * Retrieves cached hotel data for a given search criteria.
 * Uses Next.js unstable_cache as our single source of truth for caching.
 */
export const getCachedHotelsByCriteria = async (
  params: HotelSearchParams
): Promise<HotelSearchResponse> => {
  const { lat, lng, searchTerm, featureType, providedCityBbox } = params;
  
  // Determine if this is a hotel search
  const isHotelSearch = featureType === 'poi';
  
  // Determine which bounding box JSON to use
  let bboxJson: string;
  
  if (providedCityBbox) {
    // Reuse the provided city bbox for better caching
    console.log(`[hotelService] Using provided cityBbox: ${providedCityBbox}`);
    bboxJson = providedCityBbox;
  } else {
    // Generate a new bbox based on search type
    bboxJson = isHotelSearch 
      ? generateNarrowBbox(lat, lng) 
      : generateWideBbox(lat, lng);
    console.log(`[hotelService] Generated new ${isHotelSearch ? 'narrow' : 'wide'} bbox`);
  }

  // Fetch and transform, using Next.js cache
  const hotels = await nextCache(
    () => getAndTransformHotels(bboxJson, searchTerm),
    [`peloton-hotels-${bboxJson}`],
    { revalidate: 3600, tags: [`peloton-hotels-data`, `peloton-hotels-bbox-${bboxJson}`] }
  )();

  // For hotel searches, calculate and sort by distance from search point
  if (isHotelSearch) {
    hotels.forEach(hotel => {
      hotel.distance_m = Math.round(calculateDistance(lat, lng, hotel.lat, hotel.lng) * 1000);
    });
    
    hotels.sort((a, b) => (a.distance_m || Infinity) - (b.distance_m || Infinity));
  }

  return { 
    hotels, 
    cityCenter: [lng, lat], 
    cityBbox: bboxJson 
  };
};

/**
 * Generates a bounding box string suitable for hotel searches (narrow, ~2km)
 */
export const generateNarrowBbox = (lat: number, lng: number): string => {
  // Create a bounding box roughly 2km around the point
  const offset = 0.02; // ~2km at mid-latitudes
  return JSON.stringify({
    coords: [
      [lat - offset, lng - offset],
      [lat + offset, lng - offset],
      [lat + offset, lng + offset],
      [lat - offset, lng + offset],
    ],
    center: { lat, lng },
  });
};

/**
 * Generates a bounding box string suitable for city searches (wide, ~10km)
 */
export const generateWideBbox = (lat: number, lng: number): string => {
  // Create a bounding box roughly 10km around the point
  const offset = 0.1; // ~10km at mid-latitudes
  return JSON.stringify({
    coords: [
      [lat - offset, lng - offset],
      [lat + offset, lng - offset],
      [lat + offset, lng + offset],
      [lat - offset, lng + offset],
    ],
    center: { lat, lng },
  });
};

/**
 * Check if a point falls within a bounding box
 */
export const isPointInBbox = (lat: number, lng: number, bbox: any): boolean => {
  try {
    if (bbox.coords && Array.isArray(bbox.coords) && bbox.coords.length === 4) {
      const [sw, nw, ne, se] = bbox.coords;
      const minLat = Math.min(sw[0], se[0]);
      const maxLat = Math.max(nw[0], ne[0]);
      const minLng = Math.min(sw[1], nw[1]);
      const maxLng = Math.max(se[1], ne[1]);
      
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }
    
    if (bbox.bbox && Array.isArray(bbox.bbox) && bbox.bbox.length === 2) {
      const [[minLng, minLat], [maxLng, maxLat]] = bbox.bbox;
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }
    
    return false;
  } catch (error) {
    console.error("[hotelService] Error checking point in bbox:", error);
    return false;
  }
};

// Fuzzy match return type
interface FuzzyMatchResult {
  matchedHotel: ClientHotel | null;
  confidence: number;
}

/**
 * Find a hotel using fuzzy name matching
 */
export async function findHotelByFuzzyMatch(
  hotels: ClientHotel[],
  freeText: string
): Promise<FuzzyMatchResult> {
  // Skip if no text input or no hotels to search
  if (!freeText || !hotels.length) {
    return { matchedHotel: null, confidence: 0 };
  }

  // Convert freeText to lowercase for basic normalization
  freeText = freeText.toLowerCase().trim();

  // Setup Fuse.js with options focused on hotel name and brand
  const fuse = new Fuse(hotels, {
    includeScore: true,
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'brand', weight: 0.3 },
    ],
    threshold: 0.6, // Set a threshold to limit poor matches
  });

  // Get matches sorted by score (lower score = better match)
  const searchResults = fuse.search(freeText);

  // If we have no matches even within the threshold
  if (searchResults.length === 0) {
    return { matchedHotel: null, confidence: 0 };
  }
  
  // Use the top match
  const topMatch = searchResults[0];
  const hotel = topMatch.item;
  const confidence = topMatch.score ? Math.max(0, 1 - topMatch.score) : 0.5;
  
  // Only consider it a match if confidence is above 0.4 (this can be adjusted)
  if (confidence < 0.4) {
    return { matchedHotel: null, confidence };
  }
  
  console.log(
    `[hotelService] Fuzzy matched "${freeText}" to hotel "${hotel.name}" (confidence: ${confidence.toFixed(3)}).`
  );
  
  return {
    matchedHotel: hotel,
    confidence
  };
} 