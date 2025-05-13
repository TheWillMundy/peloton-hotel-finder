"use client";

import React, { useCallback } from 'react';
import { ClientHotel } from '@/lib/pelotonAPI';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/app/hooks/useDebouncedCallback';

interface HotelCardProps {
  hotel: ClientHotel;
  onHover?: (hotelId: number | null, lat?: number, lng?: number) => void;
  onClick?: (hotel: ClientHotel) => void;
  isHovered?: boolean;
  isFocusedBySearch?: boolean;
  isAnyListItemFocused?: boolean;
  isMobile?: boolean;
}

const HotelCard: React.FC<HotelCardProps> = ({ 
  hotel, 
  onHover, 
  onClick, 
  isHovered = false,
  isFocusedBySearch = false,
  isAnyListItemFocused = false,
  isMobile = false
}) => {
  // Debounce the hover effect with a 100ms delay to prevent jitter
  const debouncedHover = useDebouncedCallback((id: number | null, lat?: number, lng?: number) => {
    if (onHover) onHover(id, lat, lng);
  }, 100);

  const handleMouseEnter = useCallback(() => {
    debouncedHover(hotel.id, hotel.lat, hotel.lng);
  }, [debouncedHover, hotel]);

  const handleMouseLeave = useCallback(() => {
    // Cancel any pending hover and immediately remove hover state
    debouncedHover.cancel();
    if (onHover) onHover(null);
  }, [debouncedHover, onHover]);

  const handleClick = useCallback(() => {
    if (onClick) onClick(hotel);
  }, [hotel, onClick]);

  // Feature icons mapping - improved with descriptive emojis
  const getFeatureIcon = (feature: string) => {
    switch (feature.toLowerCase()) {
      case 'bike weights':
        return { icon: '⚖️', tooltip: 'Peloton bike includes weights' };
      case 'dual-sided spd pedals':
        return { icon: '👟', tooltip: 'Dual-sided SPD pedals compatible with cycling shoes' };
      case 'delta-compatible pedals':
        return { icon: '👟', tooltip: 'Delta-compatible pedals for Peloton/other cycling shoes' };
      case 'free weights':
        return { icon: '🏋️', tooltip: 'Access to free weights' };
      case 'resistance bands':
        return { icon: '🤸', tooltip: 'Resistance bands available' };
      case 'workout mat':
        return { icon: '🧘', tooltip: 'Workout mat provided' };
      case 'yoga blocks':
        return { icon: '🧱', tooltip: 'Yoga blocks available' };
      case 'bike screen':
        return { icon: '📱', tooltip: 'Bike includes a screen for classes' };
      default:
        return { icon: '✓', tooltip: feature };
    }
  };

  // Get marker style based on hotel data
  const getMarkerStyle = () => {
    if (hotel.total_bikes && hotel.total_bikes > 0) {
      if (hotel.in_room) {
        return 'bg-in-room-marker';
      } else if (hotel.total_bikes >= 3) {
        return 'bg-many-bikes-marker';
      } else {
        return 'bg-few-bikes-marker';
      }
    } else {
      return 'bg-no-bikes-marker';
    }
  };

  // Determine card's visual state
  const cardIsPrimaryFocus = isHovered || (isFocusedBySearch && !isHovered);
  const shouldDimThisCard = isAnyListItemFocused && !cardIsPrimaryFocus;

  return (
    <div 
      className={cn(
        "bg-white border rounded-lg p-3 transition-all duration-300 cursor-pointer relative",
        !isMobile && cardIsPrimaryFocus 
          ? "shadow-lg bg-background/5 z-10 opacity-100 scale-[1.02]"
          : !isMobile && shouldDimThisCard 
            ? "border-border hover:shadow-md hover:border-border/70 opacity-70"
            : "border-border hover:shadow-md hover:border-border/70 opacity-100"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-hotel-id={hotel.id}
    >
      {/* Accent marker on the right when hovered */}
      {!isMobile && cardIsPrimaryFocus && (
        <div className="absolute top-0 bottom-0 right-0 w-2 bg-in-room-marker rounded-r-lg"></div>
      )}
      <div className="flex items-start gap-3">
        {/* Bike Count Circle - matching our marker styles */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm",
          getMarkerStyle()
        )}>
          {hotel.total_bikes}
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Hotel Name */}
          <h3 className="text-base font-semibold text-foreground leading-tight truncate" title={hotel.name}>
            {hotel.name}
          </h3>
          
          {/* Loyalty Program Badge (if available) */}
          {(hotel.loyaltyProgram && hotel.loyaltyProgram !== "Other") ? (
            <Badge variant="outline" className="mt-1 text-xs bg-background/5">
              {hotel.loyaltyProgram}
            </Badge>
          ) : hotel.brand ? (
             <Badge variant="outline" className="mt-1 text-xs bg-background/5">
              {hotel.brand}
            </Badge>
          ): (
            <Badge variant="outline" className="mt-1 text-xs border-dashed border-border/70 bg-background/5 text-muted-foreground">
              Independent
            </Badge>
          )}
        </div>
      </div>

      {/* All indicators and features in one line */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {/* Location Indicators - Improved for better distinction */}
        <div className={cn(
          "flex items-center text-xs px-2 py-1 rounded-full",
          hotel.in_gym 
            ? "bg-few-bikes-marker text-white" 
            : "bg-background/5 text-muted-foreground/60"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full mr-1.5",
            hotel.in_gym ? "bg-white" : "bg-no-bikes-marker/40"
          )}></div>
          <span className={hotel.in_gym ? "" : "line-through"}>Gym</span>
        </div>
        
        <div className={cn(
          "flex items-center text-xs px-2 py-1 rounded-full",
          hotel.in_room 
            ? "bg-in-room-marker text-white" 
            : "bg-background/5 text-muted-foreground/60"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full mr-1.5",
            hotel.in_room ? "bg-white" : "bg-no-bikes-marker/40"
          )}></div>
          <span className={hotel.in_room ? "" : "line-through"}>Room</span>
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
                  className="inline-flex items-center justify-center bg-background/5 rounded-full h-5 px-2 text-xs"
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