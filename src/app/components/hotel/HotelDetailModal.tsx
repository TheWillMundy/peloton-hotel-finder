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

    // Get marker color based on hotel data
    const getMarkerColor = () => {
      if (hotel.total_bikes && hotel.total_bikes > 0) {
        if (hotel.in_room) {
          return 'oklch(0.55 0.25 25)'; // Peloton red for in-room bikes
        } else if (hotel.total_bikes >= 3) {
          return 'oklch(0.5 0.15 340)'; // Deep burgundy for many bikes
        } else {
          return 'oklch(0.6 0.06 300)'; // Muted purple for few bikes
        }
      } else {
        return 'oklch(0.55 0.02 0)'; // Dark gray for no bikes
      }
    };

    // Add hotel marker with appropriate color
    new mapboxgl.Marker({ color: getMarkerColor() })
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

  // Feature icons mapping - consistent with HotelCard and HotelResultCard
  const getFeatureIcon = (feature: string) => {
    switch (feature.toLowerCase()) {
      case 'bike weights':
        return { icon: '⚖️', tooltip: 'Peloton bike includes weights' };
      case 'dual-sided spd pedals':
        return { icon: '👟', tooltip: 'Dual-sided SPD pedals compatible with cycling shoes' };
      case 'delta-compatible pedals':
        return { icon: '👟', tooltip: 'Delta-compatible pedals for Peloton/other cycling shoes' };
      case 'free weights':
        return { icon: '🏋️', tooltip: 'Access to free weights' };
      case 'resistance bands':
        return { icon: '🤸', tooltip: 'Resistance bands available' };
      case 'workout mat':
        return { icon: '🧘', tooltip: 'Workout mat provided' };
      case 'yoga blocks':
        return { icon: '🧱', tooltip: 'Yoga blocks available' };
      case 'bike screen':
        return { icon: '📱', tooltip: 'Bike includes a screen for classes' };
      default:
        return { icon: '✓', tooltip: feature }; // Default icon and use feature name as tooltip
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        className={cn(
          "bg-background rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col",
          className
        )}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{hotel.name}</h2>
            {(hotel.loyaltyProgram && hotel.loyaltyProgram !== "Other") ? (
              <Badge variant="outline" className="text-sm">
                {hotel.loyaltyProgram}
              </Badge>
            ) : hotel.brand ? (
              <Badge variant="outline" className="text-sm">
                {hotel.brand}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-sm border-dashed">
                Independent
              </Badge>
            )}
          </div>
          <Button
            variant="ghost" 
            size="icon"
            className="hover:bg-background/10 rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Map */}
            <div className="h-64 md:h-80 rounded-lg overflow-hidden border border-border">
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>
            
            {/* Details */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center">
                  <div className={cn(
                    "h-8 w-8 rounded-full mr-3 flex items-center justify-center text-white",
                    hotel.in_room ? "bg-in-room-marker" : 
                    hotel.total_bikes >= 3 ? "bg-many-bikes-marker" : 
                    hotel.total_bikes > 0 ? "bg-few-bikes-marker" : "bg-no-bikes-marker"
                  )}>
                    <Bike className="h-5 w-5" />
                  </div>
                  <span className="text-lg font-medium">
                    {hotel.total_bikes} Peloton Bike{hotel.total_bikes !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex items-start gap-3">
                  {/* Updated Gym/Room indicators to match card style */}
                  <div className={cn(
                    "flex items-center px-3 py-1.5 rounded-full",
                    hotel.in_gym 
                      ? "bg-few-bikes-marker text-white font-medium" 
                      : "bg-background/5 text-muted-foreground/60"
                  )}>
                    <MapPin className={cn("h-5 w-5 mr-1.5", hotel.in_gym ? "text-white" : "opacity-50")} />
                    <span className={hotel.in_gym ? "" : "line-through"}>In Gym</span>
                  </div>
                  
                  <div className={cn(
                    "flex items-center px-3 py-1.5 rounded-full",
                    hotel.in_room 
                      ? "bg-in-room-marker text-white font-medium" 
                      : "bg-background/5 text-muted-foreground/60"
                  )}>
                    <BedDouble className={cn("h-5 w-5 mr-1.5", hotel.in_room ? "text-white" : "opacity-50")} />
                    <span className={hotel.in_room ? "" : "line-through"}>In Room</span>
                  </div>
                </div>
              </div>
              
              {/* Features */}
              {hotel.bike_features && hotel.bike_features.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm text-muted-foreground font-medium mb-2 flex items-center">
                    <ListChecks className="mr-1.5 h-4 w-4" />
                    Bike Features
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {hotel.bike_features.map(feature => {
                      const { icon, tooltip } = getFeatureIcon(feature); // Get icon and tooltip
                      return (
                        <div 
                          key={feature}
                          title={tooltip} // Add tooltip here
                          className="flex items-center px-3 py-1.5 bg-background/5 rounded-full text-sm"
                        >
                          <span className="mr-1.5">{icon}</span>
                          {feature}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Contact */}
              <div className="grid grid-cols-1 gap-2 border-t border-border pt-4 mt-4">
                {hotel.tel && (
                  <a 
                    href={`tel:${hotel.tel}`}
                    className="flex items-center text-in-room-marker hover:text-in-room-marker/90 hover:underline"
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
                    className="flex items-center text-in-room-marker hover:text-in-room-marker/90 hover:underline"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Visit Website
                  </a>
                )}
                
                {hotel.distance_m !== null && hotel.distance_m !== undefined && (
                  <div className="flex items-center text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-2" />
                    {(hotel.distance_m / 1000).toFixed(1)} km away
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-border mt-auto">
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