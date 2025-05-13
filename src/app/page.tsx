"use client";

// React and Next.js imports
import { useState, useEffect, useCallback, useMemo } from 'react';

// Third-party library imports
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchHotels, type FetchHotelParams, type HotelsApiResponse } from '@/lib/clientHotelService';

// Context imports
import { AppProvider, useAppContext } from '@/app/contexts/AppContext';

// UI component imports
import { Button } from '@/app/components/ui/button';

// Map component imports

// Hotel component imports
import HotelDetailModal from '@/app/components/hotel/HotelDetailModal';

// Filter component imports
import FilterModal from '@/app/components/filter/FilterModal';

// Utility imports
import { cn } from '@/lib/utils';

// Layout Component Imports
import DesktopLayout from '@/app/components/layout/DesktopLayout';
import MobileLayout from '@/app/components/layout/MobileLayout';

// Dynamically imported components

import useFilteredHotels from '@/app/hooks/useFilteredHotels';

function HotelSearchPageContent() {
  const { state, dispatch } = useAppContext();
  const {
    searchIntent: currentIntent,
    activeFilters,
    selectedHotelIdForModal,
    isMobile,
    showSearchAreaButton,
    isPanelOpen
  } = state;

  const [showFilters, setShowFilters] = useState(false);

  // Derive service query parameters
  const queryParams: FetchHotelParams | null = useMemo(() => {
    if (!currentIntent.location) return null;
    const { lat, lng } = currentIntent.location;
    const featureType = currentIntent.searchType === 'hotel' ? 'poi' : 'place';
    const freeText = currentIntent.searchType === 'hotel' ? currentIntent.selectedHotelNameForQuery || undefined : undefined;
    const cityBbox = !currentIntent.needsFresh && state.lastSearchedMapBounds
      ? state.lastSearchedMapBounds
      : !currentIntent.needsFresh && currentIntent.mapboxFeatureBbox
        ? currentIntent.mapboxFeatureBbox
        : null;
    return { lat, lng, searchTerm: currentIntent.searchTerm || undefined, featureType, freeText, cityBbox };
  }, [currentIntent, state.lastSearchedMapBounds]);

  const { 
    data: apiResponse, 
    isLoading,
    isFetching,
    isPlaceholderData,
  } = useQuery<HotelsApiResponse, Error>({
    queryKey: ['hotels', queryParams],
    queryFn: async () => {
      if (!queryParams) {
        return { hotels: [], cityBbox: null } as HotelsApiResponse;
      }
      return fetchHotels(queryParams);
    },
    enabled: !!queryParams,
    retry: 1,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (apiResponse) {
      dispatch({ type: 'API_RESPONSE_RECEIVED', payload: apiResponse as any });
    }
  }, [apiResponse, dispatch]);

  const showSkeletons = isLoading || (isFetching && isPlaceholderData);
  const hotelsFromApi = useMemo(() => apiResponse?.hotels || [], [apiResponse]);
  const matchedHotelFromApi = useMemo(() => apiResponse?.matchedHotel, [apiResponse]);

  const displayedHotels = useFilteredHotels(
    hotelsFromApi,
    activeFilters,
    currentIntent,
    matchedHotelFromApi,
    showSkeletons
  );

  const handleCloseModal = useCallback(() => {
    dispatch({ type: 'CLOSE_HOTEL_MODAL' });
  }, [dispatch]);

  const selectedHotelForUIDetail = selectedHotelIdForModal !== null
    ? displayedHotels.find(h => h.id === selectedHotelIdForModal)
    : null;

  const handleSearchThisAreaClick = useCallback(() => {
    dispatch({ type: 'SEARCH_THIS_AREA' });
  }, [dispatch]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-100">
      {isMobile ? (
        <MobileLayout 
          hotels={displayedHotels} 
          isFetching={isLoading || isFetching} 
          showSkeletons={showSkeletons} 
        />
      ) : (
        <DesktopLayout 
          hotels={displayedHotels} 
          isLoadingQuery={isLoading || isFetching} 
          showSkeletons={showSkeletons} 
        />
      )}

      {selectedHotelForUIDetail && (
        <HotelDetailModal 
          hotel={selectedHotelForUIDetail} 
          onClose={handleCloseModal} 
        />
      )}

      {isMobile && (
        <FilterModal
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          activeFilters={activeFilters}
          onApplyFilters={(newFilters) => {
            dispatch({ type: 'FILTERS_CHANGED', payload: newFilters });
            setShowFilters(false);
          }}
        />
      )}

      {showSearchAreaButton && (
        <div className={cn(
          "absolute z-30 pointer-events-auto",
          isMobile ? "top-[15vh]" : "top-[2vh]", 
          isPanelOpen && !isMobile ? "left-[66.66%] -translate-x-1/2" : "left-1/2 -translate-x-1/2"
        )}>
          <Button
            onClick={handleSearchThisAreaClick}
            variant="secondary"
            className="bg-background/95 hover:bg-background/80 text-foreground font-semibold py-2 px-4 border border-border rounded-full shadow-xl backdrop-blur-sm"
            disabled={isLoading || isFetching}
          >
            Search this area
          </Button>
        </div>
      )}
    </div>
  );
}

export default function HotelSearchPage() {
  return (
    <AppProvider>
      <HotelSearchPageContent />
    </AppProvider>
  );
}
