"use client";

import React, { memo } from 'react';
import { ClientHotel } from '@/lib/pelotonAPI';
import HotelCard from '@/app/components/hotel/HotelCard';
import HotelCardSkeleton from '@/app/components/hotel/HotelCardSkeleton';
import { useAppContext } from '@/app/contexts/AppContext';
import FilterPanel from '@/app/components/filter/FilterPanel';
import type { Filters } from '@/app/components/filter/FilterChips';

// Renaming SearchPanelPlaceholder to HotelListPanel for clarity
const HotelListPanel = ({
  onHotelSelect,
  hotels,
  isMobile = false,
  activeFilters,
  onFiltersChange,
  onMobileFilterButtonClick,
  hasSearched = false,
  showSkeletons = false
}: {
  onHotelSelect: (hotel: ClientHotel) => void;
  hotels: ClientHotel[];
  isMobile?: boolean;
  activeFilters: Filters;
  onFiltersChange: (newFilters: Filters) => void;
  onMobileFilterButtonClick: () => void;
  hasSearched?: boolean;
  showSkeletons?: boolean;
}) => {
  const { state, dispatch } = useAppContext();
  const { hoveredHotelId, targetHotelId, highlightType } = state;

  const hasActiveFilters = activeFilters.inRoom || activeFilters.inGym || activeFilters.loyaltyPrograms.length > 0;

  // Determine if any card in the list is considered "focused" (either by hover or search match)
  const isAnyCardHovered = hoveredHotelId !== null;
  const isAnyCardSearchFocused = highlightType === 'match_found' && targetHotelId !== null && hoveredHotelId === null;
  const finalIsAnyListItemFocused = isAnyCardHovered || isAnyCardSearchFocused;

  // Show skeletons during loading
  if (showSkeletons) {
    return (
      <div className="p-4 space-y-3">
        {!isMobile && (
          <FilterPanel
            activeFilters={activeFilters}
            onFiltersChange={onFiltersChange}
          />
        )}
        
        {isMobile && (
          <div className="pb-3">
            <FilterPanel
              isMobile
              activeFilters={activeFilters}
              onFiltersChange={onMobileFilterButtonClick}
            />
          </div>
        )}
        
        <div className="text-sm text-gray-500 py-2">
          Searching for hotels...
        </div>
        
        <HotelCardSkeleton />
        <HotelCardSkeleton />
        <HotelCardSkeleton />
      </div>
    );
  }

  if (hotels.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="text-center text-gray-500 py-4">
          <p>No hotels match your current filters.</p>
          <button 
            className="text-primary text-sm font-medium mt-1"
            onClick={() => onFiltersChange({ inRoom: false, inGym: false, loyaltyPrograms: [] })}
          >
            Clear all filters
          </button>
        </div>
      );
    }
    
    if (hasSearched) {
      return (
        <div className="p-4 text-center text-gray-500">
          <p>No hotels with Peloton bikes found in this area.</p>
          <p className="text-sm mt-1">Try searching for a different city or hotel.</p>
        </div>
      );
    }
    
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Welcome to Peloton Hotel Finder! Search for a city or hotel to find Peloton bikes nearby.</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-3">
        {/* Desktop Filter Panel */}
        {!isMobile && (
          <FilterPanel
            activeFilters={activeFilters}
            onFiltersChange={onFiltersChange}
          />
        )}

        {/* Mobile Filter Button - when in mobile mode */}
        {isMobile && (
          <div className="pb-3">
            <FilterPanel
              isMobile
              activeFilters={activeFilters}
              onFiltersChange={onMobileFilterButtonClick}
            />
          </div>
        )}

        {/* Show filtered results count if filters are active */}
        {hasActiveFilters && hotels.length > 0 && (
          <div className="pb-2 text-sm text-gray-500">
            Showing {hotels.length} hotel(s) matching your filters.
          </div>
        )}

        {/* Hotel List */}
        {hotels.map(hotel => {
          const isCardHovered = hotel.id === hoveredHotelId;
          const isCardFocusedBySearch = 
            highlightType === 'match_found' && 
            hotel.id === targetHotelId && 
            hoveredHotelId === null; // Only true if no active hover

          return (
            <HotelCard 
              key={hotel.id} 
              hotel={hotel} 
              onHover={(id, lat, lng) => 
                dispatch({ 
                  type: 'HOTEL_HOVERED', 
                  payload: { id, source: 'sidebar', lat, lng } 
                })
              }
              onClick={() => onHotelSelect(hotel)}
              isHovered={isCardHovered}
              isFocusedBySearch={isCardFocusedBySearch}
              isAnyListItemFocused={finalIsAnyListItemFocused}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </>
  );
};

export default memo(HotelListPanel); 