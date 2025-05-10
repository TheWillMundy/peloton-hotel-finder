import { NextRequest, NextResponse } from "next/server";
// import { fetchPelotonHotels } from "@/lib/pelotonAPI"; // Using alias @ for app directory
// import {
//   transformPelotonHotelData,
//   ClientHotel,
// } from "../../lib/pelotonAPI"; // Corrected to relative path
// import { unstable_cache as nextCache } from "next/cache"; // For server-side data caching
import { getCachedHotelsByCriteria, findHotelByFuzzyMatch } from "@/lib/hotelService"; // Corrected import
import type { ClientHotel } from "@/lib/pelotonAPI"; // Re-add ClientHotel type import

// Very basic city center/bbox data - extend this or use a geocoding service
// Coordinates are generally [longitude, latitude]
// const cityBboxData: { [key: string]: { center: [number, number]; bbox: string } } = {
//   chicago: {
//     center: [-87.6298, 41.8781],
//     bbox: "-87.9401,41.6445,-87.5240,42.0230",
//   },
//   newyork: { // Example for New York City
//     center: [-74.0060, 40.7128],
//     bbox: "-74.2591,40.4774,-73.7004,40.9176", // Example bounding box for NYC area
//   },
//   // Add more cities here
// };

// Define the expected response structure from the service (and for this API)
interface HotelsApiResponse {
  hotels: ClientHotel[];
  cityCenter: [number, number]; // Service now guarantees this. Lng, Lat order for response consistency.
  matchedHotel?: ClientHotel | null;    // Fuzzy matched hotel when freeText provided
  matchConfidence?: number | null;      // Confidence score for the match
}

// Helper to create a default Peloton BBox JSON string from lat/lng
const createDefaultPelotonBbox = (lat: number, lng: number, delta: number = 0.1): string => {
  const minLat = lat - delta;
  const maxLat = lat + delta;
  const minLng = lng - delta;
  const maxLng = lng + delta;
  return JSON.stringify({
    coords: [
      [minLat, minLng],
      [maxLat, minLng],
      [maxLat, maxLng],
      [minLat, maxLng],
    ],
    center: { lat, lng },
  });
};

// Helper to create Peloton BBox JSON string from Mapbox Bbox [minLng, minLat, maxLng, maxLat]
const createPelotonBboxFromMapbox = (mapboxBboxArray: [number, number, number, number], lat: number, lng: number): string => {
  const [minLng, minLat, maxLng, maxLat] = mapboxBboxArray;
  return JSON.stringify({
    coords: [
      [minLat, minLng],
      [maxLat, minLng],
      [maxLat, maxLng],
      [minLat, maxLng],
    ],
    center: { lat, lng }, // Use the precise center from Mapbox feature
  });
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const mapboxBboxStr = searchParams.get("mapboxBbox"); // Optional: "[minLng,minLat,maxLng,maxLat]"
  const searchTerm = searchParams.get("searchTerm");
  const freeText = searchParams.get("freeText"); // Optional hotel name for fuzzy match
  // const featureType = searchParams.get("featureType"); // Not directly used yet, but good for future logic

  if (!latStr || !lngStr || !searchTerm) {
    return NextResponse.json(
      { error: "Missing required parameters: lat, lng, and searchTerm are required." },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Invalid latitude or longitude values." },
      { status: 400 }
    );
  }

  let pelotonApiBboxJson: string;

  try {
    if (mapboxBboxStr) {
      const parsedMapboxBbox = JSON.parse(mapboxBboxStr) as [number, number, number, number];
      if (Array.isArray(parsedMapboxBbox) && parsedMapboxBbox.length === 4 && parsedMapboxBbox.every(coord => typeof coord === 'number')) {
        pelotonApiBboxJson = createPelotonBboxFromMapbox(parsedMapboxBbox, lat, lng);
      } else {
        console.warn("[api/hotels] Invalid mapboxBbox string received, falling back to default bbox:", mapboxBboxStr);
        pelotonApiBboxJson = createDefaultPelotonBbox(lat, lng);
      }
    } else {
      // If no mapboxBbox is provided (e.g., for a POI search or if Mapbox didn't return one),
      // create a default, consistent bounding box around the lat/lng.
      pelotonApiBboxJson = createDefaultPelotonBbox(lat, lng);
    }
  } catch (e) {
    console.error("[api/hotels] Error parsing mapboxBbox string:", mapboxBboxStr, e);
    // Fallback to default if parsing fails
    pelotonApiBboxJson = createDefaultPelotonBbox(lat, lng);
  }
  
  try {
    console.log(`[api/hotels] Requesting hotels with pelotonApiBboxJson: ${pelotonApiBboxJson}, searchTerm: ${searchTerm}`);
    
    // getCachedHotelsByCriteria handles fetching, transformation, and caching
    const result = await getCachedHotelsByCriteria(
      pelotonApiBboxJson,
      searchTerm, // This is used as searchTermForPelotonCsrf
      lat,        // For the cityCenter in response
      lng         // For the cityCenter in response
    );
    
    console.log(`[api/hotels] Found ${result.hotels.length} hotels for searchTerm: ${searchTerm} at ${lat},${lng}`);

    // Perform fuzzy match if hotel freeText provided
    const { hotels } = result;
    let matchedHotel: ClientHotel | null = null;
    let matchConfidence: number | null = null;
    if (freeText) {
      console.log(`[api/hotels] Fuzzy matching for freeText: "${freeText}" against ${hotels.length} hotels.`);
      const { hotel, matchConfidence: confidence } = findHotelByFuzzyMatch(hotels, freeText);
      console.log(`[api/hotels] Fuzzy match result:`, { hotelId: hotel?.id, confidence });
      matchedHotel = hotel;
      matchConfidence = confidence;
    }
    const responsePayload = {
      hotels,
      cityCenter: [lng, lat], // Standardize to [lng, lat] for Mapbox GL JS
      matchedHotel,
      matchConfidence,
    } as HotelsApiResponse;
    
    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error(
      `[api/hotels] Error processing request for searchTerm ${searchTerm} at ${lat},${lng}:`,
      error instanceof Error ? error.message : error,
      error instanceof Error && error.stack ? `\nStack: ${error.stack}` : ''
    );
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: `Failed to retrieve hotel data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
