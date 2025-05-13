"use client";

import { useCallback, useState, useMemo } from 'react';
import { SearchBox } from '@mapbox/search-js-react';
import { useMapboxSession } from '@/app/hooks/useMapboxSession';
// Attempting to use the types as documented or inferring them based on usage.

export interface MapboxGeocodingFeature {
  lat: number;
  lng: number;
  placeName: string;
  mapboxBbox?: [number, number, number, number];
  featureType?: string;
  category?: string;
  hotelName?: string;
  // Add context to store parent features from Mapbox response
  context?: Array<{
    id: string;
    text: string;
    wikidata?: string;
    short_code?: string; // For region/country codes
    // Mapbox feature types: country, region, postcode, district, place, locality, neighborhood, address, poi
    // We are primarily interested in 'place' for city context.
  }>;
}

interface MapboxSearchInputProps {
  onLocationRetrieved: (feature: MapboxGeocodingFeature) => void;
  onNoResultsFound?: () => void;
  isLoading?: boolean;
  className?: string;
  initialValue?: string;
}

export default function MapboxSearchInput({
  onLocationRetrieved,
  onNoResultsFound,
  isLoading,
  className,
  initialValue = '',
}: MapboxSearchInputProps) {
  const [value, setValue] = useState(initialValue);
  // Use our custom hook to get a session token that persists in localStorage
  const sessionToken = useMapboxSession();

  const handleRetrieve = useCallback(
    (response: any) => {
      // 1. Basic validation of response and features array
      if (!response || !response.features || !Array.isArray(response.features) || response.features.length === 0) {
        console.log("[CitySearchInput] No features returned from Mapbox or features array is empty.");
        if (onNoResultsFound) onNoResultsFound();
        return;
      }

      const features = response.features;
      console.log("[CitySearchInput] Raw features from Mapbox:", JSON.stringify(features, null, 2));

      // Log details for each feature to inspect their structure
      features.forEach((feature: any, index: number) => {
        console.log(`[CitySearchInput] Feature ${index}:`, {
          place_name: feature.properties?.place_name,
          text: feature.properties?.text,
          place_type: feature.place_type, // Raw place_type array
          feature_type: feature.properties?.feature_type, // From properties
          center: feature.center, // Raw center property
          geometry_coords: feature.geometry?.coordinates, // Coords from geometry
          id: feature.id,
          full_feature_logged: feature // Log the full feature if needed during deep debug
        });
      });

      let selectedCityFeature: any = null;
      let potentialHotelName: string | null = null;

      // 2. Attempt to find the best city-level feature: prefer 'place' features
      const placeFeature = features.find((f: any) => {
        const coords = f?.geometry?.coordinates;
        return Array.isArray(coords) && coords.length >= 2 && f.properties?.feature_type === 'place';
      });
      if (placeFeature) {
        selectedCityFeature = placeFeature;
        console.log("[CitySearchInput] Selected place feature as city:", JSON.stringify(placeFeature));
      } else {
        // Fallback: first feature with valid coordinates
        selectedCityFeature = features.find((f: any) => {
          const coords = f?.geometry?.coordinates;
          return Array.isArray(coords) && coords.length >= 2;
        });
        console.log("[CitySearchInput] No place feature found, falling back to first feature with coords:", JSON.stringify(selectedCityFeature));
      }

      // 3. If still no valid feature found, handle error
      if (!selectedCityFeature) {
        console.warn("[CitySearchInput] Could not find a feature with valid coordinates after all checks.");
        if (onNoResultsFound) onNoResultsFound();
        return;
      }
      
      console.log("[CitySearchInput] Final selectedCityFeature:", JSON.stringify(selectedCityFeature, null, 2));

      // 5. Extract data from the selectedCityFeature (which now has geometry.coordinates)
      const lng = selectedCityFeature.geometry.coordinates[0];
      const lat = selectedCityFeature.geometry.coordinates[1];
      
      // Try to get the most meaningful place name
      let placeName = '';
      if (selectedCityFeature.properties?.full_address) {
        placeName = selectedCityFeature.properties.full_address;
      } else if (selectedCityFeature.properties?.place_formatted) {
        placeName = selectedCityFeature.properties.place_formatted;
      } else if (selectedCityFeature.properties?.name) {
        placeName = selectedCityFeature.properties.name;
      }
      
      // Get city information from context if available
      const cityName = selectedCityFeature.properties?.context?.place?.name || '';
      if (cityName && !placeName.includes(cityName)) {
        placeName = placeName ? `${placeName}, ${cityName}` : cityName;
      }
      
      const mapboxBbox = selectedCityFeature.bbox;
      const featureType = selectedCityFeature.properties?.feature_type;
      const category = selectedCityFeature.properties?.poi_category?.[0] ?? featureType;
      const context = selectedCityFeature.properties?.context;

      // 6. If this is a hotel/POI, capture the name for fuzzy matching
      if (selectedCityFeature.properties?.feature_type === 'poi') {
        potentialHotelName = selectedCityFeature.properties.name;
        console.log("[CitySearchInput] POI name from feature:", potentialHotelName);
      }

      console.log("[CitySearchInput] Successfully processed. Feature name:", placeName, "Coords:", { lat, lng });
      if (potentialHotelName) {
        console.log("[CitySearchInput] POI name for fuzzy match:", potentialHotelName);
      }

      // 7. Construct and dispatch the geocodingFeature
      const geocodingFeature: MapboxGeocodingFeature = {
        lat,
        lng,
        placeName,
        mapboxBbox, 
        featureType, 
        category,
        hotelName: potentialHotelName ?? undefined,
        context,
      };
      console.log("[CitySearchInput] Dispatching onLocationRetrieved with:", JSON.stringify(geocodingFeature, null, 2));
      onLocationRetrieved(geocodingFeature);
    },
    [onLocationRetrieved, onNoResultsFound]
  );

  // Define options with types that should align with SearchBox expectations
  // The 'types' prop expects a string (comma-separated) or Set.
  // The 'categories' prop expects an array of strings.
  const searchOptions = useMemo(() => ({
    language: 'en' as const, // Use 'as const' for literal types
    types: 'place,poi' as string, // Comma-separated string for types
    // types: 'place,poi' as string, // Comma-separated string for types
    categories: ['lodging', 'place.city'], // TODO: We may need to add more categories here for countries other than the US
    poi_category: 'lodging',
    // categories: ['lodging', 'place.city', 'place.region', 'place.country', 'place.postcode', 'place.district', 'place.locality', 'place.neighborhood'],
    limit: 3,
    bbox: [-125.0, 24.0, -66.5, 49.5] as [number,number,number,number], // Continental US, ensure type // TODO: We may need to add more bbox here for countries other than the US
    debounceEvents: 300,
    ...(sessionToken && { session_token: sessionToken }), // Only add session_token when it's available
  }), [sessionToken]);

  return (
    <div className={`mapbox-search-input-container relative ${className || ''}`}>
      {/* @ts-expect-error // Temporarily ignore JSX component type error, as per linter suggestion */}
      <SearchBox
        accessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ''}
        value={value}
        onChange={(text) => setValue(text)}
        onRetrieve={handleRetrieve} // The type of handleRetrieve should be compatible now
        options={searchOptions} // Pass the well-typed options object
        placeholder="Search city or hotel..."
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md">
          <div className="w-6 h-6 border-t-2 border-blue-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
} 