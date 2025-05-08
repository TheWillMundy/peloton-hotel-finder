import {
  fetchPelotonHotels,
  transformPelotonHotelData,
  type ClientHotel,
} from "./pelotonAPI";
import { unstable_cache as nextCache } from "next/cache";
import Fuse from "fuse.js";

interface CityBbox {
  coords: [[number, number], [number, number], [number, number], [number, number]];
  center: { lat: number; lng: number };
}

// MVP: Hardcoded city bounding boxes
const cityBboxData: Record<string, CityBbox> = {
  chicago: {
    coords: [
      [41.644, -87.94],
      [42.023, -87.94],
      [42.023, -87.523],
      [41.644, -87.523],
    ],
    center: { lat: 41.878, lng: -87.629 },
  },
  newyork: {
    coords: [
      [40.477399, -74.25909],
      [40.917577, -74.25909],
      [40.917577, -73.700272],
      [40.477399, -73.700272],
    ],
    center: { lat: 40.7128, lng: -74.006 },
  },
  // Add other cities as needed
};

const getAndTransformHotelsForCity = async (
  cityKey: string,
  currentBboxJson: string
): Promise<ClientHotel[]> => {
  // It's important that fetchPelotonHotels itself is not double-caching if unstable_cache handles it.
  // The `next: { revalidate: 3600 }` in fetchPelotonHotels might be redundant if this layer caches.
  // However, for direct calls to fetchPelotonHotels (if any), that revalidation could still be useful.
  // For now, let's assume unstable_cache is the primary caching mechanism for this service.
  const rawHotels = await fetchPelotonHotels({
    city: cityKey,
    bboxJson: currentBboxJson,
  });
  return transformPelotonHotelData(rawHotels);
};

/**
 * Fetches and caches hotel data for a given city.
 * Uses Next.js unstable_cache for server-side caching.
 * @param city The city name (will be normalized to lowercase).
 * @returns A promise that resolves to an array of ClientHotel objects.
 * @throws Error if city is not supported or if data fetching/transformation fails.
 */
export const getCachedHotelsByCity = async (
  city: string
): Promise<ClientHotel[]> => {
  const normalizedCity = city.toLowerCase();
  const bbox = cityBboxData[normalizedCity];

  if (!bbox) {
    // This error will be caught by the route handler
    throw new Error(`Bounding box data not found for city: ${city}`);
  }
  const bboxJson = JSON.stringify(bbox);

  // Use unstable_cache to cache the transformed hotel data for the city.
  const cachedFetcher = nextCache(
    async (currentCity: string, currentBboxJson: string) => {
      console.log(`[hotelService] Cache miss for ${currentCity}. Fetching fresh data.`);
      return getAndTransformHotelsForCity(currentCity, currentBboxJson);
    },
    [`peloton-hotels-${normalizedCity}`], // Cache key specific to the city
    {
      revalidate: 3600, // 1 hour
      tags: [`peloton-city-${normalizedCity}`], // For on-demand revalidation by tag
    }
  );
  // The parameters passed here (normalizedCity, bboxJson) are for the first call if not cached.
  // The inner function of nextCache receives these parameters.
  return cachedFetcher(normalizedCity, bboxJson);
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

  const fuseOptions: Fuse.IFuseOptions<ClientHotel> = {
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