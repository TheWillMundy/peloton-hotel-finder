import { NextRequest, NextResponse } from "next/server";
// import { fetchPelotonHotels } from "@/lib/pelotonAPI"; // Using alias @ for app directory
// import {
//   transformPelotonHotelData,
//   ClientHotel,
// } from "../../lib/pelotonAPI"; // Corrected to relative path
// import { unstable_cache as nextCache } from "next/cache"; // For server-side data caching
import { getCachedHotelsByCity } from "@/lib/hotelService"; // Import the new service
import type { ClientHotel } from "@/lib/pelotonAPI"; // Re-add ClientHotel type import

// CityBbox interface and cityBboxData variable are defined and used within hotelService.ts, no longer needed here.

// Very basic city center/bbox data - extend this or use a geocoding service
// Coordinates are generally [longitude, latitude]
const cityBboxData: { [key: string]: { center: [number, number]; bbox: string } } = {
  chicago: {
    center: [-87.6298, 41.8781],
    bbox: "-87.9401,41.6445,-87.5240,42.0230",
  },
  newyork: { // Example for New York City
    center: [-74.0060, 40.7128],
    bbox: "-74.2591,40.4774,-73.7004,40.9176", // Example bounding box for NYC area
  },
  // Add more cities here
};

// Define the expected response structure
interface HotelsApiResponse {
  hotels: ClientHotel[];
  cityCenter?: [number, number]; // Optional in case city lookup fails unexpectedly, though unlikely with current structure
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json({ message: "City parameter is required" }, { status: 400 });
  }

  // Normalize city name for lookup in cityBboxData
  const normalizedCity = city.toLowerCase();
  const cityData = cityBboxData[normalizedCity];

  // We need the city center regardless of cache status, so look it up first
  const cityCenter = cityData?.center; // Get center if city is known

  try {
    console.log(`[api/hotels] Getting cached hotels for city: ${city}`);
    // getCachedHotelsByCity handles fetching, transformation, and caching internally
    const hotels: ClientHotel[] = await getCachedHotelsByCity(city);
    console.log(`[api/hotels] Found ${hotels.length} hotels for ${city}`);

    // Construct the response payload
    const responsePayload: HotelsApiResponse = {
      hotels: hotels,
      // Include cityCenter only if the city was found in our predefined list
      // If getCachedHotelsByCity threw an error for unknown city, this won't be reached
      cityCenter: cityCenter 
    };

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error(`[api/hotels] Error processing request for city ${city}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";

    // Check if the error came from getCachedHotelsByCity due to unknown city
    // (Assuming getCachedHotelsByCity throws a specific error or message for this)
    if (errorMessage.includes("No data configuration found for city") || errorMessage.includes("Bounding box data not found")) {
        return NextResponse.json({ message: `No data configuration found for city: ${city}` }, { status: 404 });
    }

    // Generic server error for other issues
    return NextResponse.json({ message: `Failed to retrieve hotel data for ${city}: ${errorMessage}` }, { status: 500 });
  }
} 