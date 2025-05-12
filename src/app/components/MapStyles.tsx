"use client";

import { useEffect } from 'react';

export function MapboxCustomStyles() {
  useEffect(() => {
    // Custom popup styles (from reference project)
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
          color: #333;
        }
        .custom-map-popup {
          z-index: 10 !important;
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
    
    return () => {
      // Clean up isn't necessary since we check if the style exists before adding it
      // But if we ever need to remove it:
      // const styleElement = document.getElementById(customPopupStylesId);
      // if (styleElement) styleElement.remove();
    };
  }, []);

  return null;
}

export default MapboxCustomStyles; 