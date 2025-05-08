"use client";

import { useState } from 'react';

interface CitySearchInputProps {
  onSearch: (city: string) => void;
  isLoading?: boolean;
}

export default function CitySearchInput({ onSearch, isLoading }: CitySearchInputProps) {
  const [city, setCity] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim()) {
      onSearch(city.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Enter city name"
        className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 flex-grow"
        disabled={isLoading}
      />
      <button
        type="submit"
        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
        disabled={isLoading || !city.trim()}
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
} 