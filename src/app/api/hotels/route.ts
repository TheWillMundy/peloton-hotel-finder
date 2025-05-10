import { NextRequest, NextResponse } from "next/server";
// import { fetchPelotonHotels } from "@/lib/pelotonAPI"; // Using alias @ for app directory
// import {
//   transformPelotonHotelData,
//   ClientHotel,
// } from "../../lib/pelotonAPI"; // Corrected to relative path
// import { unstable_cache as nextCache } from "next/cache"; // For server-side data caching
import { getCachedHotelsByCriteria, findHotelByFuzzyMatch } from "@/lib/hotelService"; // Corrected import - REMOVED calculateDistance, generateWideBbox, generateNarrowBbox
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

// Define the expected response structure
interface HotelsApiResponse {
  hotels: ClientHotel[];
  cityCenter: [number, number]; // Service now guarantees this. Lng, Lat order for response consistency.
  matchedHotel?: ClientHotel | null;    // Fuzzy matched hotel when freeText provided
  matchConfidence?: number | null;      // Confidence score for the match
  cityBbox?: string;                    // The bounding box used/generated for this search
}

// Define error response type separately
interface ErrorResponse {
  error: string;
}

// /**
//  * Generate a cache key based on search intent
//  * This helps us identify the search purpose for analytics and cache optimization
//  */
// const getSearchPurpose = (featureType: string | null, freeText: string | null): 'city' | 'hotel' | 'poi' => {
//   if (freeText) return 'hotel';
//   if (featureType === 'poi') return 'poi';
//   return 'city';
// };

export async function GET(request: NextRequest): Promise<NextResponse<HotelsApiResponse | ErrorResponse>> {
  const searchParams = request.nextUrl.searchParams;
  
  // Parse required coordinates
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  
  // Parse optional parameters
  const searchTerm = searchParams.get("searchTerm") || "";
  const featureType = searchParams.get("featureType") || "place"; // Default to 'place' type
  const freeText = searchParams.get("freeText") || null;
  const cityBbox = searchParams.get("cityBbox") || null;
  
  // Validate required parameters
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lng parameters" },
      { status: 400 }
    );
  }

  console.log(`[api/hotels] Processing ${freeText ? 'hotel' : 'city'} search at (${lat}, ${lng})`);

  try {
    // Get hotels from the Peloton API with caching
    const { hotels, cityCenter, cityBbox: returnedBbox } = await getCachedHotelsByCriteria({
      lat,
      lng,
      searchTerm,
      featureType,
      providedCityBbox: cityBbox // Use the provided cityBbox if available
    });

    // Prepare the base response
    const response: HotelsApiResponse = {
      hotels,
      cityCenter,
      cityBbox: returnedBbox // Include the bbox used/generated for this search
    };
    
    // For hotel searches, perform fuzzy matching
    if (freeText) {
      const { matchedHotel, confidence } = await findHotelByFuzzyMatch(hotels, freeText);
      
      if (matchedHotel) {
        console.log(`[api/hotels] Found match for "${freeText}": ${matchedHotel.name} (${confidence.toFixed(2)})`);
        response.matchedHotel = matchedHotel;
        response.matchConfidence = confidence;
      } else {
        console.log(`[api/hotels] No good match found for "${freeText}"`);
        response.matchedHotel = null;
        response.matchConfidence = null;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/hotels] Error fetching hotels:", error);
    return NextResponse.json(
      { error: "Failed to fetch hotels" },
      { status: 500 }
    );
  }
}
