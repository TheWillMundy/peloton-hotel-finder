"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { Badge } from "@/app/components/ui/badge"; // Using Badge for a chip-like appearance

export interface Filters {
  inRoom: boolean;
  inGym: boolean;
  loyaltyPrograms: string[];
}

interface FilterChipsProps {
  activeFilters: Filters;
  onFilterChange: (newFilters: Filters) => void;
  availableLoyaltyPrograms: string[]; // To populate loyalty chips dynamically
}

export const loyaltyProgramsList = [
  "Accor Le Club",
  "Best Western Rewards",
  "Choice Privileges",
  "Hilton Honors",
  "IHG Rewards Club",
  "Marriott Bonvoy",
  "Radisson Rewards",
  "World of Hyatt",
  "Wyndham Rewards",
  "Other", // For brands not in major programs
];


export function FilterChips({ activeFilters, onFilterChange, availableLoyaltyPrograms }: FilterChipsProps) {
  const handleBikeFilterChange = (value: string[]) => {
    onFilterChange({
      ...activeFilters,
      inRoom: value.includes("inRoom"),
      inGym: value.includes("inGym"),
    });
  };

  const handleLoyaltyFilterChange = (program: string) => {
    const newLoyaltyPrograms = activeFilters.loyaltyPrograms.includes(program)
      ? activeFilters.loyaltyPrograms.filter((p) => p !== program)
      : [...activeFilters.loyaltyPrograms, program];
    onFilterChange({
      ...activeFilters,
      loyaltyPrograms: newLoyaltyPrograms,
    });
  };
  
  // Determine current value for bike toggle group
  const bikeToggleValue = [];
  if (activeFilters.inRoom) bikeToggleValue.push("inRoom");
  if (activeFilters.inGym) bikeToggleValue.push("inGym");

  return (
    <div className="space-y-4 p-4">
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-700">Bike Location</h4>
        <ToggleGroup
          type="multiple"
          value={bikeToggleValue}
          onValueChange={handleBikeFilterChange}
          aria-label="Bike location filters"
        >
          <ToggleGroupItem value="inRoom" aria-label="In-room bikes">
            In Room
          </ToggleGroupItem>
          <ToggleGroupItem value="inGym" aria-label="In-gym bikes">
            In Gym
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-700">Hotel Loyalty Program</h4>
        <div className="flex flex-wrap gap-2">
          {availableLoyaltyPrograms.map((program) => {
            if (!program) return null; // Should not happen if generated correctly

            return (
              <Badge
                key={program}
                variant={activeFilters.loyaltyPrograms.includes(program) ? "default" : "outline"}
                onClick={() => handleLoyaltyFilterChange(program)}
                className="cursor-pointer px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {program}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
} 