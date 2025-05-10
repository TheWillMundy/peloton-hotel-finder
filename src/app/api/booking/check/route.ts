import { NextRequest, NextResponse } from "next/server";
import {
  getCachedHotelsByCriteria,
  findHotelByFuzzyMatch,
} from "@/lib/hotelService";
import type { ClientHotel } from "@/lib/pelotonAPI";
// import Fuse from "fuse.js"; // No longer needed directly in this file

interface BookingCheckResponse {
  matchConfidence: number | null;
  hotel: ClientHotel | null;
  hasBikes: boolean;
  message?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const freeText = searchParams.get("freeText");
  const city = searchParams.get("city");

  if (!freeText || !city) {
    return NextResponse.json(
      {
        matchConfidence: null,
        hotel: null,
        hasBikes: false,
        message: "freeText and city query parameters are required",
      } as BookingCheckResponse,
      { status: 400 }
    );
  }

  try {
    const hotelsInCity: ClientHotel[] = await getCachedHotelsByCriteria(city);

    if (!hotelsInCity || hotelsInCity.length === 0) {
      return NextResponse.json(
        {
          matchConfidence: null,
          hotel: null,
          hasBikes: false,
          message: `No hotel data found for city: ${city}`,
        } as BookingCheckResponse,
        { status: 404 }
      );
    }

    const matchResult = findHotelByFuzzyMatch(hotelsInCity, freeText);

    if (!matchResult.hotel) {
      return NextResponse.json(
        {
          matchConfidence: null,
          hotel: null,
          hasBikes: false,
          message: "No hotel match found for the provided text.",
        } as BookingCheckResponse,
        { status: 200 } 
      );
    }
    
    return NextResponse.json({
      matchConfidence: matchResult.matchConfidence,
      hotel: matchResult.hotel,
      hasBikes: matchResult.hasBikes,
    } as BookingCheckResponse);

  } catch (error) {
    console.error(
      `[API /api/booking/check] Error processing request for city '${city}', freeText '${freeText}':`,
      error instanceof Error ? error.message : error,
      error instanceof Error && error.stack ? `\nStack: ${error.stack}` : ""
    );

    if (error instanceof Error && error.message.startsWith("Bounding box data not found for city")) {
      return NextResponse.json(
        {
          matchConfidence: null,
          hotel: null,
          hasBikes: false,
          message: error.message,
        } as BookingCheckResponse,
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        matchConfidence: null,
        hotel: null,
        hasBikes: false,
        message: "An internal error occurred during booking check.",
      } as BookingCheckResponse,
      { status: 500 }
    );
  }
} 