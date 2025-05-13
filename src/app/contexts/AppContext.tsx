"use client";

import React, { ReactNode, useReducer, useContext, useEffect } from 'react';
import type { MapboxGeocodingFeature } from '@/app/components/search/CitySearchInput';
import type { ClientHotel } from '@/lib/pelotonAPI';
import type { Filters } from '@/app/components/filter/FilterChips';
import type { BottomSheetState } from '@/app/components/ui/BottomSheet';
import { determineApiQueryBbox } from '@/lib/utils';

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
  apiQueryBbox: string | null;
  originalSelectedFeature: MapboxGeocodingFeature | null;
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

  // State preservation for hover interactions
  preHoverHighlightType: HighlightType | null;
  preHoverTargetHotelId: number | null;
  preSidebarHoverMapCenter: [number, number] | null;
  preSidebarHoverMapZoom: number | null;

  initialSearchMatchTargetId: number | null;

  // Hotels data
  hotels: ClientHotel[];
  matchedHotel: ClientHotel | null;

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
  | { type: 'CITY_RESOLUTION_COMPLETE'; payload: { cityFeature: MapboxGeocodingFeature | null, originalSearchIntent: SearchIntent } }
  | { type: 'API_REQUEST_INITIATED' }
  | { type: 'API_RESPONSE_RECEIVED'; payload: {
      hotels: ClientHotel[];
      cityCenter: [number, number];
      cityBbox: string | null;
      matchedHotel?: ClientHotel | null;
      matchConfidence?: number | null;
      searchedPoinLocation?: { lat: number; lng: number; name: string } | null;
    } }
  | { type: 'MAP_MOVED_INTERACTIVELY'; payload: { center: [number, number]; zoom: number; bounds: string } }
  | { type: 'HOTEL_HOVERED'; payload: { id: number | null; source: InteractionSource; lat?: number; lng?: number } }
  | { type: 'HOTEL_SELECTED'; payload: { id: number; source: 'map' | 'list' } }
  | { type: 'CLOSE_HOTEL_MODAL' }
  | { type: 'FILTERS_CHANGED'; payload: Filters };

const initialIntent: SearchIntent = {
  location: null,
  searchType: 'none',
  searchTerm: null,
  selectedHotelNameForQuery: null,
  apiQueryBbox: null,
  originalSelectedFeature: null,
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
  preHoverHighlightType: null,
  preHoverTargetHotelId: null,
  preSidebarHoverMapCenter: null,
  preSidebarHoverMapZoom: null,
  initialSearchMatchTargetId: null,
  hotels: [],
  matchedHotel: null,
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
      console.log("[AppContext] LOCATION_SELECTED received feature:", JSON.stringify(feature, null, 2));

      const apiQueryBboxString = determineApiQueryBbox(feature);
      console.log("[AppContext] Determined apiQueryBbox:", apiQueryBboxString);

      const intentSearchType = feature.hotelName ? 'hotel' : 'city';
      console.log("[AppContext] Search type based on hotelName:", intentSearchType);

      const intent: SearchIntent = {
        location: { lat: feature.lat, lng: feature.lng },
        searchType: intentSearchType,
        searchTerm: feature.placeName,
        selectedHotelNameForQuery: feature.hotelName || null,
        apiQueryBbox: apiQueryBboxString,
        originalSelectedFeature: feature,
        needsFresh: true,
      };
      console.log("[AppContext] New searchIntent:", JSON.stringify(intent, null, 2));

      return {
        ...state,
        searchIntent: intent,
        lastSearchedMapBounds: apiQueryBboxString,
        interactiveMapState: null,
        highlightType: 'idle',
        targetHotelId: null,
        initialSearchMatchTargetId: null,
        hoveredHotelId: null,
        selectedHotelIdForModal: null,
        showSearchAreaButton: false,
      };
    }
    case 'SEARCH_THIS_AREA': {
      const ims = state.interactiveMapState;
      if (!ims) return state;
      console.log("[AppContext] Search this area triggered with bounds:", ims.bounds);
      const { center, zoom, bounds } = ims;
      const intent: SearchIntent = {
        location: { lat: center[1], lng: center[0] },
        searchType: 'city',
        searchTerm: 'Search this area results',
        selectedHotelNameForQuery: null,
        apiQueryBbox: bounds,
        originalSelectedFeature: null,
        needsFresh: true,
      };
      return {
        ...state,
        searchIntent: intent,
        lastSearchedMapBounds: bounds,
        mapCenter: center,
        mapZoom: zoom,
        showSearchAreaButton: false,
        interactiveMapState: null,
      };
    }
    case 'API_REQUEST_INITIATED':
      return {
        ...state,
        searchIntent: { ...state.searchIntent, needsFresh: false },
      };
    case 'API_RESPONSE_RECEIVED': {
      const { hotels, cityCenter, matchedHotel, searchedPoinLocation } = action.payload;
      const updatedIntent: SearchIntent = {
        ...state.searchIntent,
        needsFresh: false,
        originalSelectedFeature: null,
      };
      console.log("[AppContext] API_RESPONSE_RECEIVED, updatedIntent:", JSON.stringify(updatedIntent, null, 2));

      const updatedState = {
        ...state,
        hotels: hotels || [],
        matchedHotel: matchedHotel || null,
        searchIntent: updatedIntent
      };

      if (matchedHotel && state.searchIntent.searchType === 'hotel') {
        console.log("[AppContext] Matched hotel found, focusing map.");
        return {
          ...updatedState,
          mapCenter: [matchedHotel.lng, matchedHotel.lat],
          mapZoom: ZOOM_LEVELS.HOTEL,
          highlightType: 'match_found',
          targetHotelId: matchedHotel.id,
          initialSearchMatchTargetId: matchedHotel.id,
          hoveredHotelId: null,
        };
      } else if (searchedPoinLocation && state.searchIntent.searchType === 'hotel') {
        console.log("[AppContext] Hotel search, no match, focusing on searched POI location.");
        return {
          ...updatedState,
          mapCenter: [searchedPoinLocation.lng, searchedPoinLocation.lat],
          mapZoom: ZOOM_LEVELS.NO_MATCH_CITY_OVERVIEW,
          highlightType: 'poi_no_match',
          targetHotelId: null,
        };
      } else if (cityCenter) {
        console.log("[AppContext] City search or hotel search with no match, focusing on city center.");
        return {
          ...updatedState,
          mapCenter: cityCenter,
          mapZoom: ZOOM_LEVELS.CITY,
          highlightType: 'city_overview',
          targetHotelId: null,
        };
      }
      console.log("[AppContext] API_RESPONSE_RECEIVED, falling back to current state for map focus.");
      return updatedState;
    }
    case 'MAP_MOVED_INTERACTIVELY': {
      const { center, zoom, bounds } = action.payload;
      const showButton = bounds !== state.lastSearchedMapBounds;
      return { ...state, mapCenter: center, mapZoom: zoom, showSearchAreaButton: showButton, interactiveMapState: { center, zoom, bounds } };
    }
    case 'HOTEL_HOVERED': {
      const { id, source, lat, lng } = action.payload;
      const currentlyHoveredHotelIdBeforeUnhover = state.hoveredHotelId;

      if (id !== null) {
        const isNewHoverTarget = id !== state.hoveredHotelId;
        return {
          ...state,
          hoveredHotelId: id,
          hoverSource: source,
          highlightType: 'hover_focus',
          targetHotelId: id,
          preHoverHighlightType: isNewHoverTarget ? state.highlightType : state.preHoverHighlightType,
          preHoverTargetHotelId: isNewHoverTarget ? state.targetHotelId : state.preHoverTargetHotelId,
          mapCenter: (source === 'sidebar' && lat !== undefined && lng !== undefined) ? [lng, lat] : state.mapCenter,
          mapZoom: (source === 'sidebar' && lat !== undefined && lng !== undefined) ? ZOOM_LEVELS.HOTEL : state.mapZoom,
          preSidebarHoverMapCenter: (source === 'sidebar' && lat !== undefined && lng !== undefined && isNewHoverTarget) ? [...state.mapCenter] : state.preSidebarHoverMapCenter,
          preSidebarHoverMapZoom: (source === 'sidebar' && lat !== undefined && lng !== undefined && isNewHoverTarget) ? state.mapZoom : state.preSidebarHoverMapZoom,
        };
      } 
      else {
        let nextHighlightType = 'idle' as HighlightType;
        let nextTargetHotelId = null as number | null;
        let nextInitialSearchMatchTargetId = state.initialSearchMatchTargetId;
        let nextMapCenter = state.mapCenter;
        let nextMapZoom = state.mapZoom;

        const unhoveringFromDifferentThanInitialSearch = 
          state.initialSearchMatchTargetId !== null &&
          currentlyHoveredHotelIdBeforeUnhover !== null &&
          currentlyHoveredHotelIdBeforeUnhover !== state.initialSearchMatchTargetId;

        if (unhoveringFromDifferentThanInitialSearch) {
          nextHighlightType = 'idle';
          nextTargetHotelId = null;
          nextInitialSearchMatchTargetId = null;
          if (state.hoverSource === 'sidebar' && state.preSidebarHoverMapCenter) {
            nextMapCenter = state.preSidebarHoverMapCenter;
            nextMapZoom = state.preSidebarHoverMapZoom || state.mapZoom;
          } else {
            if(state.searchIntent.location && state.searchIntent.searchType === 'city'){
                nextMapCenter = [state.searchIntent.location.lng, state.searchIntent.location.lat];
                nextMapZoom = ZOOM_LEVELS.CITY;
            }
          }
        } else if (state.selectedHotelIdForModal && currentlyHoveredHotelIdBeforeUnhover !== state.selectedHotelIdForModal) {
          nextHighlightType = 'match_found';
          nextTargetHotelId = state.selectedHotelIdForModal;
          nextInitialSearchMatchTargetId = state.initialSearchMatchTargetId;
        } else if (state.preHoverHighlightType === 'match_found' && state.preHoverTargetHotelId !== null) {
          nextHighlightType = 'match_found';
          nextTargetHotelId = state.preHoverTargetHotelId;
          nextInitialSearchMatchTargetId = state.initialSearchMatchTargetId;
          if(nextTargetHotelId){
          }
        } else {
          nextHighlightType = state.preHoverHighlightType || 'idle';
          nextTargetHotelId = state.preHoverTargetHotelId;
          if (state.hoverSource === 'sidebar' && state.preSidebarHoverMapCenter) {
            nextMapCenter = state.preSidebarHoverMapCenter;
            nextMapZoom = state.preSidebarHoverMapZoom || state.mapZoom;
          }
        }

        return {
          ...state,
          hoveredHotelId: null,
          hoverSource: 'none',
          highlightType: nextHighlightType,
          targetHotelId: nextTargetHotelId,
          initialSearchMatchTargetId: nextInitialSearchMatchTargetId,
          mapCenter: nextMapCenter,
          mapZoom: nextMapZoom,
          preHoverHighlightType: null, 
          preHoverTargetHotelId: null,
          preSidebarHoverMapCenter: null, 
          preSidebarHoverMapZoom: null, 
        };
      }
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