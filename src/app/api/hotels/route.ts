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

// MVP: Hardcoded city bounding boxes
// Later, this could come from a DB or a geocoding service for unknown cities
// const cityBboxData: Record<string, CityBbox> = {
//   chicago: {
//     coords: [
//       [41.644, -87.94],
//       [42.023, -87.94],
//       [42.023, -87.523],
//       [41.644, -87.523],
//     ],
//     center: { lat: 41.878, lng: -87.629 },
//   },
//   // Add other cities here as needed, e.g., newyork, london
//   newyork: { // Example for New York - replace with actual coordinates
//     coords: [
//         [40.477399, -74.25909],  // Southwest
//         [40.917577, -74.25909],  // Northwest
//         [40.917577, -73.700272], // Northeast
//         [40.477399, -73.700272]  // Southeast
//     ],
//     center: { lat: 40.7128, lng: -74.0060 }
//   }
// };

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { error: "City query parameter is required" },
      { status: 400 }
    );
  }

  // const normalizedCity = city.toLowerCase(); // Normalization happens in getCachedHotelsByCity
  // const bbox = cityBboxData[normalizedCity]; // Logic moved to getCachedHotelsByCity

  // if (!bbox) { // Logic moved
  //   return NextResponse.json(
  //     { error: `Bounding box data not found for city: ${city}` },
  //     { status: 404 }
  //   );
  // }

  // const bboxJson = JSON.stringify(bbox); // Logic moved

  try {
    const hotels: ClientHotel[] = await getCachedHotelsByCity(city);
    return NextResponse.json(hotels);
  } catch (error) {
    console.error(
      `[API /api/hotels] Error processing request for city '${city}':`,
      error instanceof Error ? error.message : error,
      error instanceof Error && error.stack ? `\nStack: ${error.stack}` : ""
    );

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching hotel data.";
    
    // Check if it's the specific "Bounding box data not found" error to return 404
    if (errorMessage.startsWith("Bounding box data not found for city")) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to retrieve hotel data. Please try again later.", details: errorMessage }, 
      { status: 500 }
    );
  }
} 