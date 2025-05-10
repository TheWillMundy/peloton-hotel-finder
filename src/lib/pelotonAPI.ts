export const BASE_URL = "https://hotelfinder.onepeloton.com";
export const SEARCH_ENDPOINT = "/en/search";
export const DATA_ENDPOINT = "/en/hotel-map-data";

// Default User-Agent string (can be overridden)
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

/**
 * Extracts the CSRF token from HTML content.
 * @param html The HTML string to parse.
 * @returns The CSRF token string, or null if not found.
 */
export const extractCSRFToken = (html: string): string | null => {
  const match = html.match(/window\._crsf\s*=\s*'([^']+)'/);
  return match ? match[1] : null;
};

interface FetchHotelsParams {
  searchTermForPelotonCsrf: string; // Renamed from city
  bboxJson: string; // The BBOX JSON string
  userAgent?: string;
  // We'll manage cookies automatically with Next.js fetch cache and `headers`
}

// --- Raw Peloton Data Interfaces (based on pyscript_output.json) ---
interface RawBikeFeature {
  name: string;
  has: boolean;
  nothas: boolean;
  tooltip: string | null;
}

export interface RawPelotonHotel {
  id: number;
  brand_id: number | null;
  name: string;
  slug: string;
  google_place_id: string;
  address_1: string;
  street_number: string;
  street: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  latitude: string; // Note: comes as string, needs conversion
  longitude: string; // Note: comes as string, needs conversion
  phone: string | null;
  has_bikes_fitness_center: 0 | 1;
  has_bikes_rooms: 0 | 1;
  total_bikes: number;
  num_bike?: number; // Older data might not have this split
  num_bike_plus?: number;
  num_row?: number;
  rewards_link: string | null;
  website: string | null;
  features: any | null; // Structure not fully clear from sample, handle flexibly
  digital_subscription_features: any | null;
  fitness_center_fee: number | string | null; // Type might vary
  fitness_center_description: string | null;
  distance: number | null; // Assuming it can be null if not calculable
  brand_name: string | null;
  bike_features_ids?: number[];
  bike_features?: RawBikeFeature[];
  total_equipment?: number;
  // other fields might exist
}

// --- Client API Contract Interface (as per PRODUCT_ENG_PLAN.md Section 6) ---
export interface ClientHotel {
  id: number;
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  distance_m: number | null; // Can be null if user location not available
  brand: string;
  loyaltyProgram: string; // Added for normalized loyalty program
  total_bikes: number;
  in_gym: boolean;
  in_room: boolean;
  bike_features: string[];
  url: string | null;
  tel: string | null;
}

const brandToLoyaltyMap: { [key: string]: string } = {
  // Accor
  "Accor Live Limitless (ALL)": "Accor Le Club",

  // Best Western
  "Best Western": "Best Western Rewards",
  "Best Western Plus": "Best Western Rewards",
  "Best Western Rewards": "Best Western Rewards",

  // Choice Privileges
  "Cambria Hotels": "Choice Privileges",
  "Choice Privileges": "Choice Privileges",
  "Choice Priviliges": "Choice Privileges", // Typo from Peloton's list

  // Hilton Honors
  "DoubleTree by Hilton": "Hilton Honors",
  "Hampton by Hilton": "Hilton Honors",
  "Hampton Inn & Suites": "Hilton Honors",
  "Hilton": "Hilton Honors",
  "Hilton Garden Inn": "Hilton Honors",
  "Hilton Honors": "Hilton Honors",
  "Hilton Tempo": "Hilton Honors",
  "Home2 Suites": "Hilton Honors",
  "Homewood Suites": "Hilton Honors",
  "Tapestry Collection": "Hilton Honors",
  "Tru by Hilton": "Hilton Honors",

  // IHG Rewards Club
  "Holiday Inn": "IHG Rewards Club",
  "Kimpton": "IHG Rewards Club",
  "IHG Rewards": "IHG Rewards Club",

  // Marriott Bonvoy
  "AC Hotel": "Marriott Bonvoy",
  "Courtyard Marriott": "Marriott Bonvoy",
  "Delta Hotel": "Marriott Bonvoy",
  "Le Meridien": "Marriott Bonvoy",
  "Marriott": "Marriott Bonvoy",
  "Marriott Bonvoy": "Marriott Bonvoy",
  "Renaissance": "Marriott Bonvoy",
  "Residence Inn": "Marriott Bonvoy",
  "Ritz-Carlton": "Marriott Bonvoy",
  "St. Regis": "Marriott Bonvoy",
  "Tribute Portfolio": "Marriott Bonvoy",
  "Westin": "Marriott Bonvoy",

  // Radisson Rewards
  "Radisson Rewards": "Radisson Rewards",

  // World of Hyatt
  "Destination Hotels": "World of Hyatt",
  "World of Hyatt": "World of Hyatt",

  // Wyndham Rewards
  "La Quinta": "Wyndham Rewards",
  "Wyndham Rewards": "Wyndham Rewards",
};

// Create a lowercase-keyed map once for getLoyaltyProgram
const lowercaseBrandToLoyaltyMap: Record<string, string> = Object.fromEntries(
  Object.entries(brandToLoyaltyMap).map(([key, value]) => [key.toLowerCase(), value])
);

/**
 * Returns normalized loyalty program for a given brand name, or 'Other' if unmapped.
 */
export function getLoyaltyProgram(brandName: string | null): string {
  if (!brandName) return "Other";
  const key = brandName.trim().toLowerCase();
  return lowercaseBrandToLoyaltyMap[key] || "Other";
}

/**
 * Transforms raw hotel data from Peloton API to the client-facing API contract.
 * @param rawHotels Array of raw hotel data objects.
 * @returns Array of transformed hotel data objects.
 */
export const transformPelotonHotelData = (
  rawHotels: RawPelotonHotel[]
): ClientHotel[] => {
  if (!Array.isArray(rawHotels)) {
    console.warn("transformPelotonHotelData received non-array input:", rawHotels);
    return [];
  }
  return rawHotels.map((rawHotel) => {
    const bikeFeatures: string[] = [];
    if (rawHotel.bike_features && Array.isArray(rawHotel.bike_features)) {
      rawHotel.bike_features.forEach((feature) => {
        if (feature.has) {
          bikeFeatures.push(feature.name);
        }
      });
    }

    return {
      id: rawHotel.id,
      place_id: rawHotel.google_place_id,
      name: rawHotel.name,
      lat: parseFloat(rawHotel.latitude), // Convert string to number
      lng: parseFloat(rawHotel.longitude), // Convert string to number
      distance_m: rawHotel.distance, // Assuming distance is already in meters or suitable unit
      brand: rawHotel.brand_name || "", // Default to empty string if null
      loyaltyProgram: getLoyaltyProgram(rawHotel.brand_name), // Added loyalty program
      total_bikes: rawHotel.total_bikes,
      in_gym: rawHotel.has_bikes_fitness_center === 1,
      in_room: rawHotel.has_bikes_rooms === 1,
      bike_features: bikeFeatures,
      url: rawHotel.website,
      tel: rawHotel.phone,
    };
  });
};

/**
 * Fetches hotel data from the Peloton API.
 *
 * 1. GETs the search page to pick up cookies and the CSRF token.
 * 2. POSTs the bounding-box JSON to hotel-map-data.
 * @param params Parameters for fetching hotels.
 * @returns The decoded JSON payload as an object.
 */
export const fetchPelotonHotels = async (
  params: FetchHotelsParams
): Promise<RawPelotonHotel[]> => {
  const { searchTermForPelotonCsrf, bboxJson, userAgent = DEFAULT_USER_AGENT } = params; // Destructure new param
  const searchUrl = `${BASE_URL}${SEARCH_ENDPOINT}?q=${encodeURIComponent(searchTermForPelotonCsrf)}`; // Use new param
  let cookiesForNextRequest: string | undefined = undefined;

  // 1. GET search page for CSRF token and cookies
  let searchResponse: Response;
  try {
    searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
      },
      cache: 'no-store',
    });
  } catch (networkError) {
    console.error(`[pelotonAPI] Network error fetching search page ${searchUrl}:`, networkError);
    throw new Error(`Network error while fetching Peloton search page for term ${searchTermForPelotonCsrf}.`);
  }

  if (!searchResponse.ok) {
    const errorBody = await searchResponse.text().catch(() => "Could not read error body");
    console.error(
      `[pelotonAPI] Failed to fetch search page ${searchUrl}. Status: ${searchResponse.status}. Body: ${errorBody}`
    );
    throw new Error(
      `Peloton API returned an error for search page (term: ${searchTermForPelotonCsrf}). Status: ${searchResponse.status}`
    );
  }

  // Check for getSetCookie existence directly
  let setCookieHeaders: string[] | undefined;
  if (typeof (searchResponse.headers as any).getSetCookie === 'function') { 
    setCookieHeaders = (searchResponse.headers as any).getSetCookie();
  }

  if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
    cookiesForNextRequest = setCookieHeaders
      .map(cookie => cookie.split(';')[0]) 
      .join('; '); 
  } else {
    // Fallback for environments where getSetCookie is not available or if it's a single header
    const singleSetCookieHeader = searchResponse.headers.get("set-cookie");
    if (singleSetCookieHeader) {
      cookiesForNextRequest = singleSetCookieHeader.split(';')[0];
    }
  }

  const htmlText = await searchResponse.text();
  const csrfToken = extractCSRFToken(htmlText);

  if (!csrfToken) {
    console.error(`[pelotonAPI] Could not locate CSRF token on the search page for ${searchUrl}`);
    throw new Error(`Could not locate CSRF token on Peloton search page for term ${searchTermForPelotonCsrf}.`);
  }

  // 2. POST to hotel-map-data
  const dataUrl = `${BASE_URL}${DATA_ENDPOINT}`;

  const headers: HeadersInit = {
    "User-Agent": userAgent,
    "Content-Type": "application/json;charset=UTF-8",
    "Referer": searchUrl,
    "Origin": BASE_URL,
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "X-CSRF-TOKEN": csrfToken,
  };

  if (cookiesForNextRequest) {
    headers["Cookie"] = cookiesForNextRequest; // Send back the processed cookies
  }

  let dataResponse: Response;
  try {
    dataResponse = await fetch(dataUrl, {
      method: "POST",
      headers,
      body: bboxJson,
      // TODO: Revert caching changes - ensure this revalidate time is restored
      next: { revalidate: 3600 }, // Restored caching to 1 hour (was 0)
    });
  } catch (networkError) {
    console.error(`[pelotonAPI] Network error fetching hotel data from ${dataUrl} for term ${searchTermForPelotonCsrf}:`, networkError);
    throw new Error(`Network error while fetching Peloton hotel data for term ${searchTermForPelotonCsrf}.`);
  }

  if (!dataResponse.ok) {
    const errorBody = await dataResponse.text().catch(() => "Could not read error body");
    console.error(
      `[pelotonAPI] Failed to fetch hotel data from ${dataUrl} for term ${searchTermForPelotonCsrf}. Status: ${dataResponse.status}. Body: ${errorBody}`
    );
    throw new Error(
      `Peloton API returned an error for hotel data (term: ${searchTermForPelotonCsrf}). Status: ${dataResponse.status}`
    );
  }

  try {
    return dataResponse.json() as Promise<RawPelotonHotel[]>;
  } catch (jsonError) {
    console.error(`[pelotonAPI] Failed to parse JSON response from ${dataUrl} for term ${searchTermForPelotonCsrf}:`, jsonError);
    throw new Error(`Failed to parse JSON response from Peloton API for term ${searchTermForPelotonCsrf}.`);
  }
};

// Example (for testing, not part of the library itself)
/*
async function testFetch() {
  try {
    const chicagoBbox = JSON.stringify({
      coords: [
        [41.644, -87.94],
        [42.023, -87.94],
        [42.023, -87.523],
        [41.644, -87.523],
      ],
      center: { lat: 41.878, lng: -87.629 },
    });

    const hotels = await fetchPelotonHotels({ searchTermForPelotonCsrf: "chicago", bboxJson: chicagoBbox });
    console.log(JSON.stringify(hotels, null, 2));
  } catch (error) {
    console.error("Test fetch failed:", error);
  }
}

// testFetch();
*/

// Note on Cookie Handling with Next.js fetch:
// - When using fetch on the server-side (Route Handlers, Server Components),
//   it does NOT automatically manage cookies like a browser.
// - To maintain a session:
//   1. Capture `Set-Cookie` headers from responses.
//   2. Include these cookies in subsequent `Cookie` headers.
// - The above implementation now uses `response.headers.getSetCookie()` for robust handling
//   of multiple `Set-Cookie` headers (common in Node.js environments for Next.js)
//   and correctly formats the `Cookie` header.
//   It falls back to `response.headers.get('set-cookie')` if `getSetCookie` isn't available.
// - For this API-01 task, the primary goal is to replicate the Python script's direct server-to-Peloton
//   interaction. The cookie handling above is a direct translation.
// - Vercel's Edge Functions (and Node.js generally) also behave this way.
// - If `fetch` is used in a Client Component, cookies are generally handled by the browser.
//
// For this API-01 task, the primary goal is to replicate the Python script's direct server-to-Peloton
// interaction. The cookie handling above is a direct translation.
// The `fetch` API in Node.js (which Next.js uses) and Edge runtime has become more standardized,
// but careful attention to headers (like 'cookie' and 'set-cookie') is essential for stateful interactions. 