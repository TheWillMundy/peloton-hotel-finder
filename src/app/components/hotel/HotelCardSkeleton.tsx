import React from 'react';
import { Skeleton } from '@/app/components/ui/skeleton';

const HotelCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="space-y-2">
        {/* Hotel name */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Hotel brand/chain */}
        <Skeleton className="h-4 w-1/2" />
        
        {/* Bike features */}
        <div className="flex space-x-2 items-center mt-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        
        {/* Distance and other info */}
        <div className="flex justify-between mt-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
};

export default HotelCardSkeleton; 