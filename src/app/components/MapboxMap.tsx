"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl, { LngLatLike, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapContext } from '@/app/contexts/MapContext';
import { ClientHotel } from '@/lib/pelotonAPI';
// You'll need to define this type or import it if it already exists from your API layer
// For now, a placeholder:

interface MapboxMapProps {
  hotels: ClientHotel[];
  mapRef?: React.MutableRefObject<mapboxgl.Map | null>; // For parent component to control map
  hoveredHotelId?: string | number | null;
  onMarkerClick?: (hotel: ClientHotel) => void;
  onMapLoad?: () => void; // New callback prop
  isMobile?: boolean; // Suppress popups on mobile
  onMarkerHover?: (hotelId: number | null) => void; // New prop for direct marker hover
  mapReady?: boolean; // New prop from page.tsx
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

const MapboxMap: React.FC<MapboxMapProps> = ({ hotels, mapRef: externalMapRef, hoveredHotelId, onMarkerClick, onMapLoad, isMobile, onMarkerHover, mapReady }) => {
  // console.log('[MapboxMap component render] Hotels count:', hotels?.length, 'mapReady:', mapReady, 'isMobile:', isMobile);
  const mapContainer = useRef<HTMLDivElement>(null);
  const internalMapRef = useRef<mapboxgl.Map | null>(null);
  const map = externalMapRef || internalMapRef;
  const markersRef = useRef<Marker[]>([]);
  const { center, setCenter, zoom, setZoom } = useMapContext();
  const userInitiatedMove = useRef(false);

  useEffect(() => {
    if (map.current || !mapContainer.current) return; // Initialize map only once

    const mbAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mbAccessToken) {
      console.error("Mapbox access token is not set! Check NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN environment variable.");
      // Consider returning a placeholder UI or throwing an error to prevent map initialization without a token.
      return; // Do not initialize map if token is missing
    }
    mapboxgl.accessToken = mbAccessToken;

    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11', // Changed to light-v11 for grayscale style
      center: center,
      zoom: zoom,
    });

    newMap.on('movestart', () => {
      userInitiatedMove.current = true; 
    });

    newMap.on('moveend', () => { 
      if (userInitiatedMove.current && map.current) { // map.current could be null if component unmounted during move
        setCenter(newMap.getCenter().toArray() as LngLatLike);
        setZoom(newMap.getZoom());
        // userInitiatedMove.current = false; // Resetting here might be too soon if moveend fires multiple times or before subsequent effects
      }
    });
    
    newMap.on('load', () => {
      map.current = newMap;
      if (onMapLoad) {
        onMapLoad(); // Call the callback
      }
      // You can add initial sources/layers here if needed
      // Force a re-render or update of dependent effects if necessary by updating a state
    });

    // Assign to ref only after successful load to ensure map.current is valid when used in other effects
    // map.current = newMap; // Moved into 'load' event

    return () => {
      newMap.remove();
      if (map.current === newMap) {
        map.current = null; // Clear ref if it was this map instance
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed map, center, zoom, setCenter, setZoom from deps to ensure it runs once

  // New useEffect to react to programmatic changes of 'center' from context
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded() && mapReady && center && Array.isArray(center)) {
      // If a programmatic move just finished, userInitiatedMove might still be true from 'movestart'.
      // We want to flyTo if the context center is different AND it wasn't a direct user pan/zoom that just concluded.
      // A simple way is to check if the map is currently being dragged/panned by the user.
      // Mapbox 'drag' or 'pitch' events could set a flag, but for simplicity, 
      // we rely on userInitiatedMove being false when a programmatic change is intended.
      
      if (userInitiatedMove.current) {
        userInitiatedMove.current = false; // Reset now, as the user's interaction that triggered a context update is done.
        return; // Don't flyTo if this center change came from the user moving the map.
      }

      const mapCenter = map.current.getCenter();
      // Simple check for significant difference to avoid tiny adjustments or loops
      const latDiff = Math.abs(mapCenter.lat - center[1]);
      const lngDiff = Math.abs(mapCenter.lng - center[0]);

      if (latDiff > 0.0001 || lngDiff > 0.0001) { // Adjust threshold as needed
        map.current.flyTo({
          center: center,
          zoom: zoom > 12 ? zoom : 12, // Fly to current zoom if >12, else default to 12
          essential: true,
          duration: 1200 // ms, adjust for desired speed
        });
      }
    }
  }, [center, map, zoom, mapReady]); // React to center changes for flying. Zoom is handled by map init and user.

  // Helper function to apply hover/dim/default styles to markers
  const applyMarkerStyles = useCallback(() => {
    markersRef.current.forEach(marker => {
      const wrapper = marker.getElement();
      const inner = wrapper.firstElementChild as HTMLElement;
      const markerHotelId = wrapper.dataset.hotelId;
      
      // Default styles (for mobile or non-hovered/non-dimmed desktop)
      let scale = 1;
      let opacity = '1'; // Opacity on inner
      let zIndex = '1';  // zIndex on wrapper
      let shadow = '0 3px 6px rgba(0,0,0,0.15)'; // Default shadow for inner

      if (!isMobile) {
        const isHovered = markerHotelId == hoveredHotelId;
        const isDimmed = hoveredHotelId !== null && !isHovered;
        
        scale = isHovered ? 1.2 : isDimmed ? 0.9 : 1;
        opacity = isDimmed ? '0.6' : '1'; // Opacity on inner
        zIndex = isHovered ? '10' : '1';    // zIndex on wrapper
        shadow = isHovered ? '0 5px 15px rgba(0,0,0,0.3)' : '0 3px 6px rgba(0,0,0,0.15)'; // Shadow for inner
      }
      
      // Apply styles
      // Ensure transition is always present for smooth changes if isMobile state flips
      inner.style.transition = 'transform 0.1s ease-out, box-shadow 0.1s ease-out, opacity 0.2s ease-in-out';
      inner.style.transform = `scale(${scale})`;
      inner.style.opacity = opacity; 
      inner.style.boxShadow = shadow;

      wrapper.style.zIndex = zIndex;
    });
  }, [hoveredHotelId, isMobile]); // Added isMobile to dependency array

  // Effect to add/update markers when hotels change or map is ready
  useEffect(() => {
    const currentMap = map.current;
    // Only proceed when map instance exists and is flagged ready
    if (!currentMap || !mapReady) {
      return;
    }
    console.log('[MapboxMap] updating markers, hotel count:', hotels.length);

    // Remove old markers not in hotels
    const hotelIdsInProps = new Set(hotels.map(h => h.id.toString()));
    markersRef.current = markersRef.current.filter(marker => {
      const id = marker.getElement().dataset.hotelId;
      if (id && !hotelIdsInProps.has(id)) {
        marker.remove();
        return false;
      }
      return true;
    });

    // Add new markers
    const existingIds = new Set(markersRef.current.map(m => m.getElement().dataset.hotelId));
    hotels.forEach(hotel => {
      const idStr = hotel.id.toString();
      if (!existingIds.has(idStr)) {
        const el = createMarkerElement(hotel, isMobile, onMarkerHover, onMarkerClick);
        const newMarker = new mapboxgl.Marker(el)
          .setLngLat([hotel.lng, hotel.lat])
          .addTo(currentMap);
        markersRef.current.push(newMarker);
      }
    });

    // Apply styles immediately
    applyMarkerStyles();

    // Re-apply styles after map movements to preserve scale
    currentMap.on('moveend', applyMarkerStyles);
    return () => {
      currentMap.off('moveend', applyMarkerStyles);
    };
  }, [hotels, mapReady, isMobile, onMarkerHover, onMarkerClick, applyMarkerStyles, map]); // Added map to dependency array

  // Reapply marker styling whenever hoveredHotelId changes
  useEffect(() => {
    applyMarkerStyles();
  }, [applyMarkerStyles, map]); // Added map to the dependency array

  return <div ref={mapContainer} style={{ position: 'absolute', top: 0, bottom: 0, width: '100%', height: '100%' }} />;
};

export default React.memo(MapboxMap); 