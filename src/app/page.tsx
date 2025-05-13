"use client";

// React and Next.js imports
import { useState, useCallback } from 'react';

// Context imports
import { AppProvider, useAppContext } from '@/app/contexts/AppContext';

// UI component imports
import { Button } from '@/app/components/ui/button';

// Hotel component imports
import HotelDetailModal from '@/app/components/hotel/HotelDetailModal';

// Filter component imports
import FilterModal from '@/app/components/filter/FilterModal';

// Utility imports
import { cn } from '@/lib/utils';

// Layout Component Imports
import DesktopLayout from '@/app/components/layout/DesktopLayout';
import MobileLayout from '@/app/components/layout/MobileLayout';

// Custom hooks
import useFilteredHotels from '@/app/hooks/useFilteredHotels';
import useHotelsQuery from '@/app/hooks/useHotelsQuery';

function HotelSearchPageContent() {
  const { state, dispatch } = useAppContext();
  const {
    searchIntent: currentIntent,
    activeFilters,
    selectedHotelIdForModal,
    isMobile,
    showSearchAreaButton,
    isPanelOpen,
    hotels: hotelsFromContext
  } = state;

  const [showFilters, setShowFilters] = useState(false);

  // Use the custom hook for React Query
  const { 
    isLoading,
    isFetching,
    isPlaceholderData,
    matchedHotel
  } = useHotelsQuery();

  const showSkeletons = isLoading || (isFetching && isPlaceholderData);
  
  // Use hotels from context instead of from query directly
  const displayedHotels = useFilteredHotels(
    hotelsFromContext || [],
    activeFilters,
    currentIntent,
    matchedHotel,
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
          isFetching={isLoading || isFetching} 
          showSkeletons={showSkeletons} 
        />
      ) : (
        <DesktopLayout 
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
