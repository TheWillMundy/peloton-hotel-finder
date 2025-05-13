"use client";

import React from 'react';
import { ClientHotel } from '@/lib/pelotonAPI';

interface HotelMarkerProps {
  hotel: ClientHotel;
  isMobile: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isFocused: boolean;
  isDimmed: boolean;
}

const HotelMarker: React.FC<HotelMarkerProps> = ({
  hotel,
  isMobile,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isFocused,
  isDimmed
}) => {
  // Get marker type and label based on hotel data
  const getMarkerDetails = () => {
    if (hotel.total_bikes && hotel.total_bikes > 0) {
      if (hotel.in_room) {
        return {
          colorClass: 'bg-in-room-marker',
          label: hotel.total_bikes.toString(),
          hoverScale: 'scale-120'
        };
      } else if (hotel.total_bikes >= 3) {
        return {
          colorClass: 'bg-many-bikes-marker',
          label: hotel.total_bikes.toString(),
          hoverScale: 'scale-115'
        };
      } else {
        return {
          colorClass: 'bg-few-bikes-marker',
          label: hotel.total_bikes.toString(),
          hoverScale: 'scale-110'
        };
      }
    } else {
      return {
        colorClass: 'bg-no-bikes-marker',
        label: "P",
        hoverScale: 'scale-105'
      };
    }
  };

  const { colorClass, label, hoverScale } = getMarkerDetails();

  return (
    <div 
      className={`cursor-pointer transition-all duration-300 ease-out ${isFocused && !isMobile ? hoverScale : 'scale-100'} ${isFocused ? 'z-10' : 'z-1'}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-hotel-id={hotel.id}
    >
      <div className={`relative flex h-[42px] w-[42px] items-center justify-center rounded-full 
        text-white font-bold text-base ${colorClass}
        ${isFocused 
          ? 'shadow-[0_0_0_2px_white,0_6px_16px_rgba(0,0,0,0.2),0_0_0_6px_rgba(255,255,255,0.2)]' 
          : 'shadow-[0_0_0_2px_white,0_4px_8px_rgba(0,0,0,0.1)]'}
        ${isDimmed ? 'opacity-60' : 'opacity-100'}
        transition-all duration-300 ease-out`}
      >
        {isFocused && <div className="absolute inset-0 rounded-full animate-marker-pulse opacity-0" />}
        <div className="relative z-[2] text-shadow">{label}</div>
      </div>
    </div>
  );
};

export default React.memo(HotelMarker); 