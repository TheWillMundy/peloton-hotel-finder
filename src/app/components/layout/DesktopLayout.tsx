import React, { useCallback, memo, useRef, useEffect } from 'react';
import { useAppContext } from '@/app/contexts/AppContext';
import HotelListPanel from '@/app/components/hotel/HotelListPanel';
import MapWrapper from '../map/MapWrapper';
import { Button } from '@/app/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Filters } from '@/app/components/filter/FilterChips';
import dynamic from 'next/dynamic';
const CitySearchInput = dynamic(() => import('@/app/components/search/CitySearchInput'), { ssr: false });

interface DesktopLayoutProps {
  showSkeletons: boolean;
  isLoadingQuery: boolean; // Receive loading state from page.tsx
}

function DesktopLayout({ showSkeletons, isLoadingQuery }: DesktopLayoutProps) {
  const { state, dispatch } = useAppContext();
  const {
    searchIntent,
    activeFilters,
    isPanelOpen,
    hoveredHotelId,
    hoverSource,
    hotels
  } = state;

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the hovered hotel when hovering on map
  useEffect(() => {
    if (hoveredHotelId && hoverSource === 'map' && scrollContainerRef.current && isPanelOpen) {
      const hotelElement = scrollContainerRef.current.querySelector(`[data-hotel-id="${hoveredHotelId}"]`);
      if (hotelElement) {
        hotelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [hoveredHotelId, hoverSource, isPanelOpen]);

  const handlePanelToggle = () => {
    dispatch({ type: 'SET_PANEL_OPEN', payload: !isPanelOpen });
  };

  const handleNewSearchLocation = useCallback((feature: any) => {
    dispatch({ type: 'LOCATION_SELECTED', payload: feature });
  }, [dispatch]);

  const currentCityNameForSearch = searchIntent.originalSelectedFeature?.placeName || searchIntent.searchTerm || '';

  return (
    <>
      <aside
        className={cn(
          "absolute z-20 border bg-background/95 backdrop-blur-sm",
          "shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
          "transition-all duration-700 ease-in-out",
          "flex flex-col",
          "left-4 top-4 bottom-4 w-1/3 rounded-3xl",
          !isPanelOpen && "-translate-x-full"
        )}
      >
        <div className={cn(
          "p-6 flex items-center space-x-2",
          isPanelOpen && 'pr-14'
        )}>
          <CitySearchInput
            onLocationRetrieved={handleNewSearchLocation}
            onNoResultsFound={() => {}}
            isLoading={isLoadingQuery}
            className="w-full"
            initialValue={currentCityNameForSearch}
          />
        </div>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-2">
          <HotelListPanel
            hotels={hotels || []}
            onHotelSelect={(hotel) => dispatch({ type: 'HOTEL_SELECTED', payload: { id: hotel.id, source: 'list' } })}
            isMobile={false}
            activeFilters={activeFilters as Filters}
            onFiltersChange={(newFilters) => dispatch({ type: 'FILTERS_CHANGED', payload: newFilters })}
            onMobileFilterButtonClick={() => {}}
            hasSearched={!!searchIntent.location}
            showSkeletons={showSkeletons}
          />
        </div>
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute top-2 left-[100%] ml-[5px]",
            "z-30 h-10 w-10 rounded-full",
            "bg-background/95 shadow-lg backdrop-blur-sm hover:bg-background/80",
            "transition-all duration-500 ease-out"
          )}
          onClick={handlePanelToggle}
        >
          <ChevronLeft
            className="h-4 w-4 transition-transform duration-500 ease-out"
            style={{ transform: isPanelOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </Button>
      </aside>

      <div className="absolute inset-0 z-10">
        <MapWrapper />
      </div>
    </>
  );
}

export default memo(DesktopLayout); 