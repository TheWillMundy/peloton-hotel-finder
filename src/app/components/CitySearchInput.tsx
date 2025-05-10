"use client";

import { useCallback, useState } from 'react';
import { SearchBox } from '@mapbox/search-js-react';
// Attempting to use the types as documented or inferring them based on usage.

export interface MapboxGeocodingFeature {
  lat: number;
  lng: number;
  placeName: string;
  mapboxBbox?: [number, number, number, number];
  featureType?: string;
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

  const handleRetrieve = useCallback(
    (response: any) => {
      if (response && response.features && response.features.length > 0) {
        const feature = response.features[0];
        if (feature.geometry && Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length >= 2) {
          const lng = feature.geometry.coordinates[0];
          const lat = feature.geometry.coordinates[1];
          const placeName = feature.properties?.place_formatted || feature.properties?.name || '';
          const mapboxBbox = feature.bbox;
          const featureType = feature.properties?.feature_type;
  
          onLocationRetrieved({
            lat,
            lng,
            placeName,
            mapboxBbox,
            featureType,
          });
        } else {
          console.warn("[MapboxSearchInput] Retrieved feature has invalid geometry:", feature);
          if (onNoResultsFound) onNoResultsFound();
        }
      } else {
        if (onNoResultsFound) {
          onNoResultsFound();
        }
      }
    },
    [onLocationRetrieved, onNoResultsFound]
  );

  // Define options with types that should align with SearchBox expectations
  // The 'types' prop expects a string (comma-separated) or Set.
  // The 'categories' prop expects an array of strings.
  const searchOptions = {
    language: 'en' as const, // Use 'as const' for literal types
    types: 'place,poi' as string, // Comma-separated string for types
    categories: ['lodging', 'place.city', 'place.region', 'place.country', 'place.postcode', 'place.district', 'place.locality', 'place.neighborhood'],
    limit: 5,
    bbox: [-125.0, 24.0, -66.5, 49.5] as [number,number,number,number], // Continental US, ensure type
    debounceEvents: 300,
  };

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