"use client";

import { Map, List } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'list' | 'map';

interface ViewToggleProps {
  activeView: ViewMode;
  onChange: (view: ViewMode) => void;
  className?: string;
}

export default function ViewToggle({ activeView, onChange, className }: ViewToggleProps) {
  return (
    <div className={cn(
      "inline-flex items-center rounded-lg border bg-white/95 backdrop-blur-sm shadow-sm p-1", 
      className
    )}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange('list')}
        className={cn(
          "h-8 rounded-md px-3", 
          activeView === 'list' 
            ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm" 
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        )}
      >
        <List className="mr-1.5 h-4 w-4" />
        List
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange('map')}
        className={cn(
          "h-8 rounded-md px-3", 
          activeView === 'map' 
            ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm" 
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        )}
      >
        <Map className="mr-1.5 h-4 w-4" />
        Map
      </Button>
    </div>
  );
} 