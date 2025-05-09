"use client";

import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import { LngLatLike } from 'mapbox-gl';

interface MapContextType {
  center: LngLatLike;
  setCenter: Dispatch<SetStateAction<LngLatLike>>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

// Initial default center (e.g., New York City)
// You might want to make this more dynamic later (e.g., based on user's location or last search)
const DEFAULT_CENTER: LngLatLike = [-74.0060, 40.7128]; 
const DEFAULT_ZOOM = 10;

export const MapProvider = ({ children }: { children: ReactNode }) => {
  const [center, setCenter] = useState<LngLatLike>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);

  return (
    <MapContext.Provider value={{ center, setCenter, zoom, setZoom }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
}; 