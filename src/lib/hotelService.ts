import {
  fetchPelotonHotels,
  transformPelotonHotelData,
  type ClientHotel,
  type RawPelotonHotel,
} from "./pelotonAPI";
import { unstable_cache as nextCache } from "next/cache";
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

// Token-based matching parameters
const DEFAULT_TOKEN_MATCH_RADIUS_KM = 0.15;
const DEFAULT_MIN_TOKEN_COVERAGE = 0.6;

// Token-coverage based matching result type
interface FuzzyMatchResult {
  matchedHotel: ClientHotel | null;
  confidence: number;
}

// Basic name normalization function
const normalizeHotelName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(the|a|an|hotel|inn|suites|resort|and|&|spa|by|collection)\b/g, '')
    .replace(/[.,\-\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Find a hotel by geographic proximity first, then token coverage on name.
 */
export async function findHotelByFuzzyMatch(
  hotels: ClientHotel[],
  freeText: string,
  searchLat?: number,
  searchLng?: number
): Promise<FuzzyMatchResult> {
  if (!freeText || hotels.length === 0) {
    return { matchedHotel: null, confidence: 0 };
  }

  const normalizedQuery = normalizeHotelName(freeText);
  if (!normalizedQuery) {
    return { matchedHotel: null, confidence: 0 };
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) {
    return { matchedHotel: null, confidence: 0 };
  }

  // Gather and sort by proximity
  const candidates = hotels
    .map(hotel => {
      const distanceKm = (searchLat !== undefined && searchLng !== undefined)
        ? calculateDistance(searchLat, searchLng, hotel.lat, hotel.lng)
        : Infinity;
      return { hotel, distanceKm };
    })
    .filter(c => c.distanceKm <= DEFAULT_TOKEN_MATCH_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Evaluate token coverage
  for (const { hotel } of candidates) {
    const normalizedName = normalizeHotelName(hotel.name);
    const nameTokens = Array.from(new Set(normalizedName.split(' ').filter(Boolean)));
    const matchCount = queryTokens.reduce(
      (count, token) => nameTokens.includes(token) ? count + 1 : count,
      0
    );
    const coverage = matchCount / queryTokens.length;
    if (coverage >= DEFAULT_MIN_TOKEN_COVERAGE) {
      return { matchedHotel: hotel, confidence: coverage };
    }
  }

  // No suitable match
  return { matchedHotel: null, confidence: 0 };
} 