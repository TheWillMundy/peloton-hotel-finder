"use client";

import React, { useEffect, useRef } from 'react';
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

const MapboxMap: React.FC<MapboxMapProps> = ({ hotels, mapRef: externalMapRef, hoveredHotelId, onMarkerClick, onMapLoad, isMobile, onMarkerHover }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const internalMapRef = useRef<mapboxgl.Map | null>(null);
  const map = externalMapRef || internalMapRef;
  const markersRef = useRef<Marker[]>([]);
  const { center, setCenter, zoom, setZoom } = useMapContext();
  const userInitiatedMove = useRef(false);
  const currentHoveredMarkerElementRef = useRef<HTMLElement | null>(null);

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
    if (map.current && map.current.isStyleLoaded() && center && Array.isArray(center)) {
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
  }, [center, map, zoom]); // React to center changes for flying. Zoom is handled by map init and user.

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !currentMap.isStyleLoaded()) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    hotels.forEach(hotel => {
      if (typeof hotel.lat === 'number' && typeof hotel.lng === 'number') {
        const el = document.createElement('div');
        el.dataset.hotelId = hotel.id.toString();
        // Slightly larger markers for better presence
        el.style.width = "40px"; 
        el.style.height = "40px";
        el.style.borderRadius = "50%";
        el.style.cursor = "pointer";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.color = "white";
        el.style.fontWeight = "bold";
        el.style.fontSize = "15px"; // Slightly larger font
        el.style.boxShadow = "0 3px 6px rgba(0,0,0,0.15)"; // Enhanced shadow
        el.style.border = "2px solid white"; // Base border for all markers
        el.style.transition = "transform 0.1s ease-out, box-shadow 0.1s ease-out, opacity 0.2s ease-in-out"; // Smooth transition for hover

        // More aesthetic colors
        if (hotel.total_bikes && hotel.total_bikes > 0) {
          if (hotel.in_room) {
            el.style.backgroundColor = "#4A90E2"; // Blue for in-room
            el.style.borderColor = "rgba(74, 144, 226, 0.5)"; // Border matching bg
          } else if (hotel.total_bikes >= 3) {
            el.style.backgroundColor = "#58B794"; // Green for 3+ gym
            el.style.borderColor = "rgba(88, 183, 148, 0.5)"; // Border matching bg
          } else {
            el.style.backgroundColor = "#F5BD41"; // Gold/yellow for 1-2 gym
            el.style.borderColor = "rgba(245, 189, 65, 0.5)"; // Border matching bg
          }
          el.innerText = String(hotel.total_bikes);
        } else {
          el.style.backgroundColor = "#9AA1B1"; // Grey for no bikes
          el.style.borderColor = "rgba(154, 161, 177, 0.5)"; // Border matching bg
          el.innerText = "P"; 
        }

        // Create marker anchored at bottom center so scaling does not move its lat/lng position
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([hotel.lng, hotel.lat])
          .addTo(currentMap!);
        // Store only original boxShadow for reset
        el.dataset.origBoxShadow = el.style.boxShadow || '';

        // Direct marker hover and click listeners
        if (!isMobile) {
          el.addEventListener('mouseenter', () => {
            if (onMarkerHover) onMarkerHover(hotel.id); 
          });

          el.addEventListener('mouseleave', () => {
            if (onMarkerHover) onMarkerHover(null); 
          });
        }

        el.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          // Also trigger hover effect on mobile when clicking a marker
          if (isMobile && onMarkerHover) {
            onMarkerHover(hotel.id);
          }
          if (onMarkerClick) onMarkerClick(hotel); 
        });
        markersRef.current.push(marker);
      }
    });
  }, [hotels, map, onMarkerClick, isMobile, onMarkerHover]);

  // Effect to handle hoveredHotelId (from list or direct marker hover)
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !currentMap.isStyleLoaded()) {
      return;
    }

    // Reset style for the previously hovered element (if any)
    if (currentHoveredMarkerElementRef.current) {
      const prevElement = currentHoveredMarkerElementRef.current;
      prevElement.style.transform = prevElement.style.transform.replace(/scale\([^)]*\)/g, '').trim(); // Remove scale
      prevElement.style.boxShadow = prevElement.dataset.origBoxShadow || '';
      prevElement.style.zIndex = '1';
      // prevElement.style.opacity = '1'; // Will be handled by the loop below if it's not the new hovered one
      currentHoveredMarkerElementRef.current = null;
    }
    
    // Apply styles based on the new hoveredHotelId
    markersRef.current.forEach(m => {
      const markerElement = m.getElement() as HTMLElement;
      if (markerElement.dataset.hotelId === String(hoveredHotelId)) {
        // This is the newly hovered marker
        const baseTransform = markerElement.style.transform.replace(/scale\([^)]*\)/g, '').trim();
        markerElement.style.transform = `${baseTransform} scale(1.15)`;
        markerElement.style.boxShadow = '0 6px 15px rgba(0,0,0,0.3)';
        markerElement.style.zIndex = '10';
        markerElement.style.opacity = '1';
        currentHoveredMarkerElementRef.current = markerElement;
      } else {
        // This is not the hovered marker
        // Only apply opacity change on desktop
        if (!isMobile) {
          markerElement.style.opacity = '0.6'; // Deactivate other markers (desktop only)
        } else {
          markerElement.style.opacity = '1'; // Keep full opacity on mobile
        }
        
        // Ensure non-hovered markers are not scaled (redundant if prevElement logic is robust, but safe)
        const baseTransform = markerElement.style.transform.replace(/scale\([^)]*\)/g, '').trim();
        markerElement.style.transform = baseTransform;
        markerElement.style.zIndex = '1';
        markerElement.style.boxShadow = markerElement.dataset.origBoxShadow || '';
      }
    });

    if (!hoveredHotelId && !currentHoveredMarkerElementRef.current) {
      // Explicitly reset all opacities if nothing is hovered (e.g. mouse left list and map)
      markersRef.current.forEach(m => {
        const markerElement = m.getElement() as HTMLElement;
        markerElement.style.opacity = '1';
      });
    }

  }, [hoveredHotelId, map, hotels, isMobile]);

  return <div ref={mapContainer} style={{ position: 'absolute', top: 0, bottom: 0, width: '100%', height: '100%' }} />;
};

export default React.memo(MapboxMap); 