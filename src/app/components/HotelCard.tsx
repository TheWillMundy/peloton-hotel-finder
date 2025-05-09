"use client";

import React from 'react';
import { ClientHotel } from '@/lib/pelotonAPI';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';

interface HotelCardProps {
  hotel: ClientHotel;
  onHover?: (hotelId: number | null) => void;
  onClick?: (hotel: ClientHotel) => void;
  isHovered?: boolean;
  isAnyHovered?: boolean;
  isMobile?: boolean;
}

const HotelCard: React.FC<HotelCardProps> = ({ 
  hotel, 
  onHover, 
  onClick, 
  isHovered = false,
  isAnyHovered = false,
  isMobile = false
}) => {
  const handleMouseEnter = () => {
    if (onHover) onHover(hotel.id);
  };

  const handleMouseLeave = () => {
    if (onHover) onHover(null);
  };

  const handleClick = () => {
    if (onClick) onClick(hotel);
  };

  // Feature icons mapping - improved with descriptive emojis
  const getFeatureIcon = (feature: string) => {
    switch (feature.toLowerCase()) {
      case 'bike weights':
        return { icon: '⚖️', tooltip: 'Peloton bike includes weights' };
      case 'dual-sided spd pedals':
        return { icon: '👟', tooltip: 'Dual-sided SPD pedals compatible with cycling shoes' };
      case 'bike screen':
        return { icon: '📱', tooltip: 'Bike includes a screen for classes' };
      default:
        return { icon: '✓', tooltip: feature };
    }
  };

  return (
    <div 
      className={cn(
        "bg-white border rounded-lg p-3 transition-all duration-300 cursor-pointer relative",
        !isMobile && isHovered 
          ? "shadow-lg bg-blue-50/50 z-10 opacity-100 scale-[1.02]"
          : !isMobile && isAnyHovered 
            ? "border-gray-200 hover:shadow-md hover:border-gray-300 opacity-70"
            : "border-gray-200 hover:shadow-md hover:border-gray-300 opacity-100"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-hotel-id={hotel.id}
    >
      {/* Blue vertical line on the right when hovered */}
      {!isMobile && isHovered && (
        <div className="absolute top-0 bottom-0 right-0 w-2 bg-blue-500 rounded-r-lg"></div>
      )}
      <div className="flex items-start gap-3">
        {/* Bike Count Circle - moved to left */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-blue-700 font-semibold">{hotel.total_bikes}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Hotel Name */}
          <h3 className="text-base font-semibold text-gray-800 leading-tight truncate" title={hotel.name}>
            {hotel.name}
          </h3>
          
          {/* Brand Badge (if available) */}
          {hotel.brand ? (
            <Badge variant="outline" className="mt-1 text-xs bg-gray-50">
              {hotel.brand}
            </Badge>
          ) : (
            <Badge variant="outline" className="mt-1 text-xs border-dashed border-gray-300 bg-gray-50 text-gray-500">
              Independent
            </Badge>
          )}
        </div>
      </div>

      {/* All indicators and features in one line */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {/* Location Indicators */}
        <div className="flex items-center text-xs">
          <div className={cn(
            "w-2 h-2 rounded-full mr-1.5",
            hotel.in_gym ? "bg-green-500" : "bg-red-300"
          )}></div>
          <span>Gym</span>
        </div>
        
        <div className="flex items-center text-xs">
          <div className={cn(
            "w-2 h-2 rounded-full mr-1.5",
            hotel.in_room ? "bg-green-500" : "bg-red-300"
          )}></div>
          <span>Room</span>
        </div>

        {/* Feature Icons with tooltips */}
        {hotel.bike_features && hotel.bike_features.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hotel.bike_features.map(feature => {
              const { icon, tooltip } = getFeatureIcon(feature);
              return (
                <div 
                  key={feature}
                  title={tooltip}
                  className="inline-flex items-center justify-center bg-gray-100 rounded-full h-5 px-2 text-xs"
                >
                  <span className="mr-1">{icon}</span>
                  <span className="text-xs">{feature}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HotelCard; 