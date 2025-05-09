"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import MapboxMap from '@/app/components/MapboxMap';
import { MapProvider, useMapContext } from '@/app/contexts/MapContext';
import CitySearchInput from '@/app/components/CitySearchInput';
import type { Map as MapboxMapType } from 'mapbox-gl';
import { useQuery } from '@tanstack/react-query';
import HotelCard from '@/app/components/HotelCard';
import ListView from '@/app/components/ListView';
import ViewToggle, { ViewMode } from '@/app/components/ViewToggle';
import { ClientHotel } from '@/lib/pelotonAPI';
import { ViewModeProvider, useViewMode } from '@/app/contexts/ViewModeContext';
import HotelDetailModal from '@/app/components/HotelDetailModal';

// Renaming SearchPanelPlaceholder to HotelListPanel for clarity
const HotelListPanel = ({ onHotelHover, hotels }: { 
  onHotelHover: (id: number | null) => void;
  hotels: ClientHotel[];
}) => {
  if (hotels.length === 0) {
    return (
        <div className="p-4 text-center text-gray-500">
            <p>No hotels to display for this area yet, or try searching a city.</p>
        </div>
    );
  }
  return (
    <div className="p-4 h-full overflow-y-auto space-y-3">
      {/* <h2 className="text-lg font-semibold mb-4">Hotels Found</h2> Removed for cleaner look, can be added back */}
      {hotels.map(hotel => (
        <HotelCard key={hotel.id} hotel={hotel} onHover={onHotelHover} />
      ))}
    </div>
  );
};

// Cubic bezier function (from reference)
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return function(t: number) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const term1 = Math.pow(1 - t, 3) * 0; // Assuming P0 is (0,0)
    const term2 = 3 * Math.pow(1 - t, 2) * t * y1;
    const term3 = 3 * (1 - t) * Math.pow(t, 2) * y2;
    const term4 = Math.pow(t, 3) * 1; // Assuming P3 is (1,1)
    return term1 + term2 + term3 + term4;
  }
}

function HotelSearchPageContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hotels, setHotels] = useState<ClientHotel[]>([]);
  const [hoveredHotelId, setHoveredHotelId] = useState<number | null>(null);
  const [currentCity, setCurrentCity] = useState<string>("");
  const [mapReady, setMapReady] = useState(false);
  const [initialPaddingSet, setInitialPaddingSet] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<ClientHotel | null>(null);
  
  const { viewMode, setViewMode } = useViewMode();

  const mapRef = useRef<MapboxMapType | null>(null);
  const { setCenter } = useMapContext();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Define the expected API response structure on the client
  interface HotelsApiResponse {
    hotels: ClientHotel[];
    cityCenter?: [number, number]; // Lng, Lat
  }

  // Actual TanStack Query for fetching hotels
  const { 
    data: apiResponse, // Rename data to apiResponse for clarity
    isLoading: isLoadingHotels, 
    isError: isFetchError, 
    error: fetchError,
    isSuccess: isFetchSuccess 
  } = useQuery<HotelsApiResponse, Error>({ // Update expected data type
    queryKey: ['hotels', currentCity],
    queryFn: async () => {
      if (!currentCity) return { hotels: [], cityCenter: undefined }; // Return default structure if no city
      const response = await fetch(`/api/hotels?city=${encodeURIComponent(currentCity)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error fetching hotels" }));
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      const data: HotelsApiResponse = await response.json(); // Expect the new structure
      return data;
    },
    enabled: !!currentCity, 
    retry: 1,
  });

  useEffect(() => {
    if (isFetchSuccess && apiResponse) {
      setHotels(apiResponse.hotels || []); // Set hotels from the response object
      if (apiResponse.cityCenter) {
        setCenter(apiResponse.cityCenter); // Set center from the response object
        // Optionally set zoom here if needed
        // setZoom(12);
      }
    } else if (isFetchError && fetchError) {
      console.error("Failed to fetch hotels:", fetchError.message);
      setHotels([]); // Clear hotels on error
      // toast({ title: "Error", description: fetchError.message, variant: "destructive" });
    }
    // Intentionally excluding setCenter from deps array to avoid potential loops 
    // if setCenter itself causes a re-render that refetches. 
    // The map component effect handles flying to the new center.
  }, [isFetchSuccess, apiResponse, isFetchError, fetchError, setCenter]); 

  const handleHotelHover = useCallback((id: number | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredHotelId(id);
    }, 75);
  }, []);

  const handleMapLoad = useCallback(() => {
    setMapReady(true);
  }, []);

  const handleHotelSelect = useCallback((hotel: ClientHotel) => {
    setSelectedHotel(hotel);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedHotel(null);
  }, []);

  useEffect(() => {
    if (mapRef.current && mapReady && !initialPaddingSet) {
      mapRef.current.easeTo({
          padding: { left: isSidebarOpen ? 420 : 0, right: 0, top: 0, bottom: 0 },
          duration: 0
      });
      setInitialPaddingSet(true);
    }
  }, [mapReady, isSidebarOpen, initialPaddingSet]);

  const handleSidebarToggle = () => {
    const newIsOpen = !isSidebarOpen;
    setIsSidebarOpen(newIsOpen);
    
    if (mapRef.current && mapReady) {
      mapRef.current.easeTo({
        padding: { left: newIsOpen ? 420 : 0, right: 0, top: 0, bottom: 0 },
        duration: 500, 
        easing: cubicBezier(0.4, 0, 0.2, 1),
      });
    }
  };

  const handleViewChange = (newView: ViewMode) => {
    setViewMode(newView);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <aside
        className={cn(
          "absolute z-20 border bg-background/95 backdrop-blur-sm",
          "shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
          "transition-all duration-700 ease-in-out",
          viewMode === "list" 
            ? "inset-4 rounded-xl"
            : "left-4 top-4 bottom-4 w-[420px] rounded-3xl",
          !isSidebarOpen && "-translate-x-full"
        )}
      >
        <div className={cn(
          "p-6 flex items-center space-x-2",
          viewMode === 'map' && 'pr-14'
        )}>
          <CitySearchInput 
              onSearch={(city: string) => setCurrentCity(city)} 
              isLoading={isLoadingHotels}
          />
        </div>
        <div className={cn(
          "overflow-y-auto",
          viewMode === "list" ? "flex-1 h-[calc(100%-70px)]" : "h-[calc(100%-70px)]"
        )}>
          {viewMode === "list" ? (
            <ListView 
              hotels={hotels}
              isLoading={isLoadingHotels}
              onHotelSelect={handleHotelSelect}
            />
          ) : (
            <HotelListPanel hotels={hotels} onHotelHover={handleHotelHover} />
          )}
        </div>
      </aside>

      <div className={cn(
        "absolute inset-0 z-10",
        viewMode === "list" && "opacity-20 pointer-events-none"
      )}>
        <MapboxMap 
          hotels={hotels} 
          mapRef={mapRef} 
          hoveredHotelId={hoveredHotelId}
          onMarkerClick={handleHotelSelect}
          onMapLoad={handleMapLoad}
        />
      </div>

      <ViewToggle 
        activeView={viewMode}
        onChange={handleViewChange}
        className="absolute z-30 top-8 right-8 bg-white"
      />
      
      {viewMode === 'map' && (
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute z-30 h-10 w-10 rounded-full",
            "bg-background/95 shadow-lg backdrop-blur-sm hover:bg-background/80",
            "transition-all duration-500 ease-out",
            isSidebarOpen ? "left-[444px] top-6" : "left-6 top-6"
          )}
          onClick={handleSidebarToggle}
          disabled={!mapReady}
        >
          <ChevronLeft
            className="h-4 w-4 transition-transform duration-500 ease-out"
            style={{ transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </Button>
      )}

      {selectedHotel && (
        <HotelDetailModal 
          hotel={selectedHotel} 
          onClose={handleCloseModal} 
        />
      )}
    </div>
  );
}

export default function HotelSearchPage() {
  return (
    <MapProvider>
      <ViewModeProvider>
        <HotelSearchPageContent />
      </ViewModeProvider>
    </MapProvider>
  );
}
