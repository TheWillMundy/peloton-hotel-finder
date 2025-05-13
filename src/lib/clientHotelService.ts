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
 * Fetch hotels from the backend API with given parameters.
 */
export async function fetchHotels(
  params: FetchHotelParams
): Promise<HotelsApiResponse> {
  const query = new URLSearchParams();
  query.set('lat', String(params.lat));
  query.set('lng', String(params.lng));
  if (params.searchTerm) query.set('searchTerm', params.searchTerm);
  if (params.featureType) query.set('featureType', params.featureType);
  if (params.freeText) query.set('freeText', params.freeText);
  if (params.cityBbox) query.set('cityBbox', params.cityBbox);

  const url = `/api/hotels?${query.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const msg = errorData?.message || `API Error: ${response.status}`;
    throw new Error(msg);
  }
  return response.json() as Promise<HotelsApiResponse>;
} 