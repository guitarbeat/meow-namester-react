/**
 * @module useTournament
 * @description A custom React hook for managing tournament state and progression.
 * This is now a wrapper around CatNamesContext for backward compatibility.
 * New components should use the useCatNames hook from contexts directly.
 * 
 * @deprecated Use the useCatNames hook from contexts instead
 */

import { useCatNames } from '../contexts';

export function useTournament() {
  const {
    // Tournament-specific state
    currentMatch,
    tournamentComplete,
    tournamentNames,
    voteHistory,
    ratings,
    startTournament,
    handleVote,
    
    // Name-related state for integration
    nameOptions,
    lastUpdate,
    
    // Shared state
    isLoading,
    error
  } = useCatNames();

  return {
    // Tournament-specific state
    currentMatch,
    tournamentComplete,
    tournamentNames,
    voteHistory,
    ratings,
    startTournament,
    handleVote,
    
    // Name-related state for integration
    nameOptions,
    lastUpdate,
    
    // Shared state
    isLoading,
    error
  };
} 