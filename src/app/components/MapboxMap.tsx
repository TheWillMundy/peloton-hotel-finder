"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl, { Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ClientHotel } from '@/lib/pelotonAPI';
import { useSearch, ZOOM_LEVELS } from '@/app/contexts/SearchContext';
import { useUIInteraction } from '@/app/contexts/UIInteractionContext';

// New interface for the consolidated map focus props
interface MapFocusProps {
  center: [number, number]; // [lng, lat]
  zoom: number; 
  highlightType: 'idle' | 'city_overview' | 'match_found' | 'poi_no_match' | 'hover_focus';
  highlightHotelId?: number | null; // For 'match_found' and 'hover_focus'
  noMatchSearchTerm?: string | null; // For 'poi_no_match' (name of the POI searched)
}

interface MapboxMapProps {
  hotels: ClientHotel[];
  mapRef?: React.MutableRefObject<mapboxgl.Map | null>; // For parent component to control map
  onMarkerClick?: (hotel: ClientHotel) => void;
  onMapLoad?: () => void; // New callback prop
  isMobile?: boolean; // Suppress popups on mobile
  onMarkerHover?: (hotelId: number | null, hotelCoords?: { lng: number, lat: number }) => void; // Updated to include coords
  mapReady?: boolean; // New prop from page.tsx
  mapFocusProps: MapFocusProps; // New consolidated props replacing the individual location/zoom props
}

// Inject custom popup styles (from reference project)
const customPopupStylesId = 'mapbox-custom-popup-styles';
if (typeof window !== 'undefined' && !document.getElementById(customPopupStylesId)) {
  const styles = document.createElement('style');
  styles.id = customPopupStylesId;
  styles.textContent = `
    .custom-map-popup .mapboxgl-popup-content {
      border-radius: 1rem !important;
      padding: 0.75rem 1rem !important;
      background: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(8px) !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      min-width: 180px !important;
      color: #333; // Example text color, adjust as needed
    }
    .custom-map-popup {
      z-index: 10 !important; // Ensure popups are above markers
    }
    .custom-map-popup .mapboxgl-popup-close-button {
      display: none !important;
    }
    .custom-map-popup .mapboxgl-popup-tip {
      display: none !important;
    }
  `;
  document.head.appendChild(styles);
}

const MapboxMap: React.FC<MapboxMapProps> = ({ 
  hotels, 
  mapRef: externalMapRef, 
  onMarkerClick, 
  onMapLoad, 
  isMobile, 
  onMarkerHover,
  mapReady,
  mapFocusProps
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const internalMapRef = useRef<mapboxgl.Map | null>(null);
  const map = externalMapRef || internalMapRef;
  const markersRef = useRef<Marker[]>([]);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  // Track the currently hovered hotel ID directly in a ref for immediate feedback
  const hoveredHotelIdRef = useRef<number | null>(null);
  // Use a timeout ref to help with debouncing
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track if the component is still mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);
  
  const { searchContextState } = useSearch();
  const { zoom: contextZoom } = searchContextState;
  const { uiState, setActiveHotel, clearActiveHotel } = useUIInteraction();

  // State to signal that markers need to be redrawn after map movement and style load
  const [needsMarkerRender, setNeedsMarkerRender] = useState(0); // Increment to trigger effect
  
  // Extract values from mapFocusProps for easier access
  const { center: mapCenter, zoom: mapZoom, highlightType, highlightHotelId } = mapFocusProps;

  // Clear any pending timeouts on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Create a marker element with special hover handling
  const createMarkerElement = useCallback((
    hotel: ClientHotel,
    isMobileCreate?: boolean,
    onMarkerClickCreate?: (hotel: ClientHotel) => void
  ): HTMLDivElement => {
    const inner = document.createElement('div');
    inner.style.width = "40px";
    inner.style.height = "40px";
    inner.style.borderRadius = "50%";
    inner.style.cursor = "pointer";
    inner.style.display = "flex";
    inner.style.alignItems = "center";
    inner.style.justifyContent = "center";
    inner.style.color = "white";
    inner.style.fontWeight = "bold";
    inner.style.fontSize = "15px";
    
    // Default appearance
    inner.style.boxShadow = "0 3px 6px rgba(0,0,0,0.15)";
    inner.style.border = "2px solid white";
    
    // Apply transitions for smooth visual changes
    inner.style.transition = "transform 0.25s ease-out, box-shadow 0.25s ease-out, opacity 0.3s ease-in-out"; 

    if (hotel.total_bikes && hotel.total_bikes > 0) {
      if (hotel.in_room) {
        inner.style.backgroundColor = "#4A90E2";
        inner.style.borderColor = "rgba(74, 144, 226, 0.5)";
      } else if (hotel.total_bikes >= 3) {
        inner.style.backgroundColor = "#58B794";
        inner.style.borderColor = "rgba(88, 183, 148, 0.5)";
      } else {
        inner.style.backgroundColor = "#F5BD41";
        inner.style.borderColor = "rgba(245, 189, 65, 0.5)";
      }
      inner.innerText = String(hotel.total_bikes);
    } else {
      inner.style.backgroundColor = "#9AA1B1";
      inner.style.borderColor = "rgba(154, 161, 177, 0.5)";
      inner.innerText = "P";
    }

    const wrapper = document.createElement('div');
    wrapper.dataset.hotelId = hotel.id.toString();
    wrapper.appendChild(inner);

    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isMobileCreate) {
        setActiveHotel(hotel.id, 'map_hover');
      }
      if (onMarkerClickCreate) onMarkerClickCreate(hotel);
    });

    return wrapper;
  }, [setActiveHotel]);

  // Handle marker hover styling directly for better performance 
  const updateMarkerStyles = useCallback(() => {
    if (!markersRef.current.length) return;
    
    markersRef.current.forEach(marker => {
      const element = marker.getElement();
      const hotelIdMarker = parseInt(element.dataset.hotelId || '0');
      const inner = element.querySelector('div') as HTMLDivElement;
      if (!inner) return;

      // Always start from a non-scaled transform for recalculation
      const baseTransform = (element.style.transform || '').replace(/ scale\([^)]+\)/, '').trim();
      element.style.transform = baseTransform; // Apply base first
      
      const isDirectlyHovered = hotelIdMarker === hoveredHotelIdRef.current;
      const isMatchedFromSearch = highlightType === 'match_found' && hotelIdMarker === highlightHotelId;
      const isActiveBySidebar = !isDirectlyHovered && !isMatchedFromSearch && 
                               hotelIdMarker === uiState.activeHotelId && 
                               uiState.interactionSource === 'sidebar_hover';
      
      const shouldBeActive = isDirectlyHovered || isMatchedFromSearch || isActiveBySidebar;

      if (shouldBeActive) {
        // Apply scale only on desktop
        if (!isMobile) {
            element.style.transform = `${baseTransform} scale(1.2)`;
        }
        element.style.zIndex = '10';
        inner.style.boxShadow = '0 5px 10px rgba(0,0,0,0.4)';
        inner.style.opacity = '1';
      } else {
        // No specific scale for inactive, already reset by baseTransform application
        element.style.zIndex = '1';
        inner.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)';
        inner.style.opacity = ((hoveredHotelIdRef.current !== null || 
                             uiState.activeHotelId !== null || 
                             (highlightType === 'match_found' && highlightHotelId !== null)) && 
                             !isMobile) 
          ? '0.65' 
          : '1';
      }
    });
  }, [isMobile, uiState.activeHotelId, uiState.interactionSource, highlightType, highlightHotelId]);

  // Setup mapbox and initial render
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    
    const mbAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mbAccessToken) {
      console.error("Mapbox access token is not set!");
      return;
    }
    
    mapboxgl.accessToken = mbAccessToken;
    
    const initialCenter: [number, number] = mapCenter || [-98.5795, 39.8283];
    const initialZoom = mapZoom || ZOOM_LEVELS.COUNTRY;

    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initialCenter,
      zoom: initialZoom,
    });

    newMap.on('load', () => {
      map.current = newMap;
      if (onMapLoad) onMapLoad();
      setNeedsMarkerRender(prev => prev + 1);
    });

    return () => {
      newMap.remove();
      if (map.current === newMap) map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map-level event detection for markers
  useEffect(() => {
    if (!map.current || !mapReady || isMobile) return;

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      let foundMarkerHotelId: number | null = null;
      markersRef.current.forEach(marker => {
        const markerElement = marker.getElement();
        const markerRect = markerElement.getBoundingClientRect();
        if (
          e.originalEvent.clientX >= markerRect.left &&
          e.originalEvent.clientX <= markerRect.right &&
          e.originalEvent.clientY >= markerRect.top &&
          e.originalEvent.clientY <= markerRect.bottom
        ) {
          foundMarkerHotelId = parseInt(markerElement.dataset.hotelId || '0');
        }
      });
      
      if (foundMarkerHotelId !== null && foundMarkerHotelId !== hoveredHotelIdRef.current) {
        hoveredHotelIdRef.current = foundMarkerHotelId;
        updateMarkerStyles();
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && foundMarkerHotelId === hoveredHotelIdRef.current && foundMarkerHotelId !== null) {
            setActiveHotel(foundMarkerHotelId, 'map_hover');
            if (onMarkerHover) {
              const marker = markersRef.current.find(m => parseInt(m.getElement().dataset.hotelId || '0') === foundMarkerHotelId);
              if (marker) {
                const { lng, lat } = marker.getLngLat();
                onMarkerHover(foundMarkerHotelId, { lng, lat });
              } else {
                onMarkerHover(foundMarkerHotelId);
              }
            }
          }
        }, 0);
      } 
      else if (foundMarkerHotelId === null && hoveredHotelIdRef.current !== null) {
        // Mouse left a marker previously hovered locally
        const previouslyHoveredId = hoveredHotelIdRef.current;
        hoveredHotelIdRef.current = null;
        updateMarkerStyles();
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && hoveredHotelIdRef.current === null && uiState.activeHotelId === previouslyHoveredId) {
             // Check if sidebar has taken over, if not, then clear.
             if(uiState.interactionSource !== 'sidebar_hover') {
                clearActiveHotel();
             }
             if (onMarkerHover) onMarkerHover(null);
          }
        }, 0); // Slightly longer delay to allow sidebar to pick up hover
      }
    };
    
    const handleMouseLeaveMap = () => {
      // This handles mouse leaving the entire map viewport
      if (hoveredHotelIdRef.current !== null) {
        const previouslyHoveredId = hoveredHotelIdRef.current;
        hoveredHotelIdRef.current = null;
        updateMarkerStyles();
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && hoveredHotelIdRef.current === null && uiState.activeHotelId === previouslyHoveredId) {
            if(uiState.interactionSource !== 'sidebar_hover') {
                clearActiveHotel();
            }
            if (onMarkerHover) onMarkerHover(null);
          }
        }, 0); // Longer delay as mouse is leaving map area
      }
    };
    
    map.current.on('mousemove', handleMouseMove);
    map.current.on('mouseout', handleMouseLeaveMap); // Changed name for clarity
    
    return () => {
      if (map.current) {
        map.current.off('mousemove', handleMouseMove);
        map.current.off('mouseout', handleMouseLeaveMap);
      }
    };
  // Dependencies: uiState parts are needed for the clearing logic check
  }, [map, mapReady, isMobile, updateMarkerStyles, setActiveHotel, clearActiveHotel, uiState.activeHotelId, uiState.interactionSource, onMarkerHover]);

  // Handle map focus changes (flyTo, etc.)
  useEffect(() => {
    if (!map.current || !mapReady) return;
    
    const shouldSkipFlyTo = 
      highlightType === 'hover_focus' && 
      map.current.getCenter().lng.toFixed(6) === mapCenter[0].toFixed(6) && 
      map.current.getCenter().lat.toFixed(6) === mapCenter[1].toFixed(6);
      
    if (shouldSkipFlyTo) {
      return;
    }
    
    if (map.current) {
      (map.current as any)._lastLocationChangeTime = performance.now(); 
    }

    map.current.flyTo({
      center: mapCenter,
      zoom: mapZoom,
      essential: true,
      duration: 1000,
    });

    const handleMapIdle = () => {
      if (map.current) { 
         setNeedsMarkerRender(prev => prev + 1);
      }
    };

    const currentMapInstance = map.current;
    currentMapInstance.once('idle', handleMapIdle);
    
    return () => {
      currentMapInstance?.off('idle', handleMapIdle);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapCenter, mapZoom, highlightType, mapReady]);

  // Handle zoom changes
  useEffect(() => {
    if (!map.current || !mapReady || map.current.getZoom() === contextZoom) return;
    
    const mapInstance = map.current as any;
    const lastLocationChangeTime = mapInstance._lastLocationChangeTime || 0;
    const timeSinceLocationChange = performance.now() - lastLocationChangeTime;
    
    if (lastLocationChangeTime && timeSinceLocationChange < 1200) { 
        return;
    }

    map.current.easeTo({ zoom: contextZoom, duration: 500 });
  }, [contextZoom, mapReady, map]);

  // Render markers
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !mapReady || !hotels) {
        if (!hotels || hotels.length === 0) {
            setNeedsSearchMarkerRender(prev => prev + 1);
            setNeedsMatchedHighlightRender(prev => prev + 1);
        }
        return;
    }
    
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    if (hotels.length === 0) {
      setNeedsSearchMarkerRender(prev => prev + 1); 
      setNeedsMatchedHighlightRender(prev => prev + 1);
      return;
    }

    hotels.forEach(hotel => {
      if (typeof hotel.lng !== 'number' || typeof hotel.lat !== 'number') { 
        return; 
      }
      
      const markerElement = createMarkerElement(hotel, isMobile, onMarkerClick);
      
      try {
        const marker = new mapboxgl.Marker({ element: markerElement })
          .setLngLat([hotel.lng, hotel.lat])
          .addTo(map.current!); 
        markersRef.current.push(marker);
      } catch (e) {
        console.error('[MapboxMap] Error adding marker for hotel:', hotel.id, e);
      }
    });
    
    setNeedsSearchMarkerRender(prev => prev + 1);
    setNeedsMatchedHighlightRender(prev => prev + 1);
    
    // Update marker styles after they're all created
    updateMarkerStyles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMarkerRender, hotels, mapReady, isMobile, onMarkerClick, createMarkerElement, updateMarkerStyles]);

  // Respond to uiState activeHotelId changes for sidebar hover
  useEffect(() => {
    // Update visual styles when uiState changes (e.g., sidebar hover)
    updateMarkerStyles();
  }, [uiState.activeHotelId, uiState.interactionSource, updateMarkerStyles]);

  // Handle search marker
  const [needsSearchMarkerRender, setNeedsSearchMarkerRender] = useState(0);
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !mapReady) return;
    
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
    
    if (highlightType === 'poi_no_match') { 
      const markerElement = createSearchResultMarker();
      searchMarkerRef.current = new mapboxgl.Marker({ element: markerElement })
        .setLngLat(mapCenter)
        .addTo(map.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSearchMarkerRender, mapCenter, highlightType, mapReady]);

  // Handle search marker and initial match highlighting
  const [needsMatchedHighlightRender, setNeedsMatchedHighlightRender] = useState(0);
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || markersRef.current.length === 0) return;
    
    // Add special highlight styling for matched hotel, but without green border
    if (highlightType === 'match_found' && highlightHotelId) {
      markersRef.current.forEach(marker => {
        const element = marker.getElement();
        const hotelIdMarker = parseInt(element.dataset.hotelId || '0'); 
        const inner = element.querySelector('div') as HTMLDivElement;
        
        if (!inner) return;
        
        if (hotelIdMarker === highlightHotelId) {
          const existingTransform = element.style.transform || '';
          const mapboxTransform = existingTransform.replace(/ scale\([^)]+\)/, '').trim();
          element.style.transform = `${mapboxTransform} scale(1.2)`;
          element.style.zIndex = '100';
          // Use consistent shadow without the green border
          inner.style.boxShadow = '0 5px 10px rgba(0,0,0,0.4)';
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMatchedHighlightRender, highlightType, highlightHotelId, hotels]); 

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className="mapbox-map" />
  );
}; 

function createSearchResultMarker(): HTMLDivElement {
  const marker = document.createElement('div');
  marker.className = 'search-result-marker';
  
  const pin = document.createElement('div');
  pin.style.width = "30px";
  pin.style.height = "30px";
  pin.style.background = "#FF4D94"; 
  pin.style.borderRadius = "50% 50% 50% 0";
  pin.style.transform = "rotate(-45deg)";
  pin.style.margin = "10px 0 0 10px";
  pin.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
  pin.style.border = "2px solid white";
  
  const inner = document.createElement('div');
  inner.style.width = "14px";
  inner.style.height = "14px";
  inner.style.background = "white";
  inner.style.borderRadius = "50%";
  inner.style.position = "absolute";
  inner.style.top = "50%";
  inner.style.left = "50%";
  inner.style.transform = "translate(-50%, -50%)";
  
  pin.appendChild(inner);
  marker.appendChild(pin);
  
  return marker;
}

export default React.memo(MapboxMap); 