"use client";

import HotelCard from '@/app/components/HotelCard';
import type { ClientHotel } from '@/lib/pelotonAPI';

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

export default HotelListPanel; 