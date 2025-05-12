"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import Map, { Marker, MapRef, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ClientHotel } from '@/lib/pelotonAPI';
import { useSearch, ZOOM_LEVELS } from '@/app/contexts/SearchContext';
import { useUIInteraction } from '@/app/contexts/UIInteractionContext';
import HotelMarker from './HotelMarker';
import SearchResultMarker from './SearchResultMarker';
import MapboxCustomStyles from './MapStyles';

// Interface for the consolidated map focus props
interface MapFocusProps {
  center: [number, number]; // [lng, lat]
  zoom: number; 
  highlightType: 'idle' | 'city_overview' | 'match_found' | 'poi_no_match' | 'hover_focus';
  highlightHotelId?: number | null; // For 'match_found' and 'hover_focus'
  noMatchSearchTerm?: string | null; // For 'poi_no_match' (name of the POI searched)
}

interface MapboxMapProps {
  hotels: ClientHotel[];
  externalMapRef?: React.MutableRefObject<mapboxgl.Map | null>; // For parent component to control map
  onMarkerClick?: (hotel: ClientHotel) => void;
  onMapLoad?: () => void;
  isMobile?: boolean; // Suppress popups on mobile
  onMarkerHover?: (hotelId: number | null, hotelCoords?: { lng: number, lat: number }) => void;
  mapReady?: boolean; // New prop from page.tsx
  mapFocusProps: MapFocusProps; // Consolidated props replacing individual location/zoom props
}

const MapboxMap: React.FC<MapboxMapProps> = ({ 
  hotels, 
  externalMapRef, 
  onMarkerClick, 
  onMapLoad, 
  isMobile = false, 
  onMarkerHover,
  mapReady = true,
  mapFocusProps
}) => {
  // Refs
  const internalMapRef = useRef<MapRef>(null);
  const isMountedRef = useRef(true);
  const lastCenterRef = useRef<[number, number] | null>(null);
  
  // Contexts
  const { searchContextState } = useSearch();
  const { zoom: contextZoom } = searchContextState;
  const { uiState, setActiveHotel, clearActiveHotel } = useUIInteraction();

  // Extract values from mapFocusProps for easier access
  const { center: mapCenter, zoom: mapZoom, highlightType, highlightHotelId } = mapFocusProps;

  // Clear any pending operations on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle map focus changes (flyTo)
  useEffect(() => {
    if (!internalMapRef.current || !mapReady) return;
    
    const shouldSkipFlyTo = 
      highlightType === 'hover_focus' && 
      lastCenterRef.current && 
      lastCenterRef.current[0].toFixed(6) === mapCenter[0].toFixed(6) && 
      lastCenterRef.current[1].toFixed(6) === mapCenter[1].toFixed(6);
    
    if (shouldSkipFlyTo) {
      return;
    }
    
    // Store the last location change time to avoid competing animations
    const mapInstance = internalMapRef.current;
    (mapInstance as any)._lastLocationChangeTime = performance.now();
    
    // Use native flyTo method
    mapInstance.flyTo({
      center: mapCenter,
      zoom: mapZoom,
      essential: true,
      duration: 1000,
      // Add padding options for mobile to position markers better
      ...((isMobile && highlightType === 'hover_focus') ? {
        padding: { top: 25, bottom: 0, left: 0, right: 0 }
      } : {})
    });
    
    // Update the last center reference
    lastCenterRef.current = mapCenter;
  }, [mapCenter, mapZoom, highlightType, mapReady, isMobile]);

  // Handle zoom changes from context
  useEffect(() => {
    if (!internalMapRef.current || !mapReady || internalMapRef.current.getZoom() === contextZoom) return;
    
    const mapInstance = internalMapRef.current;
    const lastLocationChangeTime = (mapInstance as any)._lastLocationChangeTime || 0;
    const timeSinceLocationChange = performance.now() - lastLocationChangeTime;
    
    // Don't compete with recent location changes
    if (lastLocationChangeTime && timeSinceLocationChange < 1200) {
      return;
    }
    
    // Use easeTo for smoother zoom transitions
    mapInstance.easeTo({ 
      zoom: contextZoom, 
      duration: 500 
    });
  }, [contextZoom, mapReady]);

  // Handlers for marker interactions
  const handleMarkerClick = useCallback((hotel: ClientHotel) => {
    if (isMobile) {
      setActiveHotel(hotel.id, 'map_hover');
    }
    onMarkerClick?.(hotel);
  }, [isMobile, onMarkerClick, setActiveHotel]);

  const handleMarkerMouseEnter = useCallback((hotelId: number, hotelCoords: {lng: number, lat: number}) => {
    // Update the active hotel in the UIInteractionContext immediately
    setActiveHotel(hotelId, 'map_hover');
    onMarkerHover?.(hotelId, hotelCoords);
  }, [setActiveHotel, onMarkerHover]);

  const handleMarkerMouseLeave = useCallback((hotelId: number) => {
    // Only clear active hotel if it was set by map hover and sidebar hasn't taken over
    if (uiState.activeHotelId === hotelId && uiState.interactionSource === 'map_hover') {
      clearActiveHotel();
      onMarkerHover?.(null);
    }
  }, [uiState.activeHotelId, uiState.interactionSource, clearActiveHotel, onMarkerHover]);

  const handleMapMouseLeave = useCallback(() => {
    // Check if the active hotel was activated by map hover
    if (uiState.activeHotelId !== null && uiState.interactionSource === 'map_hover') {
      clearActiveHotel();
      onMarkerHover?.(null);
    }
  }, [uiState.activeHotelId, uiState.interactionSource, clearActiveHotel, onMarkerHover]);

  // Handle map load
  const handleMapLoad = useCallback((event: { target: mapboxgl.Map }) => {
    if (externalMapRef) {
      externalMapRef.current = event.target;
    }
    // Store initial center
    lastCenterRef.current = mapCenter;
    if (onMapLoad) onMapLoad();
  }, [externalMapRef, onMapLoad, mapCenter]);

  // Handle view state change (e.g., from user interaction)
  const handleViewStateChange = useCallback((evt: ViewStateChangeEvent) => {
    // Update lastCenterRef when the user moves the map
    const { longitude, latitude } = evt.viewState;
    lastCenterRef.current = [longitude, latitude];
  }, []);

  return (
    <div className="mapbox-map-container" style={{ width: '100%', height: '100%' }}>
      <MapboxCustomStyles />
      <Map
        ref={internalMapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: mapCenter[0],
          latitude: mapCenter[1],
          zoom: mapZoom || ZOOM_LEVELS.COUNTRY
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onLoad={handleMapLoad}
        onMouseLeave={handleMapMouseLeave}
        onMove={handleViewStateChange}
      >
        {mapReady && hotels.map(hotel => {
          if (typeof hotel.lng !== 'number' || typeof hotel.lat !== 'number') return null;

          // Determine if this marker is the one that the map is specifically focused on due to a search match or hover action.
          const isExplicitlyFocusedByMapState = (
              highlightType === 'match_found' || highlightType === 'hover_focus'
            ) && hotel.id === highlightHotelId;

          // Determine if this marker is active based on UI interaction (map hover or sidebar hover)
          const isActiveByUIHover = 
            hotel.id === uiState.activeHotelId && 
            (uiState.interactionSource === 'map_hover' || uiState.interactionSource === 'sidebar_hover');

          const isFocused = isExplicitlyFocusedByMapState || isActiveByUIHover;

          // A marker is dimmed if *any* marker is considered active/focused, but this one isn't.
          const isAnyHotelFocused = 
            uiState.activeHotelId !== null || 
            ((highlightType === 'match_found' || highlightType === 'hover_focus') && highlightHotelId !== null);

          const isDimmed = isAnyHotelFocused && !isFocused;

          return (
            <Marker
              key={hotel.id}
              longitude={hotel.lng}
              latitude={hotel.lat}
              style={{ zIndex: isFocused ? 100 : 10 }}
            >
              <HotelMarker
                hotel={hotel}
                isMobile={isMobile}
                onClick={() => handleMarkerClick(hotel)}
                onMouseEnter={() => handleMarkerMouseEnter(hotel.id, { lng: hotel.lng, lat: hotel.lat })}
                onMouseLeave={() => handleMarkerMouseLeave(hotel.id)}
                isFocused={isFocused}
                isDimmed={isDimmed}
              />
            </Marker>
          );
        })}

        {mapReady && highlightType === 'poi_no_match' && mapCenter && (
          <Marker
            longitude={mapCenter[0]}
            latitude={mapCenter[1]}
            key="search-result-marker"
            style={{ zIndex: 200 }}
          >
            <SearchResultMarker />
          </Marker>
        )}
      </Map>
    </div>
  );
};

export default MapboxMap; 