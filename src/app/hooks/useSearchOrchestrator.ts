import { useEffect } from 'react';
import { useAppContext } from '@/app/contexts/AppContext';
import { fetchHotels, FetchHotelParams, HotelsApiResponse } from '@/lib/clientHotelService';
import type { MapboxGeocodingFeature } from '@/app/components/search/CitySearchInput';

// Helper to fetch city feature from Mapbox
async function fetchCityFeatureFromMapbox(
  cityName: string,
  accessToken: string
): Promise<MapboxGeocodingFeature | null> {
  console.log("[Orchestrator] Building Mapbox geocoding request for city:", cityName);
  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    cityName
  )}.json?access_token=${accessToken}&types=place&limit=1`;
  
  try {
    console.log("[Orchestrator] Sending request to Mapbox API:", endpoint);
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      console.error("[Orchestrator] Mapbox city geocoding failed:", response.status, await response.text());
      return null;
    }
    
    const data = await response.json();
    console.log("[Orchestrator] Mapbox API response for city:", JSON.stringify(data, null, 2));
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      
      if (!feature.center || !Array.isArray(feature.center) || feature.center.length < 2) {
        console.error("[Orchestrator] Mapbox feature is missing valid coordinates:", feature);
        return null;
      }
      
      const result: MapboxGeocodingFeature = {
        lat: feature.center[1],
        lng: feature.center[0],
        placeName: feature.place_name || feature.text || cityName,
        mapboxBbox: feature.bbox,
        featureType: 'place',
        context: feature.context,
      };
      
      console.log("[Orchestrator] Extracted city feature:", result);
      return result;
    }
    console.warn("[Orchestrator] No features found by Mapbox for city:", cityName, data);
    return null;
  } catch (error) {
    console.error("[Orchestrator] Error fetching city feature from Mapbox:", error);
    return null;
  }
}

export function useSearchOrchestrator() {
  const { state, dispatch } = useAppContext();
  const searchIntent = (state as any).searchIntent;

  // Effect 1: Trigger City Resolution for POI searches
  useEffect(() => {
    const status = (searchIntent as any).resolutionStatus;
    if (status === 'resolving_city' && searchIntent.originalSelectedFeature) {
      console.log("[Orchestrator] Starting city resolution for POI:", searchIntent.originalSelectedFeature.placeName);
      const poiFeature = searchIntent.originalSelectedFeature;

      // Extract Mapbox place ID from context
      let cityQuery: string | undefined;
      if (poiFeature.context) {
        const cityContext = poiFeature.context.find(
          (c: any) => c.id.startsWith('place.') || c.id.startsWith('locality.')
        );
        if (cityContext) {
          cityQuery = cityContext.id;
          console.log("[Orchestrator] Found city place ID from context:", cityQuery);
        }
      }
      
      // Fallback: parse city name from placeName if no ID
      if (!cityQuery && poiFeature.placeName) {
        console.log("[Orchestrator] No place ID, falling back to placeName parsing:", poiFeature.placeName);
        const parts = poiFeature.placeName.split(',');
        cityQuery = parts[0]?.trim();
        console.log("[Orchestrator] Fallback cityQuery from placeName:", cityQuery);
      }

      if (cityQuery) {
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!token) {
          console.error("[Orchestrator] Mapbox access token not configured.");
          dispatch({ type: 'CITY_RESOLUTION_COMPLETE', payload: { cityFeature: null, originalSearchIntent: searchIntent }});
          return;
        }

        console.log("[Orchestrator] Fetching city feature from Mapbox using query:", cityQuery);
        fetchCityFeatureFromMapbox(cityQuery, token).then((cityFeature) => {
          dispatch({
            type: 'CITY_RESOLUTION_COMPLETE',
            payload: { cityFeature, originalSearchIntent: searchIntent }
          });
        });
      } else {
        console.warn("[Orchestrator] Could not determine city query for POI:", poiFeature.placeName);
        dispatch({ type: 'CITY_RESOLUTION_COMPLETE', payload: { cityFeature: null, originalSearchIntent: searchIntent }});
      }
    }
  }, [searchIntent, dispatch]);

  // Effect 2: Trigger Hotel API Fetch when intent is ready
  useEffect(() => {
    const status2 = (searchIntent as any).resolutionStatus;
    if (
      searchIntent.needsFresh &&
      status2 === 'resolved' &&
      searchIntent.location &&
      searchIntent.apiQueryBbox
    ) {
      dispatch({ type: 'API_REQUEST_INITIATED' });

      const params: FetchHotelParams = {
        lat: searchIntent.location.lat,
        lng: searchIntent.location.lng,
        searchTerm: searchIntent.searchTerm || '',
        featureType:
          searchIntent.originalSelectedFeature?.featureType ||
          (searchIntent.searchType === 'hotel' ? 'poi' : 'place'),
        freeText: searchIntent.selectedHotelNameForQuery ?? undefined,
        cityBbox: searchIntent.apiQueryBbox,
      };

      fetchHotels(params)
        .then((apiResponse: HotelsApiResponse) => {
          // Dispatch with explicit payload shape per AppAction
          dispatch({
            type: 'API_RESPONSE_RECEIVED',
            payload: {
              hotels: apiResponse.hotels,
              cityCenter: apiResponse.cityCenter ?? [params.lng, params.lat],
              cityBbox: apiResponse.cityBbox ?? null,
              matchedHotel: apiResponse.matchedHotel ?? null,
              matchConfidence: apiResponse.matchConfidence ?? null,
              searchedPoinLocation: apiResponse.searchedPoinLocation ?? null,
            },
          });
        })
        .catch((error) => console.error('[Orchestrator] fetchHotels error:', error));
    }
  }, [searchIntent, dispatch]);
} 