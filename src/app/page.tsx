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
import BottomSheet, { BottomSheetState } from '@/app/components/BottomSheet';

const MOBILE_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 420;
const MOBILE_SEARCH_BAR_HEIGHT = 60; // Approximate height for the search bar on mobile

// Renaming SearchPanelPlaceholder to HotelListPanel for clarity
const HotelListPanel = ({ onHotelHover, onHotelSelect, hotels, hoveredHotelId, isMobile = false }: { 
  onHotelHover: (id: number | null) => void;
  onHotelSelect: (hotel: ClientHotel) => void;
  hotels: ClientHotel[];
  hoveredHotelId: number | null;
  isMobile?: boolean;
}) => {
  if (hotels.length === 0) {
    return (
        <div className="p-4 text-center text-gray-500">
            <p>No hotels to display for this area yet, or try searching a city.</p>
        </div>
    );
  }
  return (
    <div className="p-4 space-y-3">
      {/* <h2 className="text-lg font-semibold mb-4">Hotels Found</h2> Removed for cleaner look, can be added back */}
      {hotels.map(hotel => (
        <HotelCard 
          key={hotel.id} 
          hotel={hotel} 
          onHover={onHotelHover} 
          onClick={() => onHotelSelect(hotel)}
          isHovered={hotel.id === hoveredHotelId}
          isAnyHovered={hoveredHotelId !== null}
          isMobile={isMobile}
        />
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
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [hotels, setHotels] = useState<ClientHotel[]>([]);
  const [hoveredHotelId, setHoveredHotelId] = useState<number | null>(null);
  const [isHoverFromMap, setIsHoverFromMap] = useState(false); // Track if hover is from map
  const [currentCity, setCurrentCity] = useState<string>("");
  const [mapReady, setMapReady] = useState(false);
  const [initialPaddingSet, setInitialPaddingSet] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<ClientHotel | null>(null);
  
  const { viewMode, setViewMode } = useViewMode();

  const mapRef = useRef<MapboxMapType | null>(null);
  const { setCenter } = useMapContext();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simple check for mobile based on window width
  const [isMobile, setIsMobile] = useState(false);
  const [currentBottomSheetState, setCurrentBottomSheetState] = useState<BottomSheetState>('closed');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      setIsHoverFromMap(false); // This hover is from sidebar, not map
    }, 75);
  }, []);

  const handleMapMarkerHover = useCallback((id: number | null) => {
    // For mobile, we only want to process this for actual taps (non-null id)
    // For desktop, we process both mouseenter (non-null id) and mouseleave (null id)
    if (isMobile && id === null) return;
    
    setHoveredHotelId(id);
    setIsHoverFromMap(true); // This hover is from map
    
    // On mobile, make sure the bottom sheet is at least in peek state when tapping a marker
    if (isMobile && id !== null) {
      // If panel is closed, open it
      if (!isPanelOpen) {
        setIsPanelOpen(true);
      }
      
      // If bottom sheet is closed, set it to peek state
      if (currentBottomSheetState === 'closed') {
        setCurrentBottomSheetState('peek');
      }
    }
  }, [isMobile, isPanelOpen, currentBottomSheetState]);

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
      let PADDING_BOTTOM = 0;
      if (isMobile) {
        // Initial peek height for bottom sheet if panel is open
        if (isPanelOpen) {
          const peekVh = 25; // Corresponds to PEEK_HEIGHT_VH in BottomSheet
          PADDING_BOTTOM = (peekVh * window.innerHeight) / 100;
          setCurrentBottomSheetState('peek');
        } else {
          setCurrentBottomSheetState('closed');
        }
      }

      mapRef.current.easeTo({
          padding: {
            left: !isMobile && isPanelOpen ? DESKTOP_SIDEBAR_WIDTH : 0,
            right: 0, 
            top: isMobile ? MOBILE_SEARCH_BAR_HEIGHT : 0, // Add top padding for mobile search bar
            bottom: PADDING_BOTTOM 
          },
          duration: 0
      });
      setInitialPaddingSet(true);
      // Resize after initial padding
      setTimeout(() => mapRef.current?.resize(), 50); 
    }
  }, [mapReady, isPanelOpen, initialPaddingSet, isMobile]);

  // Effect to resize map when isMobile changes (layout switch)
  useEffect(() => {
    if (mapRef.current && mapReady) {
      // Delay to allow layout to settle after isMobile change
      setTimeout(() => mapRef.current?.resize(), 100); 
    }
  }, [isMobile, mapReady]);

  const handlePanelToggle = () => {
    const newIsOpen = !isPanelOpen;
    setIsPanelOpen(newIsOpen);

    if (isMobile) {
      const newState = newIsOpen ? 'peek' : 'closed';
      setCurrentBottomSheetState(newState);
      // Map resize will be handled by onBottomSheetStateChange via its height update
    } else {
      // Desktop sidebar padding update
      if (mapRef.current && mapReady) {
        const targetPaddingLeft = newIsOpen ? DESKTOP_SIDEBAR_WIDTH : 0;
        mapRef.current.easeTo({
          padding: { 
            left: targetPaddingLeft, 
            right: 0, top: 0, bottom: 0 
          },
          duration: 500, 
          easing: cubicBezier(0.4, 0, 0.2, 1),
        });
        // Resize after desktop sidebar animation
        setTimeout(() => mapRef.current?.resize(), 550); // Slightly after animation duration
      }
    }
  };

  const handleBottomSheetStateChange = useCallback((newState: BottomSheetState, heightPx: number) => {
    setCurrentBottomSheetState(newState);
    if (mapRef.current && mapReady && isMobile) {
      mapRef.current.easeTo({
        padding: { 
          left: 0, 
          right: 0, 
          top: MOBILE_SEARCH_BAR_HEIGHT, 
          bottom: heightPx 
        },
        duration: 300, 
        easing: cubicBezier(0.4, 0, 0.2, 1),
      });
      // Resize after bottom sheet animation/padding change
      setTimeout(() => mapRef.current?.resize(), 350); // Slightly after animation duration
    }
    // If sheet is closed by dragging, update isPanelOpen
    if (newState === 'closed' && isPanelOpen) {
        setIsPanelOpen(false);
    }
    // If sheet is opened by dragging (to peek or full) and panel was closed, update isPanelOpen
    if ((newState === 'peek' || newState === 'full') && !isPanelOpen ){
        setIsPanelOpen(true);
    }
  }, [mapReady, isMobile, isPanelOpen]);

  // Auto-scroll the sidebar to the hovered hotel card
  useEffect(() => {
    if (hoveredHotelId === null || !isHoverFromMap) return; // Only scroll when hover is from map
    
    // Small delay to ensure DOM is ready - longer delay on mobile to allow bottom sheet to open
    const scrollDelay = isMobile ? 300 : 50;
    
    setTimeout(() => {
      // Find the hotel card element in the sidebar
      const hotelCard = document.querySelector(`[data-hotel-id="${hoveredHotelId}"]`);
      if (!hotelCard) return;
      
      // Find the parent scrollable container
      const scrollContainer = isMobile 
        ? document.querySelector('.bottom-sheet-content') // For mobile bottom sheet
        : document.querySelector('.overflow-y-auto');     // For desktop sidebar
      
      if (!scrollContainer) return;
      
      // On mobile, position the card at the top
      // On desktop, center the card in the viewport
      hotelCard.scrollIntoView({
        behavior: 'smooth',
        block: isMobile ? 'start' : 'center' // Position at top on mobile, center on desktop
      });
    }, scrollDelay);
  }, [hoveredHotelId, isMobile, isHoverFromMap]);

  const handleViewChange = (newView: ViewMode) => {
    setViewMode(newView);
    if (isMobile && newView === 'map' && !isPanelOpen) {
      // If switching to map view on mobile, and panel is closed, open to peek.
      setIsPanelOpen(true); 
      setCurrentBottomSheetState('peek');
      // The effect in BottomSheet or onBottomSheetStateChange should handle height update for map.
    }
  };

  const initialSheetStateForMobile = isPanelOpen ? 'peek' : 'closed';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-100">
      {/* Mobile Search Bar - Floating & Centered with background */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 pointer-events-none">
          <div className="w-full max-w-md pointer-events-auto">
            <CitySearchInput 
                onSearch={(city: string) => setCurrentCity(city)} 
                isLoading={isLoadingHotels}
                className="bg-white p-3 rounded-xl shadow-xl" // Added bg-white, padding, and more pronounced rounded corners
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            "absolute z-20 border bg-background/95 backdrop-blur-sm",
            "shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
            "transition-all duration-700 ease-in-out",
            "flex flex-col", // Layout children vertically
            viewMode === "list" 
              ? "inset-4 rounded-xl"
              : `left-4 top-4 bottom-4 w-[${DESKTOP_SIDEBAR_WIDTH}px] rounded-3xl`,
            viewMode === 'map' && !isPanelOpen && "-translate-x-full"
          )}
        >
          <div className={cn(
            "p-6 flex items-center space-x-2",
            viewMode === 'map' && isPanelOpen && 'pr-14' 
          )}>
            <CitySearchInput 
                onSearch={(city: string) => setCurrentCity(city)} 
                isLoading={isLoadingHotels}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {viewMode === "list" ? (
              <ListView 
                hotels={hotels}
                isLoading={isLoadingHotels}
                onHotelSelect={handleHotelSelect}
              />
            ) : (
              <HotelListPanel hotels={hotels} onHotelHover={handleHotelHover} onHotelSelect={handleHotelSelect} hoveredHotelId={hoveredHotelId} isMobile={isMobile} />
            )}
          </div>

          {/* Desktop Sidebar Toggle Button - MOVED INSIDE THE ASIDE ELEMENT */}
          {viewMode === 'map' && (
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "absolute top-2 left-[100%] ml-[5px]", // Positioned relative to the sidebar
                "z-30 h-10 w-10 rounded-full",
                "bg-background/95 shadow-lg backdrop-blur-sm hover:bg-background/80",
                "transition-all duration-500 ease-out" // Kept for hover/other transitions
              )}
              onClick={handlePanelToggle}
              disabled={!mapReady}
            >
              <ChevronLeft
                className="h-4 w-4 transition-transform duration-500 ease-out"
                style={{ transform: isPanelOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
              />
            </Button>
          )}
        </aside>
      )}

      {isMobile && (
        <BottomSheet 
          hotels={hotels}
          initialState={initialSheetStateForMobile}
          onStateChange={handleBottomSheetStateChange}
          onHotelSelect={handleHotelSelect}
          onHotelHover={handleHotelHover}
          hoveredHotelId={hoveredHotelId}
        />
      )}

      {/* Map Container - Adjust top for mobile to account for floating search bar area */}
      <div className={cn(
        "absolute inset-0 z-10",
        isMobile ? `top-[${MOBILE_SEARCH_BAR_HEIGHT}px]` : "top-0", // Ensure map content starts below search area
        (viewMode === "list" && !isMobile) && "opacity-20 pointer-events-none"
      )}>
        <MapboxMap 
          hotels={hotels} 
          mapRef={mapRef} 
          hoveredHotelId={hoveredHotelId}
          onMarkerClick={handleHotelSelect}
          onMapLoad={handleMapLoad}
          isMobile={isMobile}
          onMarkerHover={handleMapMarkerHover}
        />
      </div>

      <ViewToggle 
        activeView={viewMode}
        onChange={handleViewChange}
        // Hide ViewToggle on mobile for now, as bottom sheet takes over list functionality
        className={cn(
            "absolute z-30 top-8 right-8 bg-white",
            isMobile && "hidden" 
        )}
      />

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
