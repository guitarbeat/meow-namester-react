import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { KeyboardControlsProvider, useKeyboardControls } from './KeyboardControlsContext';
import { UserPreferencesProvider, useUserPreferences } from './UserPreferencesContext';
import { CatNamesProvider, useCatNames } from './CatNamesContext';

// Re-export all providers and hooks
export {
  // Providers
  AuthProvider,
  KeyboardControlsProvider,
  UserPreferencesProvider,
  CatNamesProvider,
  
  // Core hooks
  useAuth,
  useKeyboardControls,
  useUserPreferences,
  useCatNames,
  
};

// Re-export the legacy hooks
export { useTournament } from '../hooks/useTournament';
export { useNameOptions } from '../supabase/useNameOptions';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <UserPreferencesProvider>
        <CatNamesProvider>
          <KeyboardControlsProvider>
            {children}
          </KeyboardControlsProvider>
        </CatNamesProvider>
      </UserPreferencesProvider>
    </AuthProvider>
  );
} 