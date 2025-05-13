import type { ClientHotel } from '@/lib/pelotonAPI';

export interface FetchHotelParams {
  lat: number;
  lng: number;
  searchTerm?: string;
  featureType?: string;
  freeText?: string;
  cityBbox?: string | null;
}

export interface HotelsApiResponse {
  hotels: ClientHotel[];
  cityCenter?: [number, number];
  matchedHotel?: ClientHotel | null;
  matchConfidence?: number | null;
  cityBbox?: string | null;
  searchedPoinLocation?: { lat: number; lng: number; name: string } | null;
}

/**
 * Validates a bbox string to check if it's properly formatted
 */
export function validateBboxString(bboxStr: string | null | undefined): boolean {
  if (!bboxStr) return false;
  
  try {
    const parsed = JSON.parse(bboxStr);
    if (!parsed) return false;
    
    // Check for required fields
    if (!parsed.coords || !Array.isArray(parsed.coords) || parsed.coords.length !== 4) {
      console.warn("[clientHotelService] Invalid bbox format, missing or invalid coords array");
      return false;
    }
    
    // Check for coordinates format
    for (const coord of parsed.coords) {
      if (!Array.isArray(coord) || coord.length !== 2 || 
          typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
        console.warn("[clientHotelService] Invalid bbox coords format", coord);
        return false;
      }
    }
    
    // Check center
    if (!parsed.center || typeof parsed.center.lat !== 'number' || typeof parsed.center.lng !== 'number') {
      console.warn("[clientHotelService] Invalid bbox center format", parsed.center);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error("[clientHotelService] Error parsing bbox string:", e);
    return false;
  }
}

/**
 * Fetch hotels from the backend API with given parameters.
 */
export async function fetchHotels(
  params: FetchHotelParams
): Promise<HotelsApiResponse> {
  console.log("[clientHotelService] fetchHotels called with params:", params);
  
  // Validate required params
  if (typeof params.lat !== 'number' || typeof params.lng !== 'number') {
    throw new Error("Invalid latitude or longitude");
  }
  
  // Validate bbox if provided
  if (params.cityBbox && !validateBboxString(params.cityBbox)) {
    console.warn("[clientHotelService] Invalid bbox format, request may fail:", params.cityBbox);
  }
  
  const query = new URLSearchParams();
  query.set('lat', String(params.lat));
  query.set('lng', String(params.lng));
  if (params.searchTerm) query.set('searchTerm', params.searchTerm);
  if (params.featureType) query.set('featureType', params.featureType);
  if (params.freeText) query.set('freeText', params.freeText);
  if (params.cityBbox) query.set('cityBbox', params.cityBbox);

  const url = `/api/hotels?${query.toString()}`;
  console.log("[clientHotelService] Sending API request to:", url);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[clientHotelService] API returned error status:", response.status);
      const errorData = await response.json().catch(() => null);
      const msg = errorData?.message || `API Error: ${response.status}`;
      throw new Error(msg);
    }
    
    const data = await response.json();
    console.log("[clientHotelService] API response received, hotels count:", data?.hotels?.length || 0);
    return data as HotelsApiResponse;
  } catch (error) {
    console.error("[clientHotelService] Error fetching hotels:", error);
    throw error;
  }
} 