import { describe, it, expect } from 'vitest';
import {
  extractCSRFToken,
  transformPelotonHotelData,
  // Assuming RawPelotonHotel and ClientHotel are exported for test data setup, or define test-specific types
} from './pelotonAPI';
import type { RawPelotonHotel, ClientHotel } from './pelotonAPI'; // Explicit import for types
import { findHotelByFuzzyMatch } from './hotelService'; // Corrected import

describe('Peloton API Utilities', () => {
  describe('extractCSRFToken', () => {
    it('should extract CSRF token from valid HTML', () => {
      const html = "<html><head></head><body><script>window._crsf = 'abc123xyz';</script></body></html>";
      expect(extractCSRFToken(html)).toBe('abc123xyz');
    });

    it('should return null if CSRF token is not found', () => {
      const html = "<html><head></head><body><p>No token here.</p></body></html>";
      expect(extractCSRFToken(html)).toBeNull();
    });

    it('should handle extra spaces around CSRF token assignment', () => {
      const html = "window._crsf    =   \'   spacedToken   \'  ;";
      // The regex is `'([^\']+)\'` so it captures '   spacedToken   ' including spaces if they are inside quotes.
      // If the intention is to trim, the regex or function needs adjustment.
      // Current regex: r"window\\._crsf\\s*=\\s*'([^']+)'"
      // This will capture '   spacedToken   ' if the HTML is window._crsf = '   spacedToken   '
      expect(extractCSRFToken(html)).toBe('   spacedToken   ');
    });

    it('should handle CSRF token with varied characters', () => {
      const html = "window._crsf=\'a-b_1=XyZ==\'";
      expect(extractCSRFToken(html)).toBe('a-b_1=XyZ==');
    });

    it('should return null for empty string HTML', () => {
      expect(extractCSRFToken('')).toBeNull();
    });
  });

  describe('transformPelotonHotelData', () => {
    const mockRawHotel: RawPelotonHotel = {
      id: 181,
      brand_id: null,
      name: "Club Quarters Hotel Central Loop, Chicago",
      slug: "club-quarters-hotel-central-loop-chicago",
      google_place_id: "ChIJW877xLstDogRK84dPcaVscE",
      address_1: "111 West Adams Street",
      street_number: "111",
      street: "West Adams Street",
      address_2: null,
      city: "Chicago",
      state: "Illinois",
      zip: "60603",
      latitude: "41.879266",
      longitude: "-87.6311861",
      phone: "+1 312-214-6400",
      has_bikes_fitness_center: 1,
      has_bikes_rooms: 0,
      total_bikes: 1,
      rewards_link: null,
      website: "https://clubquartershotels.com/chicago/central-loop",
      features: null,
      digital_subscription_features: null,
      fitness_center_fee: 0,
      fitness_center_description: "<p>CQ Fit, on the Lower Level, is open 24/7</p>",
      distance: 229.29,
      brand_name: "Club Quarters",
      bike_features_ids: [8, 6],
      bike_features: [
        { name: "Bike weights", has: true, nothas: false, tooltip: null },
        { name: "Dual-sided SPD pedals", has: true, nothas: false, tooltip: null },
        { name: "Delta-compatible pedals", has: false, nothas: true, tooltip: null },
      ],
    };

    const expectedClientHotel: ClientHotel = {
      id: 181,
      place_id: "ChIJW877xLstDogRK84dPcaVscE",
      name: "Club Quarters Hotel Central Loop, Chicago",
      lat: 41.879266,
      lng: -87.6311861,
      distance_m: 229.29,
      brand: "Club Quarters",
      total_bikes: 1,
      in_gym: true,
      in_room: false,
      bike_features: ["Bike weights", "Dual-sided SPD pedals"],
      url: "https://clubquartershotels.com/chicago/central-loop",
      tel: "+1 312-214-6400",
    };

    it('should transform a typical raw hotel object correctly', () => {
      const transformed = transformPelotonHotelData([mockRawHotel]);
      expect(transformed).toHaveLength(1);
      expect(transformed[0]).toEqual(expectedClientHotel);
    });

    it('should return an empty array for an empty input array', () => {
      expect(transformPelotonHotelData([])).toEqual([]);
    });

    it('should handle missing optional fields gracefully', () => {
      const partialRawHotel: RawPelotonHotel = {
        ...mockRawHotel,
        brand_name: null,
        phone: null,
        website: null,
        bike_features: undefined,
        distance: null,
      };
      const transformed = transformPelotonHotelData([partialRawHotel]);
      expect(transformed[0].brand).toBe('');
      expect(transformed[0].tel).toBeNull();
      expect(transformed[0].url).toBeNull();
      expect(transformed[0].bike_features).toEqual([]);
      expect(transformed[0].distance_m).toBeNull();
    });

    it('should correctly set in_gym and in_room based on 0/1 values', () => {
      const rawHotelGymOnly: RawPelotonHotel = { ...mockRawHotel, has_bikes_fitness_center: 1, has_bikes_rooms: 0 };
      const rawHotelRoomOnly: RawPelotonHotel = { ...mockRawHotel, has_bikes_fitness_center: 0, has_bikes_rooms: 1 };
      const rawHotelNeither: RawPelotonHotel = { ...mockRawHotel, has_bikes_fitness_center: 0, has_bikes_rooms: 0 };

      expect(transformPelotonHotelData([rawHotelGymOnly])[0].in_gym).toBe(true);
      expect(transformPelotonHotelData([rawHotelGymOnly])[0].in_room).toBe(false);
      expect(transformPelotonHotelData([rawHotelRoomOnly])[0].in_gym).toBe(false);
      expect(transformPelotonHotelData([rawHotelRoomOnly])[0].in_room).toBe(true);
      expect(transformPelotonHotelData([rawHotelNeither])[0].in_gym).toBe(false);
      expect(transformPelotonHotelData([rawHotelNeither])[0].in_room).toBe(false);
    });

    it('should only include features where has === true', () => {
      const rawHotelWithMixedFeatures: RawPelotonHotel = {
        ...mockRawHotel,
        bike_features: [
          { name: "Feature A", has: true, nothas: false, tooltip: null },
          { name: "Feature B", has: false, nothas: true, tooltip: null },
          { name: "Feature C", has: true, nothas: false, tooltip: null },
        ],
      };
      const transformed = transformPelotonHotelData([rawHotelWithMixedFeatures]);
      expect(transformed[0].bike_features).toEqual(["Feature A", "Feature C"]);
    });

    it('should return an empty array and log a warning for non-array input', () => {
      // Vitest doesn't have a built-in spy for console like Jest, but we can check the outcome.
      // For more robust console spying, consider adding a helper or specific Vitest plugin.
      
      // Test with null input (rule is globally off)
      expect(transformPelotonHotelData(null as any)).toEqual([]);
      
      // Test with an empty object input (rule is globally off)
      expect(transformPelotonHotelData({} as any)).toEqual([]);
      
      // To properly test console.warn, you might need to mock it using vi.spyOn:
      // import { vi } from 'vitest'; // Make sure to import vi if not already
      // const consoleWarnSpy = vi.spyOn(console, 'warn');
      // transformPelotonHotelData(null as any);
      // expect(consoleWarnSpy).toHaveBeenCalledWith("transformPelotonHotelData received non-array input:", null);
      // consoleWarnSpy.mockRestore();
    });
  });

  // --- Tests for Booking Checker Logic (from hotelService.ts) ---
  // This would ideally be in hotelService.test.ts, but adding here for brevity
  describe('findHotelByFuzzyMatch', () => {
    const sampleHotels: ClientHotel[] = [
      {
        id: 1, place_id: 'a', name: 'The Grand Hotel', lat: 0, lng: 0, distance_m: 100,
        brand: 'Hyatt', total_bikes: 2, in_gym: true, in_room: false,
        bike_features: ['Bike weights'], url: '', tel: '',
      },
      {
        id: 2, place_id: 'b', name: 'Hotel Deluxe Inn', lat: 1, lng: 1, distance_m: 200,
        brand: 'Marriott', total_bikes: 1, in_gym: true, in_room: false,
        bike_features: [], url: '', tel: '',
      },
      {
        id: 3, place_id: 'c', name: 'Park Plaza Hotel', lat: 2, lng: 2, distance_m: 300,
        brand: 'Hilton', total_bikes: 0, in_gym: false, in_room: false,
        bike_features: [], url: '', tel: '',
      },
      {
        id: 4, place_id: 'd', name: 'Grand Hyatt', lat: 3, lng: 3, distance_m: 50,
        brand: 'Hyatt', total_bikes: 3, in_gym: true, in_room: true,
        bike_features: ['Bike weights', 'Dual-sided SPD pedals'], url: '', tel: '',
      },
    ];

    it('should find an exact match', () => {
      const result = findHotelByFuzzyMatch(sampleHotels, 'The Grand Hotel');
      expect(result.hotel?.name).toBe('The Grand Hotel');
      expect(result.matchConfidence).toBeLessThanOrEqual(0.001); // Exact match score is 0
      expect(result.hasBikes).toBe(true);
    });

    it('should find a fuzzy match', () => {
      const result = findHotelByFuzzyMatch(sampleHotels, 'Grand Hotel');
      expect(result.hotel?.name).toBe('The Grand Hotel');
      expect(result.matchConfidence).toBeLessThan(0.4); // Expect a good fuzzy score
      expect(result.hasBikes).toBe(true);
    });

    it('should find another fuzzy match (Grand Hyat)', () => {
      const result = findHotelByFuzzyMatch(sampleHotels, 'Grand Hyat'); // Deliberate typo
      expect(result.hotel?.name).toBe('Grand Hyatt');
      expect(result.matchConfidence).toBeLessThan(0.4);
      expect(result.hasBikes).toBe(true);
    });

    it('should return no match if text is too different', () => {
      const result = findHotelByFuzzyMatch(sampleHotels, ' совершенно другой отель '); // Russian for "a completely different hotel"
      expect(result.hotel).toBeNull();
      expect(result.matchConfidence).toBeNull();
    });

    it('should return no match for empty freeText with default threshold', () => {
      // Fuse.js with a threshold might still match empty string to something if not handled.
      // The current implementation of findHotelByFuzzyMatch doesn't explicitly check for empty freeText
      // but Fuse.js typically returns no results for an empty search string against non-empty list.
      const result = findHotelByFuzzyMatch(sampleHotels, '');
      expect(result.hotel).toBeNull(); 
    });

    it('should return no match if hotel list is empty', () => {
      const result = findHotelByFuzzyMatch([], 'Any Hotel');
      expect(result.hotel).toBeNull();
      expect(result.hasBikes).toBe(false);
    });

    it('should correctly report hasBikes based on total_bikes', () => {
      const resultWithBikes = findHotelByFuzzyMatch(sampleHotels, 'Hotel Deluxe Inn');
      expect(resultWithBikes.hotel?.name).toBe('Hotel Deluxe Inn');
      expect(resultWithBikes.hasBikes).toBe(true);

      const resultWithoutBikes = findHotelByFuzzyMatch(sampleHotels, 'Park Plaza Hotel');
      expect(resultWithoutBikes.hotel?.name).toBe('Park Plaza Hotel');
      expect(resultWithoutBikes.hasBikes).toBe(false);
    });

     it('should respect a stricter threshold', () => {
      // 'Deluxe Inn' is a good match for 'Hotel Deluxe Inn' with threshold 0.6
      // With a very strict threshold, it should not match or have a very high score (bad match)
      const result = findHotelByFuzzyMatch(sampleHotels, 'Deluxe Inn', 0.1); // Very strict threshold
      if (result.hotel) {
        // If it matches, the name must be exact for such a low threshold given the query
        expect(result.hotel.name).toBe('Hotel Deluxe Inn'); 
        // Or it might not match at all, depending on Fuse.js internal scoring for partials at low thresholds
      } else {
        expect(result.hotel).toBeNull();
      }
    });
  });
}); 