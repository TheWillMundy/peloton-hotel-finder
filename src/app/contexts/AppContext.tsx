"use client";

import React, { ReactNode, useReducer, useContext, useEffect } from 'react';
import type { MapboxGeocodingFeature } from '@/app/components/search/CitySearchInput';
import type { ClientHotel } from '@/lib/pelotonAPI';
import type { Filters } from '@/app/components/filter/FilterChips';
import type { BottomSheetState } from '@/app/components/ui/BottomSheet';

// Define zoom levels
export const ZOOM_LEVELS = {
  CITY: 14,
  HOTEL: 16,
  NO_MATCH_CITY_OVERVIEW: 14,
  COUNTRY: 4.5
};

// ----- State Interfaces -----
export type HighlightType = 'idle' | 'city_overview' | 'match_found' | 'poi_no_match' | 'hover_focus';
export type InteractionSource = 'map' | 'sidebar' | 'none';

export interface SearchIntent {
  location: { lat: number; lng: number } | null;
  searchType: 'city' | 'hotel' | 'none';
  searchTerm: string | null;
  selectedHotelNameForQuery: string | null;
  mapboxFeatureBbox: string | null;
  rawMapboxFeature: MapboxGeocodingFeature | null;
  needsFresh: boolean;
}

export interface AppState {
  // Search
  searchIntent: SearchIntent;
  lastSearchedMapBounds: string | null;
  // Last interactive map movement for 'Search this area'
  interactiveMapState: { center: [number, number]; zoom: number; bounds: string } | null;

  // Map View
  mapCenter: [number, number];
  mapZoom: number;
  highlightType: HighlightType;
  targetHotelId: number | null;

  // UI interactions
  hoveredHotelId: number | null;
  hoverSource: InteractionSource;
  selectedHotelIdForModal: number | null;

  // Filters
  activeFilters: Filters;

  // Layout
  isMobile: boolean;
  isPanelOpen: boolean;
  bottomSheetState: BottomSheetState;
  showSearchAreaButton: boolean;
}

// ----- Actions -----
export type AppAction =
  | { type: 'SET_IS_MOBILE'; payload: boolean }
  | { type: 'SET_PANEL_OPEN'; payload: boolean }
  | { type: 'SET_BOTTOM_SHEET_STATE'; payload: BottomSheetState }
  | { type: 'LOCATION_SELECTED'; payload: MapboxGeocodingFeature }
  | { type: 'SEARCH_THIS_AREA' }
  | { type: 'API_RESPONSE_RECEIVED'; payload: {
      hotels: ClientHotel[];
      cityCenter: [number, number];
      cityBbox: string | null;
      matchedHotel?: ClientHotel | null;
      matchConfidence?: number | null;
      searchedPoinLocation?: { lat: number; lng: number; name: string } | null;
    } }
  | { type: 'MAP_MOVED_INTERACTIVELY'; payload: { center: [number, number]; zoom: number; bounds: string } }
  | { type: 'HOTEL_HOVERED'; payload: { id: number | null; source: InteractionSource } }
  | { type: 'HOTEL_SELECTED'; payload: { id: number; source: 'map' | 'list' } }
  | { type: 'CLOSE_HOTEL_MODAL' }
  | { type: 'FILTERS_CHANGED'; payload: Filters };

const initialIntent: SearchIntent = {
  location: null,
  searchType: 'none',
  searchTerm: null,
  selectedHotelNameForQuery: null,
  mapboxFeatureBbox: null,
  rawMapboxFeature: null,
  needsFresh: false
};

export const initialState: AppState = {
  searchIntent: initialIntent,
  lastSearchedMapBounds: null,
  interactiveMapState: null,
  mapCenter: [-98.5795, 39.8283], // default US center
  mapZoom: ZOOM_LEVELS.COUNTRY,
  highlightType: 'idle',
  targetHotelId: null,
  hoveredHotelId: null,
  hoverSource: 'none',
  selectedHotelIdForModal: null,
  activeFilters: { inRoom: false, inGym: false, loyaltyPrograms: [] },
  isMobile: false,
  isPanelOpen: true,
  bottomSheetState: 'peek',
  showSearchAreaButton: false
};

// Reducer function handling all actions
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_IS_MOBILE':
      return { ...state, isMobile: action.payload };
    case 'SET_PANEL_OPEN':
      return { ...state, isPanelOpen: action.payload };
    case 'SET_BOTTOM_SHEET_STATE':
      return { ...state, bottomSheetState: action.payload };
    case 'LOCATION_SELECTED': {
      const feature = action.payload;
      const isHotelSearch = feature.featureType === 'poi';
      const intent: SearchIntent = {
        location: { lat: feature.lat, lng: feature.lng },
        searchType: isHotelSearch ? 'hotel' : 'city',
        searchTerm: feature.placeName,
        selectedHotelNameForQuery: isHotelSearch ? (feature.hotelName || feature.placeName) : null,
        mapboxFeatureBbox: feature.mapboxBbox ? feature.mapboxBbox.join(',') : null,
        rawMapboxFeature: feature,
        needsFresh: true
      };
      return {
        ...state,
        searchIntent: intent,
        lastSearchedMapBounds: intent.mapboxFeatureBbox,
        interactiveMapState: null,
        highlightType: 'idle',
        targetHotelId: null,
        hoveredHotelId: null,
        hoverSource: 'none',
        selectedHotelIdForModal: null,
        showSearchAreaButton: false
      };
    }
    case 'SEARCH_THIS_AREA': {
      const ims = state.interactiveMapState;
      if (!ims) return state;
      const { center, zoom, bounds } = ims;
      const intent = { ...state.searchIntent, location: { lat: center[1], lng: center[0] }, needsFresh: true };
      return {
        ...state,
        searchIntent: intent,
        lastSearchedMapBounds: bounds,
        mapCenter: center,
        mapZoom: zoom,
        showSearchAreaButton: false,
        interactiveMapState: null
      };
    }
    case 'API_RESPONSE_RECEIVED': {
      const { cityCenter, matchedHotel, searchedPoinLocation } = action.payload;
      // Determine highlight and focus based on intent
      const isHotel = state.searchIntent.searchType === 'hotel';
      if (isHotel && matchedHotel) {
        return {
          ...state,
          mapCenter: [matchedHotel.lng, matchedHotel.lat],
          mapZoom: ZOOM_LEVELS.HOTEL,
          highlightType: 'match_found',
          targetHotelId: matchedHotel.id
        };
      }
      if (isHotel && searchedPoinLocation) {
        return {
          ...state,
          mapCenter: [searchedPoinLocation.lng, searchedPoinLocation.lat],
          mapZoom: ZOOM_LEVELS.NO_MATCH_CITY_OVERVIEW,
          highlightType: 'poi_no_match',
          targetHotelId: null
        };
      }
      // City search fallback
      return {
        ...state,
        mapCenter: cityCenter || state.mapCenter,
        mapZoom: ZOOM_LEVELS.CITY,
        highlightType: 'city_overview',
        targetHotelId: null
      };
    }
    case 'MAP_MOVED_INTERACTIVELY': {
      const { center, zoom, bounds } = action.payload;
      const showButton = bounds !== state.lastSearchedMapBounds;
      return { ...state, mapCenter: center, mapZoom: zoom, showSearchAreaButton: showButton, interactiveMapState: { center, zoom, bounds } };
    }
    case 'HOTEL_HOVERED': {
      const { id, source } = action.payload;
      return {
        ...state,
        hoveredHotelId: id,
        hoverSource: source,
        highlightType: id ? 'hover_focus' : state.highlightType,
        targetHotelId: id || state.targetHotelId
      };
    }
    case 'HOTEL_SELECTED': {
      const { id, source } = action.payload;
      if (state.isMobile && source === 'list') {
        return {
          ...state,
          mapCenter: [state.mapCenter[0], state.mapCenter[1]],
          mapZoom: ZOOM_LEVELS.HOTEL,
          highlightType: 'match_found',
          targetHotelId: id,
          hoveredHotelId: id,
          hoverSource: 'none'
        };
      }
      // Desktop: open modal
      return { ...state, selectedHotelIdForModal: id };
    }
    case 'CLOSE_HOTEL_MODAL':
      return { ...state, selectedHotelIdForModal: null };
    case 'FILTERS_CHANGED':
      return { ...state, activeFilters: action.payload };
    default:
      return state;
  }
}

// Create context
const AppContext = React.createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Detect mobile layout
  useEffect(() => {
    const handleResize = () => dispatch({ type: 'SET_IS_MOBILE', payload: window.innerWidth < 768 });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
} 