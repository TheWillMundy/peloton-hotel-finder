import { useMemo } from 'react';
import type { ClientHotel } from '@/lib/pelotonAPI';
import type { Filters } from '@/app/components/filter/FilterChips';
import type { SearchIntent } from '@/app/contexts/AppContext';

const PRIMARY_LOYALTY_PROGRAMS = [
  "Accor Le Club",
  "Best Western Rewards",
  "Choice Privileges",
  "Hilton Honors",
  "IHG Rewards Club",
  "Marriott Bonvoy",
  "Radisson Rewards",
  "World of Hyatt",
  "Wyndham Rewards"
];

export default function useFilteredHotels(
  hotelsFromApi: ClientHotel[] | undefined,
  activeFilters: Filters,
  searchIntent: SearchIntent,
  matchedHotelFromApi: ClientHotel | null | undefined,
  showSkeletons: boolean
): ClientHotel[] {
  return useMemo(() => {
    if (showSkeletons) return [];
    const allHotels = hotelsFromApi ?? [];
    let filtered = [...allHotels];

    if (activeFilters.loyaltyPrograms.length > 0) {
      filtered = filtered.filter(hotel =>
        activeFilters.loyaltyPrograms.some(filterProgram => {
          if (filterProgram === "Other") return hotel.loyaltyProgram === "Other";
          if (PRIMARY_LOYALTY_PROGRAMS.includes(filterProgram)) return hotel.loyaltyProgram === filterProgram;
          return (
            hotel.brand === filterProgram &&
            (hotel.loyaltyProgram === "Other" || hotel.loyaltyProgram === hotel.brand)
          );
        })
      );
    }

    if (activeFilters.inRoom) {
      filtered = filtered.filter(hotel => hotel.in_room);
    }

    if (activeFilters.inGym) {
      filtered = filtered.filter(hotel => hotel.in_gym);
    }

    filtered.sort((a, b) => {
      if (a.in_room !== b.in_room) {
        return a.in_room ? -1 : 1;
      }
      if (a.in_gym !== b.in_gym) {
        return a.in_gym ? -1 : 1;
      }
      if (a.distance_m === null && b.distance_m === null) {
        return 0;
      }
      if (a.distance_m === null) {
        return 1;
      }
      if (b.distance_m === null) {
        return -1;
      }
      return a.distance_m - b.distance_m;
    });

    const isHotelSearchIntent = searchIntent.searchType === 'hotel';
    const matchedHotelId = matchedHotelFromApi?.id;
    if (isHotelSearchIntent && matchedHotelId != null) {
      const idx = filtered.findIndex(h => h.id === matchedHotelId);
      if (idx > -1) {
        const [matched] = filtered.splice(idx, 1);
        return [matched, ...filtered];
      }
    }

    return filtered;
  }, [hotelsFromApi, activeFilters, searchIntent.searchType, matchedHotelFromApi, showSkeletons]);
} 