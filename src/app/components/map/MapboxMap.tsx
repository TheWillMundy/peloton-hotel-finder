"use client";

import React, { useEffect, useRef, useCallback, memo } from 'react';
import Map, { Marker, MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ClientHotel } from '@/lib/pelotonAPI';
import { ZOOM_LEVELS } from '@/app/contexts/AppContext';
import HotelMarker from '@/app/components/map/HotelMarker';
import SearchResultMarker from '@/app/components/map/SearchResultMarker';
import MapboxCustomStyles from '@/app/components/map/MapStyles';
import type { HighlightType } from '@/app/contexts/AppContext';

interface MapboxMapProps {
  hotels: ClientHotel[];
  externalMapRef?: React.MutableRefObject<MapRef | null>;
  isMobile?: boolean;
  onMarkerClick?: (hotel: ClientHotel) => void;
  onMarkerHover?: (hotelId: number | null) => void;
  center: [number, number];
  zoom: number;
  padding: { top: number; right: number; bottom: number; left: number };
  highlightHotelId: number | null;
  hoveredHotelId: number | null;
  highlightType: HighlightType;
}

const MapboxMap: React.FC<MapboxMapProps> = ({
  hotels,
  externalMapRef,
  isMobile = false,
  onMarkerClick,
  onMarkerHover,
  center,
  zoom,
  padding,
  highlightHotelId,
  hoveredHotelId,
  highlightType,
}) => {
  // Refs
  const internalMapRef = useRef<MapRef>(null);
  const lastCenterRef = useRef<[number, number] | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  const lastPaddingRef = useRef<{ top: number; right: number; bottom: number; left: number } | null>(null);

  // Flag to track programmatic movement
  const isProgrammaticMoveRef = useRef(false);

  // Forward ref to parent
  const handleMapRef = useCallback((ref: MapRef | null) => {
    internalMapRef.current = ref;
    if (externalMapRef) {
      externalMapRef.current = ref;
    }
  }, [externalMapRef]);

  // Handle map focus changes (flyTo) when props change
  useEffect(() => {
    const mapRefInstance = internalMapRef.current;
    if (!mapRefInstance) return;
    const mapInstance = mapRefInstance.getMap();
    const COORD_TOLERANCE = 0.000001;
    const centerChanged =
      !lastCenterRef.current ||
      Math.abs(lastCenterRef.current[0] - center[0]) > COORD_TOLERANCE ||
      Math.abs(lastCenterRef.current[1] - center[1]) > COORD_TOLERANCE;
    const zoomChanged = zoom !== lastZoomRef.current;
    const paddingChanged =
      !lastPaddingRef.current ||
      lastPaddingRef.current.top !== padding.top ||
      lastPaddingRef.current.right !== padding.right ||
      lastPaddingRef.current.bottom !== padding.bottom ||
      lastPaddingRef.current.left !== padding.left;

    if (centerChanged || zoomChanged || paddingChanged) {
      isProgrammaticMoveRef.current = true;
      mapInstance.flyTo({ center, zoom, padding, duration: 1000, essential: true });
      lastCenterRef.current = center;
      lastZoomRef.current = zoom;
      lastPaddingRef.current = padding;
      setTimeout(() => { isProgrammaticMoveRef.current = false; }, 1200);
    }
  }, [center, zoom, padding]);

  // Handlers for marker interactions
  const handleMarkerClick = useCallback((hotel: ClientHotel) => {
    onMarkerClick?.(hotel);
  }, [onMarkerClick]);

  const handleMarkerMouseEnter = useCallback((hotelId: number) => {
    onMarkerHover?.(hotelId);
  }, [onMarkerHover]);

  const handleMarkerMouseLeave = useCallback(() => {
    onMarkerHover?.(null);
  }, [onMarkerHover]);

  return (
    <div className="mapbox-map-container" style={{ width: '100%', height: '100%' }}>
      <MapboxCustomStyles />
      <Map
        ref={handleMapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: center[0],
          latitude: center[1],
          zoom: zoom || ZOOM_LEVELS.COUNTRY
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
      >
        {hotels.map(hotel => {
          if (typeof hotel.lng !== 'number' || typeof hotel.lat !== 'number') return null;

          // Determine if this marker is the one that the map is specifically focused on due to a search match or hover action.
          const isExplicitlyFocusedByMapState = (
              highlightType === 'match_found' || highlightType === 'hover_focus'
            ) && hotel.id === highlightHotelId;

          // Determine if this marker is active based on UI interaction (map hover or sidebar hover)
          const isActiveByUIHover = 
            hotel.id === hoveredHotelId;

          const isFocused = isExplicitlyFocusedByMapState || isActiveByUIHover;

          // A marker is dimmed if *any* marker is considered active/focused, but this one isn't.
          const isAnyHotelFocused = 
            hoveredHotelId !== null;

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
                onMouseEnter={() => handleMarkerMouseEnter(hotel.id)}
                onMouseLeave={handleMarkerMouseLeave}
                isFocused={isFocused}
                isDimmed={isDimmed}
              />
            </Marker>
          );
        })}

        {highlightType === 'poi_no_match' && (
          <Marker
            longitude={center[0]}
            latitude={center[1]}
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

export default memo(MapboxMap); 