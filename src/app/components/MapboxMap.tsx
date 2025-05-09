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

const MapboxMap: React.FC<MapboxMapProps> = ({ hotels, mapRef: externalMapRef, hoveredHotelId, onMarkerClick, onMapLoad }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const internalMapRef = useRef<mapboxgl.Map | null>(null);
  const map = externalMapRef || internalMapRef; // Use external ref if provided

  const markersRef = useRef<Marker[]>([]);
  const { center, setCenter, zoom, setZoom } = useMapContext();
  const userInitiatedMove = useRef(false); // To track if map move was by user

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
        el.style.width = "36px";
        el.style.height = "36px";
        el.style.borderRadius = "50%";
        el.style.cursor = "pointer";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.color = "white";
        el.style.fontWeight = "bold";
        el.style.fontSize = "14px";
        el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)"; // Add subtle shadow for depth

        // More aesthetic colors
        if (hotel.total_bikes && hotel.total_bikes > 0) {
          if (hotel.in_room) {
            // Blue for in-room bikes (more muted tone)
            el.style.backgroundColor = "#4A90E2"; 
          } else if (hotel.total_bikes >= 3) {
            // Green for 3+ gym bikes (more muted tone)
            el.style.backgroundColor = "#58B794"; 
          } else {
            // Gold/yellow for 1-2 gym bikes
            el.style.backgroundColor = "#F5BD41"; 
          }
          el.innerText = String(hotel.total_bikes);
        } else {
          // Grey for no bikes (more muted tone)
          el.style.backgroundColor = "#9AA1B1"; 
          el.innerText = "P"; // Placeholder for Peloton or 0
        }

        const marker = new mapboxgl.Marker(el)
          .setLngLat([hotel.lng, hotel.lat])
          .addTo(currentMap!); 
        
        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #333; padding: 5px;">
            <h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 16px;">${hotel.name}</h3>
            ${hotel.total_bikes ? `<p style="margin: 0 0 5px 0;"><strong>Bikes:</strong> ${hotel.total_bikes}</p>` : ''}
            <p style="margin: 0 0 5px 0;">
              ${hotel.in_gym ? '<span style="background-color: #e9f5ea; color: #58B794; padding: 2px 5px; border-radius: 4px; margin-right: 5px;">In Gym</span>' : '<span style="background-color: #f8e8e8; color: #E57373; padding: 2px 5px; border-radius: 4px; margin-right: 5px;">Not in Gym</span>'}
              ${hotel.in_room ? '<span style="background-color: #e6f3ff; color: #4A90E2; padding: 2px 5px; border-radius: 4px;">In Room</span>' : '<span style="background-color: #f8e8e8; color: #E57373; padding: 2px 5px; border-radius: 4px;">Not in Room</span>'}
            </p>
            ${hotel.bike_features && hotel.bike_features.length > 0 ? `<p style="margin: 0 0 5px 0;"><strong>Features:</strong> ${hotel.bike_features.join(', ')}</p>` : ''}
            ${hotel.url ? `<a href="${hotel.url.startsWith('http') ? hotel.url : '//' + hotel.url}" target="_blank" rel="noopener noreferrer" style="color: #4A90E2; text-decoration: none;">Visit Website</a>` : ''}
          </div>
        `;

        const popup = new mapboxgl.Popup({ 
          offset: 25, 
          className: 'custom-map-popup' 
        }).setHTML(popupContent);
        
        marker.setPopup(popup);

        marker.getElement().addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation(); 
            if (map.current) { 
                markersRef.current.forEach(m => {
                    if (m !== marker && m.getPopup()?.isOpen()) {
                        m.getPopup()!.remove();
                    }
                });
                popup.addTo(map.current);
            }
            if (onMarkerClick) {
                onMarkerClick(hotel);
            }
        });
        markersRef.current.push(marker);
      }
    });
  }, [hotels, map, onMarkerClick]);

  // Effect to handle hoveredHotelId (e.g., show popup or highlight marker)
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !currentMap.isStyleLoaded()) {
        if (currentMap) { // Check if map.current is available for cleanup
             markersRef.current.forEach(m => {
                if (m.getPopup()?.isOpen()) { // Optional chaining for getPopup()
                    m.getPopup()?.remove();
                }
            });
        }
        return;
    }

    if (!hoveredHotelId) {
        markersRef.current.forEach(m => {
            if (m.getPopup()?.isOpen()) { // Optional chaining
                m.getPopup()?.remove();
            }
        });
        return;
    }

    const currentMarker = markersRef.current.find(m => {
      // Use dataset.hotelId for direct lookup
      return m.getElement().dataset.hotelId === String(hoveredHotelId);
    });

    if (currentMarker) {
        // Close other popups
        markersRef.current.forEach(m => {
            if (m !== currentMarker && m.getPopup()?.isOpen()) { // Optional chaining
            m.getPopup()?.remove();
            }
        });
        if (!currentMarker.getPopup()?.isOpen()) { // Optional chaining
            currentMarker.getPopup()?.addTo(currentMap);
        }
        currentMap.flyTo({ center: currentMarker.getLngLat(), zoom: Math.max(currentMap.getZoom(), 14) });
    }
  }, [hoveredHotelId, hotels, map, onMarkerClick]);


  return <div ref={mapContainer} style={{ position: 'absolute', top: 0, bottom: 0, width: '100%', height: '100%' }} />;
};

export default React.memo(MapboxMap); 