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
  // Calculate styles based on hotel data and interaction state
  const getMarkerStyles = () => {
    // Base styles for the wrapper element
    const wrapperStyles: React.CSSProperties = {
      cursor: 'pointer',
      transform: isFocused && !isMobile ? 'scale(1.2)' : 'scale(1)',
      zIndex: isFocused ? 10 : 1,
      transition: 'transform 0.25s ease-out',
    };

    // Base styles for the inner element (the circle)
    const innerStyles: React.CSSProperties = {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: "bold",
      fontSize: "15px",
      boxShadow: isFocused ? '0 5px 10px rgba(0,0,0,0.4)' : '0 3px 6px rgba(0,0,0,0.15)',
      border: "2px solid white",
      transition: "transform 0.25s ease-out, box-shadow 0.25s ease-out, opacity 0.3s ease-in-out",
      opacity: isDimmed ? 0.65 : 1,
    };

    // Set background and border color based on hotel data
    if (hotel.total_bikes && hotel.total_bikes > 0) {
      if (hotel.in_room) {
        innerStyles.backgroundColor = "#4A90E2";
        innerStyles.borderColor = "rgba(74, 144, 226, 0.5)";
      } else if (hotel.total_bikes >= 3) {
        innerStyles.backgroundColor = "#58B794";
        innerStyles.borderColor = "rgba(88, 183, 148, 0.5)";
      } else {
        innerStyles.backgroundColor = "#F5BD41";
        innerStyles.borderColor = "rgba(245, 189, 65, 0.5)";
      }
    } else {
      innerStyles.backgroundColor = "#9AA1B1";
      innerStyles.borderColor = "rgba(154, 161, 177, 0.5)";
    }

    return { wrapperStyles, innerStyles };
  };

  const { wrapperStyles, innerStyles } = getMarkerStyles();

  return (
    <div 
      style={wrapperStyles}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-hotel-id={hotel.id}
    >
      <div style={innerStyles}>
        {hotel.total_bikes && hotel.total_bikes > 0 ? hotel.total_bikes : "P"}
      </div>
    </div>
  );
};

export default React.memo(HotelMarker); 