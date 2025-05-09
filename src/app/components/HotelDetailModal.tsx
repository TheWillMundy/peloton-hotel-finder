"use client";

import { useEffect, useRef } from 'react';
import { ClientHotel } from '@/lib/pelotonAPI';
import { Bike, Phone, Globe, X, MapPin, BedDouble, ListChecks } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface HotelDetailModalProps {
  hotel: ClientHotel | null;
  onClose: () => void;
  className?: string;
}

export default function HotelDetailModal({ hotel, onClose, className }: HotelDetailModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Initialize map when hotel changes
  useEffect(() => {
    if (!hotel || !mapContainerRef.current) return;
    
    if (mapRef.current) {
      mapRef.current.remove();
    }

    const mbAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mbAccessToken) {
      console.error("Mapbox access token is not set!");
      return;
    }

    mapboxgl.accessToken = mbAccessToken;
    
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [hotel.lng, hotel.lat],
      zoom: 15,
      interactive: true,
    });

    // Add hotel marker
    new mapboxgl.Marker({ color: '#007bff' })
      .setLngLat([hotel.lng, hotel.lat])
      .addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [hotel]);

  if (!hotel) return null;

  // Feature icons mapping
  const getFeatureIcon = (feature: string) => {
    switch (feature.toLowerCase()) {
      case 'bike weights':
        return '⚖️';
      case 'dual-sided spd pedals':
        return '👟';
      case 'bike screen':
        return '📱';
      default:
        return '✓';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        className={cn(
          "bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col",
          className
        )}
      >
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">{hotel.name}</h2>
            {hotel.brand && (
              <Badge variant="outline" className="text-sm">
                {hotel.brand}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost" 
            size="icon"
            className="hover:bg-gray-100 rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Map */}
            <div className="h-64 md:h-80 rounded-lg overflow-hidden border">
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>
            
            {/* Details */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center">
                  <Bike className="h-5 w-5 mr-2 text-blue-600" />
                  <span className="text-lg font-medium">
                    {hotel.total_bikes} Peloton Bike{hotel.total_bikes !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex items-start">
                  <div className={cn(
                    "flex items-center mr-6",
                    hotel.in_gym 
                      ? "text-green-700 font-medium" 
                      : "text-gray-400"
                  )}>
                    <MapPin className="h-5 w-5 mr-1.5" />
                    <span>In Gym</span>
                  </div>
                  
                  <div className={cn(
                    "flex items-center",
                    hotel.in_room 
                      ? "text-purple-700 font-medium" 
                      : "text-gray-400"
                  )}>
                    <BedDouble className="h-5 w-5 mr-1.5" />
                    <span>In Room</span>
                  </div>
                </div>
              </div>
              
              {/* Features */}
              {hotel.bike_features && hotel.bike_features.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm text-gray-500 font-medium mb-2 flex items-center">
                    <ListChecks className="mr-1.5 h-4 w-4" />
                    Bike Features
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {hotel.bike_features.map(feature => (
                      <div 
                        key={feature}
                        className="flex items-center px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                      >
                        <span className="mr-1.5">{getFeatureIcon(feature)}</span>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Contact */}
              <div className="grid grid-cols-1 gap-2 border-t pt-4 mt-4">
                {hotel.tel && (
                  <a 
                    href={`tel:${hotel.tel}`}
                    className="flex items-center text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    {hotel.tel}
                  </a>
                )}
                
                {hotel.url && (
                  <a 
                    href={hotel.url.startsWith('http') ? hotel.url : `//${hotel.url}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Visit Website
                  </a>
                )}
                
                {hotel.distance_m !== null && hotel.distance_m !== undefined && (
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    {(hotel.distance_m / 1000).toFixed(1)} km away
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t mt-auto">
          <Button 
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
} 