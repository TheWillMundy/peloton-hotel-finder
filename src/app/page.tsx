"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import CitySearchInput from '@/app/components/CitySearchInput';
import HotelResultCard from '@/app/components/HotelResultCard';
import InfiniteScrollTrigger from '@/app/components/InfiniteScrollTrigger';
import { ClientHotel } from '@/lib/pelotonAPI';

const PAGE_SIZE = 250;

async function fetchHotelsByCity(city: string): Promise<ClientHotel[]> {
  if (!city) {
    return [];
  }
  const response = await fetch(`/api/hotels?city=${encodeURIComponent(city)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(errorData.message || `Error fetching hotels: ${response.statusText}`);
  }
  return response.json();
}

export default function HomePage() {
  const [currentCity, setCurrentCity] = useState<string>('');
  const [visibleItemsCount, setVisibleItemsCount] = useState<number>(PAGE_SIZE);

  const {
    data: allHotels,
    isLoading,
    isError,
    error,
  } = useQuery<ClientHotel[], Error>({
    queryKey: ['hotels', currentCity],
    queryFn: () => fetchHotelsByCity(currentCity),
    enabled: !!currentCity,
    retry: 1,
  });

  const displayedHotels = useMemo(() => {
    return allHotels ? allHotels.slice(0, visibleItemsCount) : [];
  }, [allHotels, visibleItemsCount]);

  const hasMoreHotels = useMemo(() => {
    return allHotels ? visibleItemsCount < allHotels.length : false;
  }, [allHotels, visibleItemsCount]);

  const loadMoreHotels = () => {
    if (hasMoreHotels) {
      setVisibleItemsCount(prevCount => prevCount + PAGE_SIZE);
    }
  };

  const handleSearch = (city: string) => {
    if (city.trim().toLowerCase() !== currentCity.toLowerCase()) {
      setVisibleItemsCount(PAGE_SIZE);
    }
    setCurrentCity(city.trim());
  };

  return (
    <main className="container mx-auto p-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800">Peloton Hotel Finder</h1>
        <p className="text-xl text-gray-600">Find hotels with Peloton bikes quickly and easily.</p>
      </header>
      
      <section className="max-w-xl mx-auto mb-8">
        <CitySearchInput onSearch={handleSearch} isLoading={isLoading} />
      </section>

      <section id="search-results">
        {isLoading && !allHotels && <p className="text-center text-gray-600">Loading hotels...</p>}
        {isError && (
          <div className="text-center text-red-600 bg-red-100 p-4 rounded-md">
            <p className="font-semibold">Error fetching hotels:</p>
            <p>{error?.message || "An unexpected error occurred."}</p>
          </div>
        )}
        {allHotels && allHotels.length === 0 && currentCity && !isLoading && !isError && (
          <p className="text-center text-gray-600">No hotels found for &quot;{currentCity}&quot;. Try a different city.</p>
        )}
        {displayedHotels && displayedHotels.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-700">
              Hotels in {currentCity} ({displayedHotels.length} of {allHotels?.length || 0} shown)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedHotels.map((hotel) => (
                <HotelResultCard key={hotel.id} hotel={hotel} />
              ))}
            </div>
            <InfiniteScrollTrigger 
              onVisible={loadMoreHotels} 
              hasMore={hasMoreHotels} 
              isLoadingNext={isLoading && !!allHotels}
            />
          </div>
        )}
      </section>

      <section id="map-view" className="mt-8">
        {/* Map will be displayed here */}
      </section>
    </main>
  );
}
