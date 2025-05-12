"use client";

import React from "react";
import { FilterChips, Filters, loyaltyProgramsList } from "@/app/components/filter/FilterChips";
import { Button } from "@/app/components/ui/button";
import { X } from "lucide-react";
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle
} from "@/app/components/ui/drawer";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilters: Filters;
  onApplyFilters: (filters: Filters) => void;
}

export default function FilterModal({
  isOpen,
  onClose,
  activeFilters,
  onApplyFilters,
}: FilterModalProps) {
  const [tempFilters, setTempFilters] = React.useState<Filters>(activeFilters);

  // Reset temp filters when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTempFilters({ ...activeFilters });
    }
  }, [isOpen, activeFilters]);

  const handleApply = () => {
    onApplyFilters(tempFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: Filters = {
      inRoom: false,
      inGym: false,
      loyaltyPrograms: [],
    };
    setTempFilters(resetFilters);
    onApplyFilters(resetFilters);
    onClose();
  };

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onClose} 
      direction="bottom"
    >
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        <DrawerHeader className="border-b border-gray-200 flex justify-between items-center p-4">
          <DrawerTitle className="text-lg font-semibold">Filter Hotels</DrawerTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close filter modal"
          >
            <X size={20} />
          </Button>
        </DrawerHeader>

        <div className="flex-1 overflow-auto p-4">
          <FilterChips
            activeFilters={tempFilters}
            onFilterChange={setTempFilters}
            availableLoyaltyPrograms={loyaltyProgramsList}
          />
        </div>

        <DrawerFooter className="border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button
              className="flex-1"
              onClick={handleApply}
            >
              Apply Filters
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
} 