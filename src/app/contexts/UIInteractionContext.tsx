"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type UIInteractionSource = 'initial_match' | 'map_hover' | 'sidebar_hover' | 'list_click' | 'none';

interface UIInteractionState {
  activeHotelId: number | null;
  interactionSource: UIInteractionSource;
}

interface UIInteractionContextType {
  uiState: UIInteractionState;
  setActiveHotel: (id: number, source: UIInteractionSource) => void;
  clearActiveHotel: () => void;
}

const initialState: UIInteractionState = {
  activeHotelId: null,
  interactionSource: 'none',
};

const UIInteractionContext = createContext<UIInteractionContextType | undefined>(undefined);

export function UIInteractionProvider({ children }: { children: ReactNode }) {
  const [uiState, setUIState] = useState<UIInteractionState>(initialState);

  const setActiveHotel = useCallback((id: number, source: UIInteractionSource) => {
    setUIState({ activeHotelId: id, interactionSource: source });
  }, []);

  const clearActiveHotel = useCallback(() => {
    setUIState(initialState);
  }, []);

  return (
    <UIInteractionContext.Provider value={{ uiState, setActiveHotel, clearActiveHotel }}>
      {children}
    </UIInteractionContext.Provider>
  );
}

export function useUIInteraction() {
  const context = useContext(UIInteractionContext);
  if (!context) {
    throw new Error('useUIInteraction must be used within a UIInteractionProvider');
  }
  return context;
} 