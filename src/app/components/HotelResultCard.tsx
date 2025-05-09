"use client";

import { ClientHotel } from "@/lib/pelotonAPI";
import { Phone, Globe } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';

interface HotelResultCardProps {
  hotel: ClientHotel;
  onClick?: (hotel: ClientHotel) => void;
}

export default function HotelResultCard({ hotel, onClick }: HotelResultCardProps) {
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

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-start gap-4">
        {/* Bike Count Circle - moved to left */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-blue-700 font-semibold text-base">{hotel.total_bikes}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-800 mb-1.5 leading-tight">{hotel.name}</h3>
          
          {/* Loyalty Program Badge (if available) */}
          {(hotel.loyaltyProgram && hotel.loyaltyProgram !== "Other") ? (
            <Badge variant="outline" className="text-xs bg-gray-50">
              {hotel.loyaltyProgram}
            </Badge>
          ) : hotel.brand ? (
             <Badge variant="outline" className="text-xs bg-gray-50">
              {hotel.brand} {/* Fallback to original brand if loyaltyProgram is Other or not specific */}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-dashed border-gray-300 bg-gray-50 text-gray-500">
              Independent
            </Badge>
          )}
        </div>
      </div>
      
      {/* All indicators and features in one line */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {/* Location Indicators */}
        <div className="flex items-center text-sm">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full mr-2",
            hotel.in_gym ? "bg-green-500" : "bg-red-300"
          )}></div>
          <span>Gym</span>
        </div>
        
        <div className="flex items-center text-sm">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full mr-2",
            hotel.in_room ? "bg-green-500" : "bg-red-300"
          )}></div>
          <span>Room</span>
        </div>

        {/* Feature Icons with tooltips */}
        {hotel.bike_features && hotel.bike_features.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {hotel.bike_features.map(feature => {
              const { icon, tooltip } = getFeatureIcon(feature);
              return (
                <div 
                  key={feature}
                  title={tooltip}
                  className="inline-flex items-center justify-center bg-gray-100 rounded-full h-6 px-2 text-sm"
                >
                  <span className="mr-1">{icon}</span>
                  <span className="text-xs">{feature}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
          
      {/* Separator and contact information - moved to bottom */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex flex-wrap gap-4">
          {hotel.url && (
            <a 
              href={hotel.url.startsWith('http') ? hotel.url : `//${hotel.url}`}
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center"
            >
              <Globe className="h-3 w-3 mr-1" />
              Visit Website
            </a>
          )}
          
          {hotel.tel && (
            <a 
              href={`tel:${hotel.tel}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center"
            >
              <Phone className="h-3 w-3 mr-1" />
              {hotel.tel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
} 