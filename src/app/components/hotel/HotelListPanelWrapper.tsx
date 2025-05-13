import React, { memo } from 'react';
import { useAppContext } from '@/app/contexts/AppContext';
import HotelListPanel from '@/app/components/hotel/HotelListPanel';
import type { Filters } from '@/app/components/filter/FilterChips';
import type { ClientHotel } from '@/lib/pelotonAPI';

interface HotelListPanelWrapperProps {
  hotels: ClientHotel[]; // Filtered hotels array
  showSkeletons: boolean;
}

const HotelListPanelWrapper: React.FC<HotelListPanelWrapperProps> = ({ hotels, showSkeletons }) => {
  const { state, dispatch } = useAppContext();
  const {
    searchIntent,
    activeFilters,
    isMobile
  } = state;

  return (
    <HotelListPanel
      hotels={hotels}
      onHotelSelect={(hotel) => dispatch({ type: 'HOTEL_SELECTED', payload: { id: hotel.id, source: 'list' } })}
      isMobile={isMobile}
      activeFilters={activeFilters as Filters}
      onFiltersChange={(newFilters) => dispatch({ type: 'FILTERS_CHANGED', payload: newFilters })}
      onMobileFilterButtonClick={() => { /* TODO: Trigger filter modal open? */ }}
      hasSearched={!!searchIntent.location}
      showSkeletons={showSkeletons}
    />
  );
};

export default memo(HotelListPanelWrapper); 