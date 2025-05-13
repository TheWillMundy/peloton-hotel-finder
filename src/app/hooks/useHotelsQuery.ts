import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAppContext } from '@/app/contexts/AppContext';
import { fetchHotels, type FetchHotelParams, type HotelsApiResponse } from '@/lib/clientHotelService';
import { useEffect, useMemo } from 'react';

export default function useHotelsQuery() {
  const { state, dispatch } = useAppContext();
  const { searchIntent } = state;

  // Derive service query parameters
  const queryParams: FetchHotelParams | null = useMemo(() => {
    if (!searchIntent.location) {
      console.log("[useHotelsQuery] No location in searchIntent, returning null params");
      return null;
    }

    const { lat, lng } = searchIntent.location;
    const featureType = searchIntent.searchType === 'hotel' ? 'poi' : 'place';
    const freeText = searchIntent.searchType === 'hotel' ? searchIntent.selectedHotelNameForQuery || undefined : undefined;
    const cityBbox = searchIntent.apiQueryBbox;
    
    const params = { 
      lat, 
      lng, 
      searchTerm: searchIntent.searchTerm || undefined, 
      featureType, 
      freeText, 
      cityBbox 
    };

    console.log("[useHotelsQuery] Generated query params:", JSON.stringify(params, null, 2));
    return params;
  }, [searchIntent]);

  // Should we enable the query?
  const queryEnabled = useMemo(() => {
    const isEnabled = !!queryParams && !!searchIntent.apiQueryBbox;

    console.log("[useHotelsQuery] Query enabled:", isEnabled, {
      hasQueryParams: !!queryParams,
      hasBbox: !!searchIntent.apiQueryBbox
    });

    return isEnabled;
  }, [queryParams, searchIntent.apiQueryBbox]);

  const { 
    data: apiResponse, 
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    ...rest
  } = useQuery<HotelsApiResponse, Error>({
    queryKey: ['hotels', queryParams],
    queryFn: async () => {
      if (!queryParams) {
        console.log("[useHotelsQuery] QueryFn called with null params, returning empty result");
        return { hotels: [], cityBbox: null } as HotelsApiResponse;
      }
      
      console.log("[useHotelsQuery] Fetching hotels with params:", JSON.stringify(queryParams, null, 2));
      try {
        const result = await fetchHotels(queryParams);
        console.log("[useHotelsQuery] Fetch completed successfully, hotels count:", result?.hotels?.length || 0);
        return result;
      } catch (err) {
        console.error("[useHotelsQuery] Error fetching hotels:", err);
        throw err;
      }
    },
    enabled: queryEnabled,
    retry: 1,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  // Log query state changes
  useEffect(() => {
    console.log("[useHotelsQuery] Query state:", { 
      isLoading, 
      isFetching, 
      isPlaceholderData,
      hasError: !!error,
      hotelsCount: apiResponse?.hotels?.length || 0,
      hasMatchedHotel: !!apiResponse?.matchedHotel
    });
  }, [isLoading, isFetching, isPlaceholderData, apiResponse, error]);

  // Sync query results to context
  useEffect(() => {
    if (apiResponse) {
      console.log("[useHotelsQuery] Synchronizing API response to context", {
        hotelsCount: apiResponse.hotels?.length || 0,
        hasMatchedHotel: !!apiResponse.matchedHotel,
        cityCenter: apiResponse.cityCenter
      });

      // Ensure payload matches the expected type for API_RESPONSE_RECEIVED
      dispatch({
        type: 'API_RESPONSE_RECEIVED',
        payload: {
          hotels: apiResponse.hotels || [],
          cityCenter: apiResponse.cityCenter || [searchIntent.location?.lng || 0, searchIntent.location?.lat || 0],
          cityBbox: apiResponse.cityBbox || null,
          matchedHotel: apiResponse.matchedHotel || null,
          matchConfidence: apiResponse.matchConfidence || null,
          searchedPoinLocation: apiResponse.searchedPoinLocation || null
        }
      });
    } else if (error) {
      console.error("[useHotelsQuery] Error in API response:", error);
      // Optionally handle error case by dispatching error action
    }
  }, [apiResponse, dispatch, searchIntent.location, error]);

  return { 
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    matchedHotel: apiResponse?.matchedHotel || null,
    ...rest
  };
} 