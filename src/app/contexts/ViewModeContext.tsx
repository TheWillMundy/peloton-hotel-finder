"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ViewMode } from '@/app/components/ViewToggle';

interface ViewModeContextProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextProps | undefined>(undefined);

export function ViewModeProvider({ children, initialMode = 'map' }: {
  children: ReactNode;
  initialMode?: ViewMode;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  
  return context;
} 