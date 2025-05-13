import React, { useState, useRef, useCallback, memo } from 'react';
import { useAppContext } from '@/app/contexts/AppContext';
import MapWrapper from '@/app/components/map/MapWrapper';
import BottomSheet, { BottomSheetHandle, BottomSheetState } from '@/app/components/ui/BottomSheet';
import FilterPanel from '@/app/components/filter/FilterPanel';
import FilterModal from '@/app/components/filter/FilterModal';
import { cn } from '@/lib/utils';
import type { ClientHotel } from '@/lib/pelotonAPI';

// Dynamically imported CitySearchInput (to match page.tsx)
import dynamic from 'next/dynamic';
const CitySearchInput = dynamic(() => import('@/app/components/search/CitySearchInput'), { ssr: false });

interface MobileLayoutProps {
  hotels: ClientHotel[];
  isFetching: boolean;
  showSkeletons: boolean;
}

const MOBILE_SEARCH_BAR_HEIGHT = 60;

function MobileLayout({ hotels, isFetching, showSkeletons }: MobileLayoutProps) {
  const { state, dispatch } = useAppContext();
  const {
    searchIntent,
    activeFilters,
    isPanelOpen,
  } = state;

  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const bottomSheetRef = useRef<BottomSheetHandle | null>(null);

  const handleNewSearchLocation = useCallback((feature: any) => {
    dispatch({ type: 'LOCATION_SELECTED', payload: feature });
  }, [dispatch]);

  const handleBottomSheetStateChange = useCallback((newState: BottomSheetState) => {
    dispatch({ type: 'SET_BOTTOM_SHEET_STATE', payload: newState });
    if (newState === 'closed' && isPanelOpen) {
      dispatch({ type: 'SET_PANEL_OPEN', payload: false });
    }
    if ((newState === 'peek' || newState === 'full') && !isPanelOpen) {
      dispatch({ type: 'SET_PANEL_OPEN', payload: true });
    }
  }, [dispatch, isPanelOpen]);

  const initialSheetStateForMobile = isPanelOpen ? 'peek' : 'closed';
  const currentCityNameForSearch = searchIntent.rawMapboxFeature?.placeName || searchIntent.searchTerm || '';

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto flex items-center gap-2">
          <div className="flex-1">
            <CitySearchInput
              onLocationRetrieved={handleNewSearchLocation}
              onNoResultsFound={() => {}}
              isLoading={isFetching}
              className="bg-white p-3 rounded-xl shadow-xl w-full"
              initialValue={currentCityNameForSearch}
            />
          </div>
          <FilterPanel
            isMobile
            activeFilters={activeFilters}
            onFiltersChange={() => setShowFiltersModal(true)}
          />
        </div>
      </div>

      <BottomSheet
        ref={bottomSheetRef}
        initialState={initialSheetStateForMobile}
        onStateChange={handleBottomSheetStateChange}
        hotels={hotels}
        showSkeletons={showSkeletons}
        onHotelSelect={(hotel) => dispatch({ type: 'HOTEL_SELECTED', payload: { id: hotel.id, source: 'list' } })}
        hasSearched={!!searchIntent.location}
        hasActiveFilters={activeFilters.inRoom || activeFilters.inGym || activeFilters.loyaltyPrograms.length > 0}
        onClearFilters={() => dispatch({ type: 'FILTERS_CHANGED', payload: { inRoom: false, inGym: false, loyaltyPrograms: [] } })}
      />

      <div className={cn(
        "absolute inset-0 z-10",
        `top-[${MOBILE_SEARCH_BAR_HEIGHT}px]`
      )}>
        <MapWrapper hotels={hotels} showSkeletons={showSkeletons} />
      </div>

      <FilterModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        activeFilters={activeFilters}
        onApplyFilters={(newFilters) => {
          dispatch({ type: 'FILTERS_CHANGED', payload: newFilters });
          setShowFiltersModal(false);
        }}
      />
    </>
  );
}

export default memo(MobileLayout); 