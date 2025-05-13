"use client";

import { useState, useEffect } from 'react';

// Constants
const SESSION_TOKEN_KEY = 'mapbox_session_token';
const SESSION_TIMESTAMP_KEY = 'mapbox_session_timestamp';
const SESSION_DURATION = 60 * 60 * 1000; // 60 minutes in milliseconds

interface SessionData {
  token: string;
  timestamp: number;
}

/**
 * Custom hook to manage Mapbox Search session tokens with localStorage persistence
 * 
 * This ensures we reuse the same session token for a certain period (60 minutes by default)
 * to minimize billable API sessions.
 */
export function useMapboxSession() {
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  
  // Load or generate a session token
  useEffect(() => {
    // Safely check localStorage (only runs client-side)
    const getStoredSession = (): SessionData | null => {
      try {
        const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);
        const storedTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
        
        if (storedToken && storedTimestamp) {
          return {
            token: storedToken,
            timestamp: parseInt(storedTimestamp, 10)
          };
        }
      } catch (e) {
        console.error('Error accessing localStorage:', e);
      }
      return null;
    };
    
    // Store a new session token with current timestamp
    const storeNewSession = (token: string) => {
      try {
        const now = Date.now();
        localStorage.setItem(SESSION_TOKEN_KEY, token);
        localStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());
        return { token, timestamp: now };
      } catch (e) {
        console.error('Error writing to localStorage:', e);
        return null;
      }
    };
    
    // Generate a fresh UUID token
    const generateNewToken = () => {
      const newToken = crypto.randomUUID();
      setSessionToken(newToken);
      storeNewSession(newToken);
    };
    
    // Main logic to check and refresh the token
    const checkAndRefreshToken = () => {
      const storedSession = getStoredSession();
      
      // If we have a valid stored session that hasn't expired
      if (storedSession) {
        const now = Date.now();
        const elapsed = now - storedSession.timestamp;
        
        if (elapsed < SESSION_DURATION) {
          // Session is still valid - use it
          setSessionToken(storedSession.token);
        } else {
          // Session has expired - generate a new one
          generateNewToken();
        }
      } else {
        // No valid session found - generate new one
        generateNewToken();
      }
    };
    
    // Initial check and setup
    checkAndRefreshToken();
    
    // Set up interval to periodically check token expiration
    // Check every 15 minutes instead of every 30 seconds
    const intervalId = setInterval(checkAndRefreshToken, 15 * 60 * 1000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  return sessionToken;
} 