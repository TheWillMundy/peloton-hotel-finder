import {
  fetchPelotonHotels,
  transformPelotonHotelData,
  type ClientHotel,
  type RawPelotonHotel,
} from "./pelotonAPI";
import { unstable_cache as nextCache } from "next/cache";
import Fuse, { type IFuseOptions } from "fuse.js";

// interface CityBbox { // Now unused
//   coords: [[number, number], [number, number], [number, number], [number, number]];
//   center: { lat: number; lng: number };
// }

// MVP: Hardcoded city bounding boxes
// const cityBboxData: Record<string, CityBbox> = { // Now unused
//   chicago: {
//     coords: [
//       [41.644, -87.94],
//       [42.023, -87.94],
//       [42.023, -87.523],
//       [41.644, -87.523],
//     ],
//     center: { lat: 41.878, lng: -87.629 },
//   },
//   newyork: {
//     coords: [
//       [40.477399, -74.25909],
//       [40.917577, -74.25909],
//       [40.917577, -73.700272],
//       [40.477399, -73.700272],
//     ],
//     center: { lat: 40.7128, lng: -74.006 },
//   },
//   // Add other cities as needed
// };

// Helper function to get and transform hotel data, with caching
// Renamed from getAndTransformHotelsByCity and adapted parameters
const getAndTransformHotels = async (bboxJson: string, searchTermForPelotonCsrf: string): Promise<ClientHotel[]> => {
  // Fetch raw data using the new parameter name
  const rawHotels: RawPelotonHotel[] = await fetchPelotonHotels({ 
    bboxJson, 
    searchTermForPelotonCsrf 
  });
  return transformPelotonHotelData(rawHotels);
};

/**
 * Retrieves cached hotel data for a given bounding box and search term (for CSRF).
 * Uses Next.js unstable_cache for server-side caching.
 * Renamed from getCachedHotelsByCity
 */
export const getCachedHotelsByCriteria = async (
  bboxJson: string, // This will be the primary part of the cache key
  searchTermForPelotonCsrf: string, // Used for fetching, not directly in cache key here to avoid fragmentation if only bbox matters for data
  centerLat: number, // For the cityCenter in response
  centerLng: number  // For the cityCenter in response
): Promise<{ hotels: ClientHotel[]; cityCenter: [number, number] }> => {
  console.log(`[hotelService] Getting hotels for bboxJson (cache key): ${bboxJson}, searchTermForCsrf: ${searchTermForPelotonCsrf}`);

  // The cache key is now based on the bboxJson to ensure that identical geographical queries are cached together.
  // searchTermForPelotonCsrf is used in the underlying fetch but not part of this primary cache key
  // to prevent cache misses if only the search term text changes slightly but the geo area is the same.
  const getFreshData = () => getAndTransformHotels(bboxJson, searchTermForPelotonCsrf);
  
  const cachedHotels = await nextCache(
    getFreshData,
    [`peloton-hotels-${bboxJson}`], // Cache key based on bboxJson
    {
      revalidate: 3600, // 1 hour
      tags: [`peloton-hotels-data`, `peloton-hotels-bbox-${bboxJson}`], // Added specific bbox tag
    }
  )();

  return { hotels: cachedHotels, cityCenter: [centerLat, centerLng] };
};

// --- Booking Checker Utilities ---

interface FuzzyMatchResult {
  matchConfidence: number | null; // Fuse.js score (0 is perfect match, 1 is no match)
  hotel: ClientHotel | null;
  hasBikes: boolean;
}

export const findHotelByFuzzyMatch = (
  hotels: ClientHotel[],
  freeText: string,
  fuseThreshold = 0.6 // Default threshold, can be tuned
): FuzzyMatchResult => {
  if (!hotels || hotels.length === 0) {
    return { matchConfidence: null, hotel: null, hasBikes: false };
  }

  const fuseOptions: IFuseOptions<ClientHotel> = {
    includeScore: true,
    keys: ["name"], // Key to search in
    threshold: fuseThreshold,
  };

  const fuse = new Fuse(hotels, fuseOptions);
  const results = fuse.search(freeText);

  if (results.length === 0) {
    return { matchConfidence: null, hotel: null, hasBikes: false };
  }

  const bestMatch = results[0];
  const matchedHotel = bestMatch.item;
  const matchConfidence = bestMatch.score ?? null; // Fuse.js score: 0 (exact) to 1 (distant)
  const hasBikes = matchedHotel.total_bikes > 0;

  return {
    matchConfidence,
    hotel: matchedHotel,
    hasBikes,
  };
}; 