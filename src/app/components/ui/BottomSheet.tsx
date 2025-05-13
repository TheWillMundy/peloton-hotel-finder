"use client";

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ClientHotel } from '@/lib/pelotonAPI';
import HotelCard from '@/app/components/hotel/HotelCard';
import HotelCardSkeleton from '@/app/components/hotel/HotelCardSkeleton';
import { cn } from '@/lib/utils';
import { useUIInteraction } from '@/app/contexts/UIInteractionContext';

const PEEK_HEIGHT_VH = 25; // 25vh for peek state
const FULL_HEIGHT_VH = 85; // 85vh for full state
const HANDLE_AREA_HEIGHT_PX = 40; // Approx height of the drag handle area
const MIN_DRAG_THRESHOLD_PX = HANDLE_AREA_HEIGHT_PX; // Smallest height the sheet can be (handle visible)

export type BottomSheetState = 'closed' | 'peek' | 'full';

export interface BottomSheetHandle { // Renamed from BottomSheetActions to BottomSheetHandle for clarity
  snapToState: (state: BottomSheetState) => void;
}

interface BottomSheetProps {
  hotels: ClientHotel[];
  initialState?: BottomSheetState; // Parent can suggest initial state
  onStateChange?: (newState: BottomSheetState, currentHeightPx: number) => void;
  onHotelSelect: (hotel: ClientHotel) => void;
  hasSearched?: boolean; // Add this prop to differentiate between initial state and after search
  hasActiveFilters?: boolean; // Add this prop to check if filters are active
  onClearFilters?: () => void; // Add this prop to clear filters
  showSkeletons?: boolean; // Renamed from isLoading and isNewSearch
}

const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>((
  {
    hotels,
    initialState = 'closed',
    onStateChange,
    onHotelSelect,
    hasSearched = false,
    hasActiveFilters = false,
    onClearFilters = () => {},
    showSkeletons = false, // Renamed prop
  }, 
  ref
) => {
  const { uiState, setActiveHotel, clearActiveHotel } = useUIInteraction();
  const [sheetState, setSheetState] = useState<BottomSheetState>(initialState);
  const [currentHeight, setCurrentHeight] = useState(0); // Store height in px for smoother drag
  
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number | null>(null);
  const isDragging = useRef(false);

  const vhToPx = (vh: number) => {
    if (typeof window === 'undefined') return 0; // Guard for SSR or non-browser
    return (vh * window.innerHeight) / 100;
  };

  const getTargetHeightPx = useCallback((state: BottomSheetState): number => {
    switch (state) {
      case 'full':
        return vhToPx(FULL_HEIGHT_VH);
      case 'peek':
        return vhToPx(PEEK_HEIGHT_VH);
      case 'closed':
      default:
        return MIN_DRAG_THRESHOLD_PX; // Always show handle
    }
  }, []);

  useEffect(() => {
    const newHeightPx = getTargetHeightPx(initialState);
    setCurrentHeight(newHeightPx);
    setSheetState(initialState);
    if (onStateChange) {
        onStateChange(initialState, newHeightPx);
    }
  }, [initialState, getTargetHeightPx, onStateChange]);


  const snapToState = useCallback((newHeight: number) => {
    const peekPx = getTargetHeightPx('peek');
    const fullPx = getTargetHeightPx('full');
    let finalState: BottomSheetState = 'closed';
    let finalHeightPx = MIN_DRAG_THRESHOLD_PX;

    if (newHeight < (peekPx + MIN_DRAG_THRESHOLD_PX) / 2) { // Closer to closed (handle) or is very low
        finalState = 'closed';
        finalHeightPx = MIN_DRAG_THRESHOLD_PX;
    } else if (newHeight > (fullPx + peekPx) / 2) { // Closer to full
        finalState = 'full';
        finalHeightPx = fullPx;
    } else { // Closer to peek
        finalState = 'peek';
        finalHeightPx = peekPx;
    }

    if (dragStartHeight.current && dragStartHeight.current > peekPx && 
        newHeight < fullPx * 0.7 && newHeight > (peekPx + MIN_DRAG_THRESHOLD_PX) / 1.8) {
        finalState = 'peek';
        finalHeightPx = peekPx;
    }
    if (dragStartHeight.current && dragStartHeight.current <= MIN_DRAG_THRESHOLD_PX && 
        newHeight < peekPx * 0.8 && newHeight > MIN_DRAG_THRESHOLD_PX) {
          finalState = 'closed';
          finalHeightPx = MIN_DRAG_THRESHOLD_PX;
    }

    setCurrentHeight(finalHeightPx);
    setSheetState(finalState);
    if (onStateChange) {
      onStateChange(finalState, finalHeightPx);
    }
  }, [getTargetHeightPx, onStateChange]);

  const handleDragStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!sheetRef.current) return;
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = sheetRef.current.clientHeight;
    sheetRef.current.style.transition = 'none'; // Disable transition during drag
    document.body.style.overflow = 'hidden'; // Ensure body scroll is disabled during drag to prevent page scroll on mobile
  };

  const handleDragMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current || dragStartY.current === null || !sheetRef.current || dragStartHeight.current === null) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragStartY.current;
    let newHeight = dragStartHeight.current - deltaY;

    const maxPossibleHeight = vhToPx(FULL_HEIGHT_VH);
    newHeight = Math.max(MIN_DRAG_THRESHOLD_PX, Math.min(newHeight, maxPossibleHeight));
    
    setCurrentHeight(newHeight);
    sheetRef.current.style.height = `${newHeight}px`;
  };

  const handleDragEnd = () => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;
    sheetRef.current.style.transition = 'height 0.3s ease-in-out'; // Re-enable transition
    document.body.style.overflow = 'auto'; // Re-enable body scroll

    const currentActualHeight = sheetRef.current.clientHeight;
    snapToState(currentActualHeight);

    dragStartY.current = null;
    dragStartHeight.current = null;
  };

  const handleToggleByHandle = () => {
    let newState: BottomSheetState;
    if (sheetState === 'closed' || sheetState === 'peek') {
      newState = 'full';
    } else { // sheetState === 'full'
      newState = 'peek';
    }
    const newHeightPx = getTargetHeightPx(newState);
    setCurrentHeight(newHeightPx);
    setSheetState(newState);
    if (onStateChange) {
      onStateChange(newState, newHeightPx);
    }
  };
  
  // Effect to apply smooth transition when sheetState changes programmatically (not via drag)
  useEffect(() => {
    if (!isDragging.current) {
      const targetHeight = getTargetHeightPx(sheetState);
      setCurrentHeight(targetHeight);
    }
  }, [sheetState, getTargetHeightPx]);

  // Expose snapToState method via ref
  useImperativeHandle(ref, () => ({
    snapToState: (targetState: BottomSheetState) => {
      if (!isDragging.current) { // Prevent programmatic snap if user is actively dragging
        const newHeightPx = getTargetHeightPx(targetState);
        setCurrentHeight(newHeightPx);
        setSheetState(targetState);
        if (onStateChange) {
          onStateChange(targetState, newHeightPx);
        }
      }
    }
  }));

  return (
    <>
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-2xl rounded-t-2xl",
          "overflow-hidden", // Prevents content spill during animation
          !isDragging.current && "transition-[height] duration-300 ease-in-out" // Apply transition only when not dragging
        )}
        style={{ height: `${currentHeight}px` }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div
          className="py-3 flex items-center justify-center cursor-grab touch-none" // Added touch-none
          style={{ height: `${HANDLE_AREA_HEIGHT_PX}px` }}
          onClick={handleToggleByHandle} // Click on handle toggles between peek/full
        >
          {/* Drag Handle Indicator */}
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div 
          className="overflow-y-auto p-4 bottom-sheet-content" 
          style={{ height: `calc(100% - ${HANDLE_AREA_HEIGHT_PX}px)` }}
        >
          {showSkeletons ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-500 py-2">
                Searching for hotels...
              </div>
              <HotelCardSkeleton />
              <HotelCardSkeleton />
              <HotelCardSkeleton />
            </div>
          ) : hotels.length > 0 ? (
            <div className="space-y-3">
              {hotels.map(hotel => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  onClick={() => onHotelSelect(hotel)}
                  onHover={(id) => id !== null ? setActiveHotel(id, 'sidebar_hover') : clearActiveHotel()}
                  isHovered={hotel.id === uiState.activeHotelId}
                  isAnyHovered={uiState.activeHotelId !== null}
                  isMobile={true}
                />
              ))}
            </div>
          ) : hasActiveFilters ? (
            <div className="text-center text-gray-500 py-8">
              <p>No hotels match your current filters.</p>
              <button 
                className="text-primary text-sm font-medium mt-1"
                onClick={onClearFilters}
              >
                Clear all filters
              </button>
            </div>
          ) : hasSearched ? (
            <div className="text-center text-gray-500 py-8">
              <p>No hotels with Peloton bikes found in this area.</p>
              <p className="text-sm">Try searching for a different city or hotel.</p>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>Welcome to Peloton Hotel Finder!</p>
              <p className="text-sm">Search for a city or hotel to find Peloton bikes nearby.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

BottomSheet.displayName = 'BottomSheet';

export default BottomSheet; 