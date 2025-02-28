import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useCatNames } from './CatNamesContext';
import { useUserPreferences } from './UserPreferencesContext';

const KeyboardControlsContext = createContext();

export function useKeyboardControls() {
  const context = useContext(KeyboardControlsContext);
  if (!context) {
    throw new Error('useKeyboardControls must be used within a KeyboardControlsProvider');
  }
  return context;
}

export function KeyboardControlsProvider({ children }) {
  const { preferences } = useUserPreferences();
  
  const [isDisabled, setIsDisabled] = useState(false);
  const [handlers, setHandlers] = useState({
    onLeft: null,
    onRight: null,
    onBoth: null,
    onNone: null,
    onUndo: null
  });

  // Register keyboard handlers for a component
  const registerHandlers = useCallback((newHandlers) => {
    setHandlers(newHandlers);
    return () => {
      setHandlers({
        onLeft: null,
        onRight: null,
        onBoth: null,
        onNone: null,
        onUndo: null
      });
    };
  }, []);

  // Toggle keyboard controls
  const toggleControls = useCallback((disabled) => {
    setIsDisabled(disabled);
  }, []);

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isDisabled) return;
      
      // Don't handle keyboard events if user is typing in an input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      switch(event.key.toLowerCase()) {
        case 'arrowleft':
          event.preventDefault();
          if (handlers.onLeft) {
            handlers.onLeft();
            // Play sound effect if enabled
            if (preferences?.soundEnabled) {
              // You could add sound effects here
            }
          }
          break;
        case 'arrowright':
          event.preventDefault();
          if (handlers.onRight) {
            handlers.onRight();
            if (preferences?.soundEnabled) {
              // You could add sound effects here
            }
          }
          break;
        case 'b':
          event.preventDefault();
          if (handlers.onBoth) {
            handlers.onBoth();
            if (preferences?.soundEnabled) {
              // You could add sound effects here
            }
          }
          break;
        case 'n':
          event.preventDefault();
          if (handlers.onNone) {
            handlers.onNone();
            if (preferences?.soundEnabled) {
              // You could add sound effects here
            }
          }
          break;
        case 'u':
          event.preventDefault();
          if (handlers.onUndo) {
            handlers.onUndo();
            if (preferences?.soundEnabled) {
              // You could add sound effects here
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, isDisabled, preferences?.soundEnabled]);

  const value = {
    registerHandlers,
    toggleControls,
    isDisabled
  };

  return (
    <KeyboardControlsContext.Provider value={value}>
      {children}
    </KeyboardControlsContext.Provider>
  );
} 