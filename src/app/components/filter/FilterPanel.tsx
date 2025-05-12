"use client";

import React, { useState } from 'react';
import { FilterChips, Filters, loyaltyProgramsList } from '@/app/components/filter/FilterChips';
import { Button } from '@/app/components/ui/button';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  isMobile?: boolean;
  onFiltersChange: (filters: Filters) => void;
  activeFilters: Filters;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  isMobile = false,
  onFiltersChange,
  activeFilters
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active filters for the badge
  const activeFiltersCount = 
    (activeFilters.inRoom ? 1 : 0) + 
    (activeFilters.inGym ? 1 : 0) + 
    activeFilters.loyaltyPrograms.length;
  
  // For mobile, we return a button that matches the search bar styling
  if (isMobile) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        className="bg-white rounded-xl shadow-xl h-[50px] w-[50px] flex items-center justify-center p-0"
        onClick={() => onFiltersChange(activeFilters)}
        aria-label="Open filters"
      >
        <SlidersHorizontal size={20} className="text-gray-700" />
        {activeFiltersCount > 0 && (
          <span className="absolute top-2 right-2 bg-primary text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
            {activeFiltersCount}
          </span>
        )}
      </Button>
    );
  }

  // For desktop, we show a collapsible panel
  return (
    <div className="bg-white border border-gray-200 rounded-md mb-3 overflow-hidden">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between rounded-none border-b border-transparent"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </Button>

      <div 
        className={cn(
          "transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <FilterChips 
          activeFilters={activeFilters}
          onFilterChange={onFiltersChange}
          availableLoyaltyPrograms={loyaltyProgramsList}
        />
      </div>
    </div>
  );
};

export default FilterPanel; 