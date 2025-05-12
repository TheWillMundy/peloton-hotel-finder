"use client";

import { useState, useMemo } from 'react';
import { ClientHotel } from '@/lib/pelotonAPI';
import HotelResultCard from './HotelResultCard';
import { Button } from '@/app/components/ui/button';
import { useUIInteraction } from '@/app/contexts/UIInteractionContext';

interface ListViewProps {
  hotels: ClientHotel[];
  isLoading: boolean;
  onHotelSelect?: (hotel: ClientHotel) => void;
}

export default function ListView({ hotels, isLoading, onHotelSelect }: ListViewProps) {
  const [visibleItemsCount, setVisibleItemsCount] = useState(10);
  const { uiState, setActiveHotel, clearActiveHotel } = useUIInteraction();
  
  const displayedHotels = useMemo(() => {
    return hotels.slice(0, visibleItemsCount);
  }, [hotels, visibleItemsCount]);

  const hasMoreItems = visibleItemsCount < hotels.length;

  const loadMore = () => {
    setVisibleItemsCount(prev => Math.min(prev + 10, hotels.length));
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <div className="animate-pulse flex flex-col space-y-4 w-full max-w-3xl">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-200 rounded-lg w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (hotels.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No hotels found with Peloton bikes.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto">
      <div className="grid gap-4 mx-auto">
        {displayedHotels.map(hotel => (
          <HotelResultCard 
            key={hotel.id} 
            hotel={hotel} 
            onClick={onHotelSelect}
            isActive={hotel.id === uiState.activeHotelId}
            onMouseEnter={() => setActiveHotel(hotel.id, 'sidebar_hover')}
            onMouseLeave={() => clearActiveHotel()}
          />
        ))}
        
        {hasMoreItems && (
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={loadMore}
          >
            Load More ({hotels.length - visibleItemsCount} remaining)
          </Button>
        )}
      </div>
    </div>
  );
} 