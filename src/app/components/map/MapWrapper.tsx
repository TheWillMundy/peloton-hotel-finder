"use client";

import React, { useCallback, useEffect, useRef, memo, useState } from 'react';
import { useAppContext } from '@/app/contexts/AppContext';
import MapboxMap from '@/app/components/map/MapboxMap';
import type { ClientHotel } from '@/lib/pelotonAPI';
import { useDebouncedCallback } from '@/app/hooks/useDebouncedCallback';

interface MapWrapperProps {
  hotels: ClientHotel[];
}

const MapWrapper: React.FC<MapWrapperProps> = ({ hotels }) => {
  const { state, dispatch } = useAppContext();
  const {
    mapCenter,
    mapZoom,
    highlightType,
    targetHotelId,
    hoveredHotelId,
    isMobile,
    isPanelOpen,
    bottomSheetState
  } = state;

  // Constants for padding calculation
  const DESKTOP_SIDEBAR_WIDTH_RATIO = 1 / 3;
  const DESKTOP_SIDEBAR_MARGIN_PX = 16;
  const MOBILE_SEARCH_BAR_HEIGHT = 60;
  const PEEK_SHEET_HEIGHT_VH = 25;
  const FULL_SHEET_HEIGHT_VH = 85;
  const SHEET_HANDLE_HEIGHT_PX = 40;

  // Initialize padding state with default values
  const [padding, setPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });

  // Compute padding for mapbox based on UI state - MOVED TO useEffect
  useEffect(() => {
    // Ensure window is defined (runs only on client)
    if (typeof window !== 'undefined') {
      let newPadding;
      if (isMobile) {
        let bottomPx = SHEET_HANDLE_HEIGHT_PX;
        if (bottomSheetState === 'peek') {
          bottomPx = window.innerHeight * (PEEK_SHEET_HEIGHT_VH / 100);
        } else if (bottomSheetState === 'full') {
          bottomPx = window.innerHeight * (FULL_SHEET_HEIGHT_VH / 100);
        }
        newPadding = { top: MOBILE_SEARCH_BAR_HEIGHT, right: 0, bottom: bottomPx, left: 0 };
      } else {
        const leftPx = isPanelOpen
          ? window.innerWidth * DESKTOP_SIDEBAR_WIDTH_RATIO + DESKTOP_SIDEBAR_MARGIN_PX
          : 0;
        newPadding = { top: 0, right: 0, bottom: 0, left: leftPx };
      }
      setPadding(newPadding);
    }
    // Dependencies for recalculation
  }, [isMobile, isPanelOpen, bottomSheetState, DESKTOP_SIDEBAR_WIDTH_RATIO]);

  const mapRef = useRef<any>(null);

  // Debounced dispatch for map move events to reduce update frequency
  const debouncedMapMoveDispatch = useDebouncedCallback(
    (payload: { center: [number, number]; zoom: number; bounds: string }) => {
      dispatch({ type: 'MAP_MOVED_INTERACTIVELY', payload });
    },
    500
  );

  const handleMarkerClick = useCallback((hotel: ClientHotel) => {
    dispatch({ type: 'HOTEL_SELECTED', payload: { id: hotel.id, source: 'map' } });
  }, [dispatch]);

  const handleMarkerHover = useCallback((id: number | null) => {
    dispatch({ type: 'HOTEL_HOVERED', payload: { id, source: 'map' } });
  }, [dispatch]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const onMoveEnd = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const boundsArr = map.getBounds().toArray().flat();
      const bounds = boundsArr.join(',');
      debouncedMapMoveDispatch({ center: [center.lng, center.lat], zoom, bounds });
    };
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
      debouncedMapMoveDispatch.cancel();
    };
  }, [debouncedMapMoveDispatch]);

  return (
    <div className="mapbox-map-container" style={{ width: '100%', height: '100%' }}>
      <MapboxMap
        hotels={hotels}
        externalMapRef={mapRef}
        isMobile={isMobile}
        onMarkerClick={handleMarkerClick}
        onMarkerHover={handleMarkerHover}
        center={mapCenter}
        zoom={mapZoom}
        padding={padding}
        highlightHotelId={targetHotelId}
        hoveredHotelId={hoveredHotelId}
        highlightType={highlightType}
      />
    </div>
  );
};

export default memo(MapWrapper); 