"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
// import type { ClientHotel } from '@/lib/pelotonAPI'; // Keep if selectedHotelForQuery needs full type
import type { MapboxGeocodingFeature } from '@/app/components/search/CitySearchInput';

// Assuming ZOOM_LEVELS is still relevant or defined elsewhere, e.g., a new constants file or locally if only used here
// For now, let's define it here if not imported
export const ZOOM_LEVELS = {
  CITY: 14,
  DISTRICT: 14,
  HOTEL: 16,
  NO_MATCH_CITY_OVERVIEW: 14, // New zoom level, same as city for now
  COUNTRY: 4.5 // Adding default country-level zoom
};
import { calculateDistance } from '@/lib/utils';

export type SearchType = 'city' | 'hotel' | 'none';

// NEW: Define the core search intent
export interface SearchIntent {
  location: { lat: number; lng: number } | null;
  searchType: SearchType;
  searchTerm: string | null; // The primary text for the search (city name or hotel name from feature.placeName)
  selectedHotelNameForQuery: string | null; // Specific hotel name if it's a hotel search, from feature.placeName
  mapboxFeatureBbox: string | null; // Bbox from Mapbox feature, if available (for city searches)
  // Storing the full feature can be useful for display name or other properties later
  rawMapboxFeature: MapboxGeocodingFeature | null;
}

// Modified SearchContextState
export interface SearchContextState {
  currentIntent: SearchIntent;
  needsFreshHotels: boolean; // If the next query for the currentIntent should be fresh
  // cityNameForDisplay is removed, can be derived from currentIntent.rawMapboxFeature.placeName or currentIntent.searchTerm
}

interface SearchContextType {
  searchContextState: SearchContextState;
  setSearchIntent: (intent: SearchIntent) => void; // Main way to update search parameters
  clearSearch: () => void; // Renamed from clearSearchIntent for clarity
  // setZoom is removed
  // setNeedsFreshHotels is now managed internally by setSearchIntent based on location changes
  // setIsLoading is removed, will be handled by TanStack Query in page.tsx
  handleLocationRetrieved: (feature: MapboxGeocodingFeature, forceFresh?: boolean) => void;
  // setCityName, setSelectedHotel, setMatchedHotelId, setHotels are removed
  // setCityBbox (for API response bbox) is removed
  // setLocation (direct) is removed, intent.location is used
  // setSearchType (direct) is removed, intent.searchType is used
}

const initialIntent: SearchIntent = {
  location: null,
  searchType: 'none',
  searchTerm: null,
  selectedHotelNameForQuery: null,
  mapboxFeatureBbox: null,
  rawMapboxFeature: null,
};

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [currentIntent, setCurrentIntentState] = useState<SearchIntent>(initialIntent);
  const [needsFreshHotels, setNeedsFreshHotels] = useState(false);
  const [lastMajorLocation, setLastMajorLocation] = useState<{lat: number; lng: number} | null>(null);

  const setSearchIntent = (intent: SearchIntent) => {
    setCurrentIntentState(intent);

    let freshRequired = false;
    if (intent.location && lastMajorLocation) {
      const distance = calculateDistance(
        intent.location.lat, intent.location.lng,
        lastMajorLocation.lat, lastMajorLocation.lng
      );
      if (distance > 50) { // More than 50km moved
        freshRequired = true;
        setLastMajorLocation(intent.location);
      }
    } else if (intent.location) { // First location set or lastMajorLocation was null
      freshRequired = true;
      setLastMajorLocation(intent.location);
    }
    setNeedsFreshHotels(freshRequired);
  };

  const clearSearch = () => {
    setCurrentIntentState(initialIntent);
    setNeedsFreshHotels(false);
    setLastMajorLocation(null);
  };

  const handleLocationRetrieved = (feature: MapboxGeocodingFeature, forceFresh: boolean = false) => {
    const isHotelSearch = feature.featureType === 'poi';
    const newSearchType: SearchType = isHotelSearch ? 'hotel' : 'city';

    const newIntent: SearchIntent = {
      location: { lat: feature.lat, lng: feature.lng },
      searchType: newSearchType,
      searchTerm: feature.placeName, // General search term
      selectedHotelNameForQuery: isHotelSearch ? feature.hotelName || feature.placeName : null, // Use hotelName if available, else placeName for POIs
      mapboxFeatureBbox: feature.mapboxBbox ? feature.mapboxBbox.join(',') : null,
      rawMapboxFeature: feature,
    };
    setSearchIntent(newIntent);
    // Explicitly set needsFreshHotels if forceFresh is true
    if (forceFresh) {
        setNeedsFreshHotels(true);
    }
    // isLoading and other direct data states are now handled by useQuery in page.tsx
  };

  return (
    <SearchContext.Provider value={{
      searchContextState: { currentIntent, needsFreshHotels },
      setSearchIntent,
      clearSearch,
      handleLocationRetrieved,
    }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
} 