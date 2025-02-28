/**
 * @module useNameOptions
 * @description A custom React hook that manages cat name options.
 * This is now a wrapper around the CatNamesContext for backward compatibility.
 * New components should use the useCatNames hook from contexts directly.
 * 
 * @deprecated Use the useCatNames hook from contexts instead
 */

import { useCatNames } from '../contexts';

export function useNameOptions() {
  const {
    nameOptions,
    lastUpdate,
    addNameOption,
    hideNameOption,
    refreshNames,
    ratings,        // Include ratings for tournament integration
    isLoading,
    error,
    tournamentNames // Include tournament names for cross-referencing
  } = useCatNames();

  return {
    nameOptions,
    lastUpdate,
    addNameOption,
    hideNameOption,
    refreshNames,
    ratings,        // Expose ratings
    isLoading,
    error,
    tournamentNames // Expose tournament names
  };
}