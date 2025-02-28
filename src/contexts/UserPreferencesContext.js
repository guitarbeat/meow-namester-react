import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase/supabaseClient';

const UserPreferencesContext = createContext();

// Move defaultPreferences outside component to prevent recreation
const DEFAULT_PREFERENCES = {
  theme: 'light',
  soundEnabled: true,
  musicVolume: 0.5,
  effectsVolume: 0.7,
  hiddenNames: [],  // Store as array instead of Set
  viewMode: 'individual',
  sortPreference: 'rating',
  filterStatus: 'active'
};

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}

export function UserPreferencesProvider({ children }) {
  const { userName, isInitialized } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Convert hiddenNames array to Set for easier operations
  const hiddenNamesSet = useMemo(() => 
    new Set(preferences.hiddenNames), 
    [preferences.hiddenNames]
  );

  // Load preferences from localStorage
  useEffect(() => {
    // Wait for auth to be initialized
    if (!isInitialized) {
      return;
    }

    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (!userName) {
          setPreferences(DEFAULT_PREFERENCES);
          return;
        }
        
        // Load from localStorage
        const localPrefs = localStorage.getItem(`userPreferences_${userName}`);
        if (localPrefs) {
          const parsedPrefs = JSON.parse(localPrefs);
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...parsedPrefs,
            // Ensure hiddenNames is always an array
            hiddenNames: Array.isArray(parsedPrefs.hiddenNames) 
              ? parsedPrefs.hiddenNames 
              : []
          });
        } else {
          // If no preferences exist, save defaults
          localStorage.setItem(
            `userPreferences_${userName}`, 
            JSON.stringify(DEFAULT_PREFERENCES)
          );
          setPreferences(DEFAULT_PREFERENCES);
        }
      } catch (err) {
        console.warn('Error loading preferences:', err);
        setError(err.message);
        // Fall back to defaults on error
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [userName, isInitialized]); // Remove defaultPreferences dependency

  const updatePreferences = async (updates) => {
    try {
      const newPreferences = {
        ...preferences,
        ...updates,
        // Ensure hiddenNames stays as array when updating
        hiddenNames: Array.isArray(updates.hiddenNames) 
          ? updates.hiddenNames 
          : updates.hiddenNames 
            ? Array.from(updates.hiddenNames)
            : preferences.hiddenNames
      };

      // Save to localStorage if user is logged in
      if (userName) {
        localStorage.setItem(
          `userPreferences_${userName}`,
          JSON.stringify(newPreferences)
        );
      }

      setPreferences(newPreferences);
    } catch (err) {
      console.warn('Error updating preferences:', err);
      setError(err.message);
    }
  };

  const value = {
    preferences: {
      ...preferences,
      hiddenNames: hiddenNamesSet // Provide Set interface to consumers
    },
    isLoading,
    error,
    updatePreferences
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
} 