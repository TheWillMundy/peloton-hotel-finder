"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, FilterIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import MapboxMap from '@/app/components/MapboxMap';
import { MapProvider, useMapContext } from '@/app/contexts/MapContext';
import type { MapboxGeocodingFeature } from '@/app/components/CitySearchInput';
import type { Map as MapboxMapType } from 'mapbox-gl';
import { useQuery } from '@tanstack/react-query';
import HotelCard from '@/app/components/HotelCard';
import ListView from '@/app/components/ListView';
import ViewToggle, { ViewMode } from '@/app/components/ViewToggle';
import { ClientHotel } from '@/lib/pelotonAPI';
import { ViewModeProvider, useViewMode } from '@/app/contexts/ViewModeContext';
import HotelDetailModal from '@/app/components/HotelDetailModal';
import BottomSheet, { BottomSheetState } from '@/app/components/BottomSheet';
import { FilterChips, Filters } from '@/app/components/FilterChips';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

// Dynamically import MapboxSearchInput with SSR turned off
const DynamicMapboxSearchInput = dynamic(
  () => import('@/app/components/CitySearchInput'),
  { ssr: false, loading: () => <p className="p-3 rounded-xl shadow-xl w-full bg-gray-200 animate-pulse">Loading Search...</p> } // Optional loading component
);

// Define primary loyalty programs, could also be imported from FilterChips if kept there
const PRIMARY_LOYALTY_PROGRAMS = [
  "Accor Le Club", "Best Western Rewards", "Choice Privileges", "Hilton Honors", 
  "IHG Rewards Club", "Marriott Bonvoy", "Radisson Rewards", "World of Hyatt", "Wyndham Rewards"
];

const MOBILE_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 420;
const MOBILE_SEARCH_BAR_HEIGHT = 60; // Approximate height for the search bar on mobile

// export interface Filters { // Temporary definition - REMOVED as it's now imported
//   inRoom: boolean;
//   inGym: boolean;
//   loyaltyPrograms: string[];
// }

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
  const [selectedLocation, setSelectedLocation] = useState<MapboxGeocodingFeature | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initialPaddingSet, setInitialPaddingSet] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<ClientHotel | null>(null);
  const [showFilters, setShowFilters] = useState(false); // State to toggle filter display
  const [isHotelSearch, setIsHotelSearch] = useState(false); // True when user selects a lodging result

  const [activeFilters, setActiveFilters] = useState<Filters>({
    inRoom: false,
    inGym: false,
    loyaltyPrograms: [],
  });
  
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
    cityCenter?: [number, number]; // Lng, Lat from API response
    matchedHotel?: ClientHotel | null; // Optional matched hotel for hotel searches
    matchConfidence?: number | null;     // Optional confidence score for fuzzy match
  }

  // Actual TanStack Query for fetching hotels
  const { 
    data: apiResponse, 
    isLoading: isLoadingHotels, 
    isError: isFetchError, 
    error: fetchError,
    isSuccess: isFetchSuccess,
  } = useQuery<HotelsApiResponse, Error>({ 
    queryKey: ['hotels', selectedLocation?.lat, selectedLocation?.lng, selectedLocation?.placeName, JSON.stringify(selectedLocation?.mapboxBbox), isHotelSearch],
    queryFn: async () => {
      if (!selectedLocation) return { hotels: [], cityCenter: undefined };
      
      const { lat, lng, placeName, mapboxBbox, featureType, hotelName } = selectedLocation;
      let apiUrl = `/api/hotels?lat=${lat}&lng=${lng}&searchTerm=${encodeURIComponent(placeName)}`;
      if (mapboxBbox) {
        apiUrl += `&mapboxBbox=${encodeURIComponent(JSON.stringify(mapboxBbox))}`;
      }
      if (featureType) {
        apiUrl += `&featureType=${encodeURIComponent(featureType)}`;
      }
      if (isHotelSearch) {
        // Prioritize specific hotelName for freeText if available, else fallback to placeName
        const textForFuzzyMatch = hotelName && hotelName.trim() !== '' ? hotelName : placeName;
        apiUrl += `&freeText=${encodeURIComponent(textForFuzzyMatch)}`;
      }

      // Log the URL and whether this is a hotel search
      console.log('[HotelsQuery] fetching', { apiUrl, isHotelSearch });

      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error fetching hotels" }));
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      const data: HotelsApiResponse = await response.json(); 

      // Log summary of the response
      console.log('[HotelsQuery] response', { hotelsCount: data.hotels.length, matchedHotelId: data.matchedHotel?.id, matchConfidence: data.matchConfidence });
      return data;
    },
    enabled: !!selectedLocation, // Only run query if a location is selected
    retry: 1,
  });

  useEffect(() => {
    if (isFetchSuccess && apiResponse) {
      // Default behavior: display all hotels and center map on city
      setHotels(apiResponse.hotels || []);
      if (apiResponse.cityCenter) {
        setCenter(apiResponse.cityCenter); // [lng, lat]
      }
    } else if (isFetchError && fetchError) {
      console.error("Failed to fetch hotels:", fetchError.message);
      setHotels([]); // Clear hotels on error
      // Removed generic error toast; toasts handled in hotel search effect
    }
    // Intentionally excluding setCenter from deps array to avoid potential loops 
    // if setCenter itself causes a re-render that refetches. 
    // The map component effect handles flying to the new center.
  }, [isFetchSuccess, apiResponse, isFetchError, fetchError, setCenter]); 

  // Handle hotel search: fly to matched hotel or show error + nearby results
  useEffect(() => {
    if (isFetchSuccess && apiResponse && isHotelSearch) {
      const matchedHotel = apiResponse.matchedHotel;
      const allHotels = apiResponse.hotels || [];
      const cityCenter = apiResponse.cityCenter;
      
      if (matchedHotel) {
        // Happy Case: Good confidence match
        mapRef.current?.easeTo({ center: [matchedHotel.lng, matchedHotel.lat], zoom: 12 });
        setHoveredHotelId(matchedHotel.id);
        // Ensure displayedHotels reflects this primary match first
        setHotels([matchedHotel, ...allHotels.filter(h => h.id !== matchedHotel.id)]);
      } else {
        // Sad Case: No hotel matched (server decided quality was too low)
        const targetCenter = cityCenter || [selectedLocation?.lng || 0, selectedLocation?.lat || 0];
        mapRef.current?.easeTo({ center: targetCenter, zoom: 10 });
        toast.info('No Peloton available at that specific hotel. Showing nearby options.');
        setHotels(allHotels); // Show all hotels for the area
        setHoveredHotelId(null); // Clear any potentially sticky hover state
      }
    }
  }, [isFetchSuccess, apiResponse, isHotelSearch, selectedLocation, setCenter, setHotels, setHoveredHotelId]);

  const filterChipOptions = useMemo(() => {
    if (!hotels) return [...PRIMARY_LOYALTY_PROGRAMS, "Other"]; // Default list if no hotels
    
    const options = new Set<string>([...PRIMARY_LOYALTY_PROGRAMS]);

    let hasActualOther = false;
    hotels.forEach(hotel => {
      if (hotel.loyaltyProgram === "Other") {
        hasActualOther = true;
        if (hotel.brand && !PRIMARY_LOYALTY_PROGRAMS.includes(hotel.brand)) {
          // If it's 'Other' and the original brand isn't a known main program, add the specific brand
          options.add(hotel.brand);
        }
      } else if (hotel.loyaltyProgram && !PRIMARY_LOYALTY_PROGRAMS.includes(hotel.loyaltyProgram)){
        // This case handles if getLoyaltyProgram returned the brand_name itself because it wasn't in brandToLoyaltyMap
        options.add(hotel.loyaltyProgram);
      }
      // else, it's a primary program, already added
    });

    if (hasActualOther || hotels.some(h => h.loyaltyProgram === "Other")) {
        options.add("Other"); // Ensure "Other" is present if there are any 'Other' hotels
    }
    
    return Array.from(options).sort((a, b) => {
        // Keep "Other" at the end
        if (a === "Other") return 1;
        if (b === "Other") return -1;
        return a.localeCompare(b);
    });
  }, [hotels]);

  const displayedHotels = useMemo(() => {
    // When user searched a specific hotel, show matched hotel first without resorting
    if (isHotelSearch && apiResponse?.matchedHotel) {
      return [apiResponse.matchedHotel, ...hotels.filter(h => h.id !== apiResponse.matchedHotel!.id)];
    }
    // console.log('[page.tsx useMemo displayedHotels] Input hotels:', hotels?.length);
    let filtered = [...hotels];

    // Apply loyalty program filters
    if (activeFilters.loyaltyPrograms.length > 0) {
      filtered = filtered.filter(hotel => {
        return activeFilters.loyaltyPrograms.some(filterProgram => {
          if (filterProgram === "Other") {
            return hotel.loyaltyProgram === "Other";
          }
          // If the filterProgram is a known primary loyalty program
          if (PRIMARY_LOYALTY_PROGRAMS.includes(filterProgram)) {
            return hotel.loyaltyProgram === filterProgram;
          }
          // If the filterProgram is a specific brand (that was mapped to 'Other' or was a direct fallback)
          return hotel.brand === filterProgram && 
                 (hotel.loyaltyProgram === "Other" || hotel.loyaltyProgram === hotel.brand);
        });
      });
    }

    // Apply bike location filters
    if (activeFilters.inRoom) {
      filtered = filtered.filter(hotel => hotel.in_room);
    }
    if (activeFilters.inGym) {
      // If inRoom is also selected, this acts as an AND.
      // If only inGym is selected, it finds hotels with in_gym (could also be in_room).
      // If the intent is "only in gym and not in room", the logic would need adjustment.
      // Current: shows if it has gym bikes, regardless of room bikes if inGym is true.
      filtered = filtered.filter(hotel => hotel.in_gym);
    }

    // Sorting
    filtered.sort((a, b) => {
      // 1. In-room bikes (true first)
      if (a.in_room !== b.in_room) {
        return a.in_room ? -1 : 1;
      }
      // 2. In-gym bikes (true first)
      if (a.in_gym !== b.in_gym) {
        return a.in_gym ? -1 : 1;
      }
      // 3. Distance (ascending, nulls last)
      if (a.distance_m === null) return 1;
      if (b.distance_m === null) return -1;
      return a.distance_m - b.distance_m;
    });

    return filtered;
  }, [hotels, activeFilters, isHotelSearch, apiResponse?.matchedHotel]);

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
        // RE-ENABLE full logic for initial mobile padding
        if (isPanelOpen) { 
          const peekVh = 25; // Corresponds to PEEK_HEIGHT_VH in BottomSheet
          PADDING_BOTTOM = (peekVh * window.innerHeight) / 100;
          setCurrentBottomSheetState('peek');
        } else {
          setCurrentBottomSheetState('closed');
        }
      }

      const basePadding = {
        left: !isMobile && isPanelOpen ? DESKTOP_SIDEBAR_WIDTH : 0,
        right: 0,
        top: isMobile ? MOBILE_SEARCH_BAR_HEIGHT : 0
      };
      mapRef.current.easeTo({ padding: { ...basePadding, bottom: PADDING_BOTTOM }, duration: 0 });
      setInitialPaddingSet(true);
      // Resize after initial padding
      setTimeout(() => mapRef.current?.resize(), 50); 
    }
  }, [mapReady, isPanelOpen, initialPaddingSet, isMobile, setCurrentBottomSheetState]);

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
    } else {
      // Desktop sidebar padding update
      if (mapRef.current && mapReady) {
        const targetPaddingLeft = newIsOpen ? DESKTOP_SIDEBAR_WIDTH : 0;
        const basePadding = { left: targetPaddingLeft, right: 0, top: 0 };
        mapRef.current.easeTo({ padding: { ...basePadding, bottom: 0 }, duration: 500, easing: cubicBezier(0.4, 0, 0.2, 1) });
        // Resize after desktop sidebar animation
        setTimeout(() => mapRef.current?.resize(), 550); // Slightly after animation duration
      }
    }
  };

  const handleBottomSheetStateChange = useCallback((newState: BottomSheetState, heightPx: number) => {
    setCurrentBottomSheetState(newState);

    if (mapRef.current && mapReady && isMobile) {
      const basePadding = { left: 0, right: 0, top: MOBILE_SEARCH_BAR_HEIGHT };
      mapRef.current.easeTo({ padding: { ...basePadding, bottom: heightPx }, duration: 300, easing: cubicBezier(0.4, 0, 0.2, 1) });
      setTimeout(() => mapRef.current?.resize(), 350); 
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
    }
  };

  const initialSheetStateForMobile = isPanelOpen ? 'peek' : 'closed';

  // This function is called when MapboxSearchInput successfully retrieves a location
  const handleLocationRetrieved = (feature: MapboxGeocodingFeature) => {
    // Check featureType for 'poi' or category for 'lodging'
    const isLodgingSearch = feature.featureType === 'poi';
    console.log('[handleLocationRetrieved] feature:', feature, 'isLodgingSearch:', isLodgingSearch); // Added log
    setIsHotelSearch(isLodgingSearch);
    setSelectedLocation(feature);
    setActiveFilters({ inRoom: false, inGym: false, loyaltyPrograms: [] });
    setShowFilters(false); // Hide filters on new search
  };

  const handleNoResultsFound = () => {
    // TODO: Implement UI feedback for no results from geocoding
    console.warn("No geocoding results found from MapboxSearchInput.");
    // Optionally clear hotels or show a message
    // setHotels([]);
    // toast({ title: "Search", description: "No locations found for your query.", variant: "default" });
  };

  const listViewContent = (
    <ListView 
      hotels={displayedHotels}
      isLoading={isLoadingHotels}
      onHotelSelect={handleHotelSelect}
    />
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-100">
      {/* Mobile Search Bar - Floating & Centered with background */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 pointer-events-none">
          <div className="w-full max-w-md pointer-events-auto">
            <DynamicMapboxSearchInput
              onLocationRetrieved={handleLocationRetrieved}
              onNoResultsFound={handleNoResultsFound}
              isLoading={isLoadingHotels} 
              className="bg-white p-3 rounded-xl shadow-xl w-full"
              initialValue={selectedLocation?.placeName || ''}
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
            <DynamicMapboxSearchInput
              onLocationRetrieved={handleLocationRetrieved}
              onNoResultsFound={handleNoResultsFound}
              isLoading={isLoadingHotels} 
              className="w-full" 
              initialValue={selectedLocation?.placeName || ''}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {viewMode === "list" ? (
              <ListView 
                hotels={displayedHotels}
                isLoading={isLoadingHotels}
                onHotelSelect={handleHotelSelect}
              />
            ) : (
              <HotelListPanel 
                hotels={displayedHotels}
                onHotelHover={handleHotelHover} 
                onHotelSelect={handleHotelSelect} 
                hoveredHotelId={hoveredHotelId} 
                isMobile={isMobile} 
              />
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
          hotels={displayedHotels} 
          mapRef={mapRef} 
          hoveredHotelId={hoveredHotelId}
          onMarkerClick={handleHotelSelect}
          onMapLoad={handleMapLoad}
          isMobile={isMobile}
          onMarkerHover={handleMapMarkerHover}
          mapReady={mapReady}
        />
      </div>

      <ViewToggle 
        activeView={viewMode}
        onChange={handleViewChange}
        className={cn(
            "absolute z-30 top-8 right-8 bg-white shadow-md rounded-md p-1" // Adjusted styling, ensure visibility
            // isMobile && "hidden" // Removed to keep toggle visible on mobile
        )}
      />

      {selectedHotel && (
        <HotelDetailModal 
          hotel={selectedHotel} 
          onClose={handleCloseModal} 
        />
      )}

      {/* List View (Full Screen on Mobile, Overlay on Desktop) */}
      {viewMode === 'list' && (
        <div className={cn(
          "fixed inset-0 z-30 bg-white dark:bg-gray-900 md:inset-4 md:rounded-xl md:shadow-2xl overflow-y-auto",
          isMobile ? "pt-16" : "pt-4" // Adjust top padding for search bar space
        )}>
          <div className={cn(
            "sticky top-0 bg-white dark:bg-gray-900 z-10 px-4 pt-4 pb-2 md:pb-4",
            isMobile ? "fixed w-full top-0 left-0 right-0 shadow-md" : ""
          )}>
             <div className="flex items-center justify-between">
                <DynamicMapboxSearchInput
                  onLocationRetrieved={handleLocationRetrieved}
                  onNoResultsFound={handleNoResultsFound}
                  isLoading={isLoadingHotels} 
                  className="flex-grow" 
                  initialValue={selectedLocation?.placeName || ''}
                />
                 <Button variant="ghost" size="icon" onClick={() => setShowFilters(!showFilters)} className="ml-2">
                  <FilterIcon className="h-5 w-5" />
                </Button>
              </div>
              {showFilters && (
                 <div className="mt-2">
                   <FilterChips activeFilters={activeFilters} onFilterChange={setActiveFilters} availableLoyaltyPrograms={filterChipOptions} />
                </div>
              )}
          </div>
          <div className={isMobile ? "mt-10 md:mt-0" : ""}> {/* Add margin-top for mobile to account for fixed search bar */} 
            {listViewContent}
          </div>
        </div>
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
