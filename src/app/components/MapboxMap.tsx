"use client";

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl, { Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ClientHotel } from '@/lib/pelotonAPI';
import { useSearch, ZOOM_LEVELS } from '@/app/contexts/SearchContext';

interface MapboxMapProps {
  hotels: ClientHotel[];
  mapRef?: React.MutableRefObject<mapboxgl.Map | null>; // For parent component to control map
  hoveredHotelId?: string | number | null;
  onMarkerClick?: (hotel: ClientHotel) => void;
  onMapLoad?: () => void; // New callback prop
  isMobile?: boolean; // Suppress popups on mobile
  onMarkerHover?: (hotelId: number | null) => void; // New prop for direct marker hover
  mapReady?: boolean; // New prop from page.tsx
  searchLocation?: { lat: number; lng: number } | null; // Location from currentIntent
  isHotelSearchIntent?: boolean; // Whether the current search is for a hotel
  matchedHotelId?: number | null; // ID of the matched hotel from API response
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

// Create a marker element wrapped in a container for positioning
function createMarkerElement(
  hotel: ClientHotel,
  isMobile?: boolean,
  onMarkerHover?: (id: number | null) => void,
  onMarkerClick?: (hotel: ClientHotel) => void
): HTMLDivElement {
  // Inner styled element (circle)
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
  inner.style.boxShadow = "0 3px 6px rgba(0,0,0,0.15)";
  inner.style.border = "2px solid white";
  inner.style.transition = "transform 0.1s ease-out, box-shadow 0.1s ease-out, opacity 0.2s ease-in-out";

  // Set background color based on bike availability
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

  // Wrapper for Mapbox positioning and event handling
  const wrapper = document.createElement('div');
  wrapper.dataset.hotelId = hotel.id.toString();
  wrapper.appendChild(inner);

  // Attach event listeners on wrapper
  if (!isMobile) {
    wrapper.addEventListener('mouseenter', () => onMarkerHover && onMarkerHover(hotel.id));
    wrapper.addEventListener('mouseleave', () => onMarkerHover && onMarkerHover(null));
  }
  wrapper.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (isMobile && onMarkerHover) onMarkerHover(hotel.id);
    if (onMarkerClick) onMarkerClick(hotel);
  });

  return wrapper;
}

// New function to create a search result marker
function createSearchResultMarker(): HTMLDivElement {
  const marker = document.createElement('div');
  marker.className = 'search-result-marker';
  
  const pin = document.createElement('div');
  pin.style.width = "30px";
  pin.style.height = "30px";
  pin.style.background = "#FF4D94"; // Distinctive color
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

const MapboxMap: React.FC<MapboxMapProps> = ({ 
  hotels, 
  mapRef: externalMapRef, 
  hoveredHotelId, 
  onMarkerClick, 
  onMapLoad, 
  isMobile, 
  onMarkerHover, 
  mapReady,
  searchLocation,
  isHotelSearchIntent,
  matchedHotelId
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const internalMapRef = useRef<mapboxgl.Map | null>(null);
  const map = externalMapRef || internalMapRef;
  const markersRef = useRef<Marker[]>([]);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  const { searchContextState } = useSearch(); // setZoom is not directly used by MapboxMap anymore for flyTo
  const { zoom: contextZoom } = searchContextState;
  const locationFromProps = searchLocation;

  // State to signal that markers need to be redrawn after map movement and style load
  const [needsMarkerRender, setNeedsMarkerRender] = useState(0); // Increment to trigger effect

  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    const mbAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mbAccessToken) {
      console.error("Mapbox access token is not set!");
      return;
    }
    mapboxgl.accessToken = mbAccessToken;
    const initialCenter: [number, number] = locationFromProps
      ? [locationFromProps.lng, locationFromProps.lat]
      : [-87.6298, 41.8781];
    const initialZoom = contextZoom || ZOOM_LEVELS.CITY;

    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initialCenter,
      zoom: initialZoom,
    });

    newMap.on('load', () => {
      map.current = newMap;
      if (onMapLoad) onMapLoad();
      setNeedsMarkerRender(prev => prev + 1); // Initial marker render
    });

    return () => {
      newMap.remove();
      if (map.current === newMap) map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once

  // Effect for map movement (flyTo)
  useEffect(() => {
    if (!map.current || !locationFromProps || !mapReady) return;

    console.log('[MapboxMap] flyTo triggered for:', locationFromProps, 'isHotelSearch:', isHotelSearchIntent);
    if (map.current) {
        (map.current as any)._lastLocationChangeTime = performance.now(); 
    }

    map.current.flyTo({
      center: [locationFromProps.lng, locationFromProps.lat],
      zoom: isHotelSearchIntent ? ZOOM_LEVELS.HOTEL : ZOOM_LEVELS.CITY,
      essential: true,
      duration: 1000,
    });

    // After flyTo initiates, listen for 'idle' to then trigger marker rendering
    const handleMapIdle = () => {
      console.log('[MapboxMap] map idle after flyTo, map.isStyleLoaded():', map.current?.isStyleLoaded());
      // At this point, the map should be settled and styles loaded.
      if (map.current) { // Check map.current still exists
         setNeedsMarkerRender(prev => prev + 1);
      }
      // .once automatically unbinds the listener after it fires once.
    };

    // Detach any previous idle listener before attaching a new one, crucial for rapid flyTo calls.
    // Though .once helps, explicit removal on effect re-run is safer for all scenarios.
    const currentMapInstance = map.current;
    currentMapInstance.once('idle', handleMapIdle);
    
    return () => {
      // Cleanup: remove the idle listener if the component unmounts or this effect re-runs
      // before the 'idle' event has fired.
      currentMapInstance?.off('idle', handleMapIdle);
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFromProps, isHotelSearchIntent, mapReady]); // mapReady ensures map is initialized

  // Effect for standalone zoom changes (e.g., from a zoom slider not tied to location change)
  useEffect(() => {
    if (!map.current || !mapReady || map.current.getZoom() === contextZoom) return;
    
    // Check if a flyTo animation is likely active due to recent location change.
    const mapInstance = map.current as any;
    const lastLocationChangeTime = mapInstance._lastLocationChangeTime || 0;
    const timeSinceLocationChange = performance.now() - lastLocationChangeTime;
    
    if (lastLocationChangeTime && timeSinceLocationChange < 1200) { // 1200ms > flyTo duration
        console.log('[MapboxMap] Skipping standalone zoom, flyTo likely active (time since last flyTo:', timeSinceLocationChange, 'ms)');
        return;
    }

    console.log('[MapboxMap] easeTo triggered for zoom:', contextZoom);
    map.current.easeTo({ zoom: contextZoom, duration: 500 });
    
    // It might be beneficial to also trigger marker re-render after zoom if it changes visibility significantly
    // map.current.once('zoomend', () => setNeedsMarkerRender(prev => prev + 1));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextZoom, mapReady]);

  // Effect for rendering hotel markers (now triggered by needsMarkerRender)
  useEffect(() => {
    console.log('[MapboxMap DEBUG] Marker effect triggered. mapReady:', mapReady, 'needsMarkerRender_val:', needsMarkerRender);
    if (map.current) {
      console.log('[MapboxMap DEBUG] map.isStyleLoaded():', map.current.isStyleLoaded(), 'mapZoom:', map.current.getZoom());
    }
    if (hotels) {
      console.log('[MapboxMap DEBUG] hotels prop length:', hotels.length, 'First hotel ID if any:', hotels[0]?.id);
    }

    if (!map.current || !map.current.isStyleLoaded() || !mapReady || !hotels) {
        console.warn('[MapboxMap] Marker render SKIPPED:', // Changed to warn for better visibility
            { mapCurrent: !!map.current, isStyleLoaded: map.current?.isStyleLoaded(), mapReady, hotelsPresent: !!hotels, hotelsLength: hotels?.length });
        // Even if skipped, try to update dependent markers if the primary list is gone or map not ready
        // This helps clear them if, for example, hotels array becomes empty.
        if (!hotels || hotels.length === 0) {
            setNeedsSearchMarkerRender(prev => prev + 1);
            setNeedsMatchedHighlightRender(prev => prev + 1);
        }
        return;
    }
    console.log('[MapboxMap] Rendering hotel markers, count:', hotels.length, 'mapZoom:', map.current.getZoom());
    
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    if (hotels.length === 0) {
      console.log('[MapboxMap DEBUG] hotels array is empty after guards, returning. Will clear search/matched markers.');
      setNeedsSearchMarkerRender(prev => prev + 1); 
      setNeedsMatchedHighlightRender(prev => prev + 1);
      return;
    }

    let addedCount = 0;
    hotels.forEach(hotel => {
      if (typeof hotel.lng !== 'number' || typeof hotel.lat !== 'number') { // Stricter check
        console.warn('[MapboxMap DEBUG] Hotel missing or invalid lng/lat:', hotel.id, 'lng:', hotel.lng, 'lat:', hotel.lat);
        return; 
      }
      const markerElement = createMarkerElement(hotel, isMobile, onMarkerHover, onMarkerClick);
      try {
        const marker = new mapboxgl.Marker({ element: markerElement })
          .setLngLat([hotel.lng, hotel.lat])
          .addTo(map.current!); 
        markersRef.current.push(marker);
        addedCount++;
      } catch (e) {
        console.error('[MapboxMap DEBUG] Error adding marker for hotel:', hotel.id, e);
      }
    });
    console.log('[MapboxMap DEBUG] Added', addedCount, 'markers out of', hotels.length);
    
    // After markers are set, re-evaluate search marker and matched highlight
    setNeedsSearchMarkerRender(prev => prev + 1);
    setNeedsMatchedHighlightRender(prev => prev + 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMarkerRender, hotels, mapReady, isMobile, onMarkerHover, onMarkerClick]); // hotels must be here

  // State and Effect for rendering search result marker (triggered by needsMarkerRender or specific prop changes)
  const [needsSearchMarkerRender, setNeedsSearchMarkerRender] = useState(0);
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !mapReady) return;
    console.log('[MapboxMap] Evaluating search result marker. IsHotelIntent:', isHotelSearchIntent, 'Location:', locationFromProps);

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
    
    if (isHotelSearchIntent && locationFromProps) {
      console.log('[MapboxMap] Rendering search result marker.');
      const markerElement = createSearchResultMarker();
      searchMarkerRef.current = new mapboxgl.Marker({ element: markerElement })
        .setLngLat([locationFromProps.lng, locationFromProps.lat])
        .addTo(map.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSearchMarkerRender, locationFromProps, isHotelSearchIntent, mapReady]);

  // State and Effect for highlighting matched hotel (triggered by needsMarkerRender or specific prop changes)
  const [needsMatchedHighlightRender, setNeedsMatchedHighlightRender] = useState(0);
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || markersRef.current.length === 0) return;
    console.log('[MapboxMap] Evaluating matched hotel highlight. MatchedID:', matchedHotelId);

    // Reset all highlights first
    markersRef.current.forEach(marker => {
        const element = marker.getElement();
        const inner = element.querySelector('div') as HTMLDivElement;
        if (!inner) return;
        const existingTransform = element.style.transform || '';
        const mapboxTransform = existingTransform.replace(/ scale\([^)]+\)/, '').trim();
        element.style.transform = mapboxTransform; 
        element.style.zIndex = '1'; 
        inner.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)';
        // Reset opacity if it was changed for non-hovered items
        if (hoveredHotelId !== null && parseInt(element.dataset.hotelId || '0') !== hoveredHotelId) {
            // inner.style.opacity = '0.65'; // This logic is in hoveredHotelId effect
        } else {
            inner.style.opacity = '1';
        }
    });

    if (!matchedHotelId) return; // No specific hotel to highlight
    
    let foundAndHighlighted = false;
    markersRef.current.forEach(marker => {
      const element = marker.getElement();
      const hotelId = parseInt(element.dataset.hotelId || '0');
      const inner = element.querySelector('div') as HTMLDivElement;
      if (!inner) return;
      
      if (hotelId === matchedHotelId) {
        console.log('[MapboxMap] Highlighting matched hotel ID:', matchedHotelId);
        const existingTransform = element.style.transform || '';
        const mapboxTransform = existingTransform.replace(/ scale\([^)]+\)/, '').trim();
        element.style.transform = `${mapboxTransform} scale(1.2)`;
        element.style.zIndex = '100';
        inner.style.boxShadow = '0 5px 10px rgba(0,0,0,0.4), 0 0 0 3px #4CAF50';
        foundAndHighlighted = true;
      }
    });
    if (matchedHotelId && !foundAndHighlighted) {
        console.warn('[MapboxMap] Matched hotel ID provided, but no corresponding marker found to highlight.', matchedHotelId);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMatchedHighlightRender, matchedHotelId, hotels]); // hotels dep ensures we re-eval if markers changed

  // Effect for hover state (mostly unchanged, but ensure it respects existing transforms)
  useEffect(() => {
    if (!map.current || markersRef.current.length === 0) return;

    markersRef.current.forEach(marker => {
      const element = marker.getElement();
      const hotelId = parseInt(element.dataset.hotelId || '0');
      const inner = element.querySelector('div') as HTMLDivElement;
      if (!inner) return;
      
      // Preserve existing scale from match highlight, or reset from previous hover scale
      const baseTransform = (element.style.transform || '').replace(/ scale\(1\.1\)/, '').trim(); // Remove only hover scale
      const isMatched = hotelId === matchedHotelId;

      if (hoveredHotelId === hotelId) {
        if (!isMatched) element.style.transform = `${baseTransform} scale(1.1)`; // Don't override match scale
        element.style.zIndex = isMatched ? '101' : '10'; // Hovered on top, or matched hover on top of matched
        inner.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        inner.style.opacity = '1';
      } else if (hoveredHotelId !== null) { // Something else is hovered
        if (!isMatched) element.style.transform = baseTransform; // Reset hover scale if not matched
        element.style.zIndex = isMatched ? '100' : '1'; // Keep matched on top, others default
        inner.style.opacity = isMatched ? '1' : '0.65'; // Matched remains opaque, others dim
        if (!isMatched) inner.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)'; // Reset non-matched shadow
      } else { // Nothing hovered
        if (!isMatched) element.style.transform = baseTransform; // Reset hover scale if not matched
        element.style.zIndex = isMatched ? '100' : '1'; // Keep matched on top
        inner.style.opacity = '1'; // All opaque
        if (!isMatched) inner.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)'; // Reset non-matched shadow
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredHotelId, matchedHotelId, hotels]); // hotels ensures re-eval if markers change

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className="mapbox-map" />
  );
};

export default React.memo(MapboxMap); 