import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cubic bezier function (from reference)
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return function(t: number) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const term1 = Math.pow(1 - t, 3) * 0; // Assuming P0 is (0,0)
    const term2 = 3 * Math.pow(1 - t, 2) * t * y1;
    const term3 = 3 * (1 - t) * Math.pow(t, 2) * y2;
    const term4 = Math.pow(t, 3) * 1; // Assuming P3 is (1,1)
    return term1 + term2 + term3 + term4;
  }
}

// Add this utility function for calculating distance between coordinates
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert degrees to radians
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
