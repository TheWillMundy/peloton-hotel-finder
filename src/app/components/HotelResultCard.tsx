"use client";

import { ClientHotel } from "@/lib/pelotonAPI";
import { MapPin, Phone, Globe, Bike, Building, Users } from 'lucide-react'; // Using lucide-react for icons

interface HotelResultCardProps {
  hotel: ClientHotel;
}

export default function HotelResultCard({ hotel }: HotelResultCardProps) {
  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow duration-300 ease-in-out">
      <div className="p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2 leading-tight">{hotel.name}</h3>
        
        {hotel.brand && (
          <p className="text-sm text-blue-600 font-semibold mb-3 tracking-wide">{hotel.brand}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mb-4 text-gray-700 text-sm">
          <div className="flex items-center">
            <Bike className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" />
            <span>Total Bikes: <span className="font-semibold">{hotel.total_bikes}</span></span>
          </div>
          {hotel.in_gym !== undefined && (
            <div className="flex items-center">
              <Building className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" />
              <span>In Gym: <span className={`font-semibold ${hotel.in_gym ? 'text-green-600' : 'text-red-600'}`}>{hotel.in_gym ? "Yes" : "No"}</span></span>
            </div>
          )}
          {hotel.in_room !== undefined && (
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" /> 
              <span>In Room: <span className={`font-semibold ${hotel.in_room ? 'text-green-600' : 'text-red-600'}`}>{hotel.in_room ? "Yes" : "No"}</span></span>
            </div>
          )}
          {hotel.distance_m !== null && hotel.distance_m !== undefined && (
            <div className="flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" />
              <span>Distance: <span className="font-semibold">{(hotel.distance_m / 1000).toFixed(1)} km</span></span>
            </div>
          )}
        </div>

        {hotel.bike_features && hotel.bike_features.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs text-gray-500 uppercase font-semibold mb-1">Bike Features:</h4>
            <div className="flex flex-wrap gap-2">
              {hotel.bike_features.map((feature) => (
                <span key={feature} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {hotel.tel && (
              <a 
                href={`tel:${hotel.tel}`}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
              >
                <Phone className="h-4 w-4 mr-2" />
                {hotel.tel}
              </a>
            )}
            {hotel.url && (
              <a 
                href={hotel.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
              >
                <Globe className="h-4 w-4 mr-2" />
                Visit Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 