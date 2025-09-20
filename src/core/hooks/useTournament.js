import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PreferenceSorter } from '../../features/tournament/PreferenceSorter';
import EloRating from '../../features/tournament/EloRating';
import useLocalStorage from './useLocalStorage';
import useUserSession from './useUserSession';
import {
  computeRating,
  buildComparisonsMap,
  initializeSorterPairs,
  getPreferencesMap
} from '../../shared/utils/tournamentUtils';

/**
 * Custom hook for managing tournament state and logic
 * @param {Object} params - Tournament parameters
 * @param {Array} params.names - Array of names to compete in tournament
 * @param {Object} params.existingRatings - Existing ratings for names
 * @param {Function} params.onComplete - Callback when tournament completes
 * @returns {Object} Tournament state and handlers
 */
export function useTournament({
  names = [],
  existingRatings = {},
  onComplete
}) {
  // Single Elo instance
  const elo = useMemo(() => new EloRating(), []);
  const didLogMountRef = useRef(false);
  if (process.env.NODE_ENV === 'development' && !didLogMountRef.current) {
    // * Log once per component instance, even under StrictMode double-invoke

    console.debug('[DEV] 🎮 useTournament: mount');
    didLogMountRef.current = true;
  }

  const { userName } = useUserSession();

  // * Tournament state management
  const [tournamentState, setTournamentState] = useState({
    currentMatch: null,
    isTransitioning: false,
    roundNumber: 1,
    currentMatchNumber: 1,
    totalMatches: 0,
    canUndo: false,
    currentRatings: existingRatings,
    isError: false,
    sorter: null
  });

  // * Helper function to update tournament state
  const updateTournamentState = useCallback((updates) => {
    setTournamentState((prev) => ({ ...prev, ...updates }));
  }, []);

  // * Destructure state for easier access
  const {
    currentMatch,
    isTransitioning,
    roundNumber,
    currentMatchNumber,
    totalMatches,
    canUndo,
    currentRatings,
    isError,
    sorter
  } = tournamentState;

  // * Persistent storage setup
  const tournamentId = useMemo(() => {
    const sortedNames = [...names]
      .map((n) => n.name)
      .sort()
      .join('-');
    const userPrefix = userName || 'anonymous';
    return `tournament-${userPrefix}-${sortedNames}`;
  }, [names, userName]);

  const [persistentState, setPersistentState] = useLocalStorage(tournamentId, {
    matchHistory: [],
    currentRound: 1,
    currentMatch: 1,
    totalMatches: 0,
    userName: userName || 'anonymous',
    lastUpdated: Date.now(),
    namesKey: ''
  });

  // * Update persistent state helper
  const updatePersistentState = useCallback(
    (updates) => {
      if (typeof updates === 'function') {
        setPersistentState((prev) => {
          const delta = updates(prev) || {};
          return {
            ...prev,
            ...delta,
            lastUpdated: Date.now(),
            userName: userName || 'anonymous'
          };
        });
      } else {
        setPersistentState((prev) => ({
          ...prev,
          ...updates,
          lastUpdated: Date.now(),
          userName: userName || 'anonymous'
        }));
      }
    },
    [userName, setPersistentState]
  );

  // * Tournament initialization logic
  const lastInitKeyRef = useRef('');
  const initializeTournament = useCallback(async () => {
    // Guard invalid input
    if (!Array.isArray(names) || names.length < 2) return;

    const namesKey = names.map((n) => n.id || n.name).join(',');

    // Skip re-init when names set is unchanged
    if (lastInitKeyRef.current === namesKey) return;
    lastInitKeyRef.current = namesKey;
    const nameStrings = names.map((n) => n.name);
    const newSorter = new PreferenceSorter(nameStrings);

    // * Calculate estimated matches
    const estimatedMatches =
      names.length === 2
        ? 1
        : Math.ceil(names.length * Math.log2(names.length));

    // * Reset tournament state
    updateTournamentState({
      sorter: newSorter,
      totalMatches: estimatedMatches,
      currentMatchNumber: 1,
      roundNumber: 1,
      canUndo: false,
      currentRatings: existingRatings,
      isError: false
    });

    // * Update persistent state
    updatePersistentState({
      matchHistory: [],
      currentRound: 1,
      currentMatch: 1,
      totalMatches: estimatedMatches,
      namesKey
    });

    // * Set up first match (adaptive if possible)
    if (names.length >= 2) {
      const first = getNextMatch(names, newSorter, 1, {
        currentRatings: existingRatings,
        history: []
      });
      if (first) {
        updateTournamentState({ currentMatch: first });
      } else {
        const left = names[0];
        const right = names[1];
        updateTournamentState({ currentMatch: { left, right } });
      }
    }
  }, [names, existingRatings, updateTournamentState, updatePersistentState]);

  // * Reset tournament state when user changes
  useEffect(() => {
    if (persistentState.userName !== (userName || 'anonymous')) {
      updatePersistentState({
        matchHistory: [],
        currentRound: 1,
        currentMatch: 1,
        totalMatches: 0,
        userName: userName || 'anonymous',
        namesKey: ''
      });
    }
  }, [userName, persistentState.userName, updatePersistentState]);

  // * Initialize tournament when names change
  useEffect(() => {
    initializeTournament();
  }, [initializeTournament]);

  // * Validate names array
  // * Treat empty arrays as a loading state (not an error) to avoid noisy logs during initialization
  useEffect(() => {
    const invalid =
      !Array.isArray(names) || (names.length > 0 && names.length < 2);
    if (invalid !== isError) {
      if (invalid && process.env.NODE_ENV === 'development') {
        console.warn('[DEV] 🎮 useTournament: Invalid names array detected');
      }
      updateTournamentState({ isError: invalid });
    }
  }, [names, isError, updateTournamentState]);

  // * Cleanup on unmount
  useEffect(() => {
    return () => {
      updateTournamentState({
        currentMatch: null,
        isTransitioning: false,
        currentMatchNumber: 1,
        roundNumber: 1
      });
    };
  }, [updateTournamentState]);

  // * Rating calculation logic
  const getCurrentRatings = useCallback(() => {
    const countPlayerVotes = (playerName, outcome) => {
      return persistentState.matchHistory.filter((vote) => {
        const { left, right } = vote.match;
        if (outcome === 'win') {
          return (
            (left.name === playerName && vote.result === 'left') ||
            (right.name === playerName && vote.result === 'right')
          );
        }
        if (outcome === 'loss') {
          return (
            (left.name === playerName && vote.result === 'right') ||
            (right.name === playerName && vote.result === 'left')
          );
        }
        return false;
      }).length;
    };

    return names.map((name) => {
      const existingData =
        typeof currentRatings[name.name] === 'object'
          ? currentRatings[name.name]
          : { rating: currentRatings[name.name] || 1500, wins: 0, losses: 0 };

      const wins = countPlayerVotes(name.name, 'win');
      const losses = countPlayerVotes(name.name, 'loss');
      const position = wins;

      const finalRating = computeRating(
        existingData.rating,
        position,
        names.length,
        currentMatchNumber,
        totalMatches
      );

      return {
        name: name.name,
        rating: finalRating,
        wins: existingData.wins + wins,
        losses: existingData.losses + losses,
        confidence: currentMatchNumber / totalMatches
      };
    });
  }, [
    names,
    currentRatings,
    persistentState.matchHistory,
    currentMatchNumber,
    totalMatches
  ]);

  // * Vote handling logic
  const handleVote = useCallback(
    (result) => {
      if (isTransitioning || isError || !currentMatch) {
        return;
      }

      try {
        updateTournamentState({ isTransitioning: true });

        // * Convert vote to preference value and Elo outcome
        const { voteValue, eloOutcome } = convertVoteToOutcome(result);

        // * Get current ratings
        const leftName = currentMatch.left.name;
        const rightName = currentMatch.right.name;
        const leftRating = currentRatings[leftName]?.rating || 1500;
        const rightRating = currentRatings[rightName]?.rating || 1500;

        // * Calculate new Elo ratings
        const leftStats = {
          winsA: currentRatings[leftName]?.wins || 0,
          lossesA: currentRatings[leftName]?.losses || 0,
          winsB: currentRatings[rightName]?.wins || 0,
          lossesB: currentRatings[rightName]?.losses || 0
        };

        const {
          newRatingA: updatedLeftRating,
          newRatingB: updatedRightRating,
          winsA: newLeftWins,
          lossesA: newLeftLosses,
          winsB: newRightWins,
          lossesB: newRightLosses
        } = elo.calculateNewRatings(
          leftRating,
          rightRating,
          eloOutcome,
          leftStats
        );

        // * Update PreferenceSorter
        if (sorter && typeof sorter.addPreference === 'function') {
          sorter.addPreference(leftName, rightName, voteValue);
        } else if (sorter && sorter.preferences instanceof Map) {
          // Fallback: record preference directly on existing map
          const key = `${leftName}-${rightName}`;
          sorter.preferences.set(key, voteValue);
        }

        // * Create vote data
        const voteData = createVoteData({
          result: voteValue,
          matchNumber: currentMatchNumber,
          currentMatch,
          eloOutcome,
          leftRating,
          rightRating,
          updatedLeftRating,
          updatedRightRating,
          userName
        });

        // * Update persistent state
        updatePersistentState((prev) => ({
          ...prev,
          matchHistory: [...prev.matchHistory, voteData],
          currentMatch: currentMatchNumber + 1
        }));

        // * Update current ratings
        updateTournamentState({
          currentRatings: {
            ...currentRatings,
            [leftName]: {
              ...currentRatings[leftName],
              rating: updatedLeftRating,
              wins: newLeftWins,
              losses: newLeftLosses
            },
            [rightName]: {
              ...currentRatings[rightName],
              rating: updatedRightRating,
              wins: newRightWins,
              losses: newRightLosses
            }
          },
          canUndo: true
        });

        // * Check if tournament is complete
        if (currentMatchNumber >= totalMatches) {
          const finalRatings = getCurrentRatings();
          onComplete(finalRatings);
          return;
        }

        // * Move to next match
        updateTournamentState({
          currentMatchNumber: currentMatchNumber + 1
        });

        // * Update round number if needed
        if (names.length > 2) {
          const matchesPerRound = Math.ceil(names.length / 2);
          if (currentMatchNumber % matchesPerRound === 0) {
            const newRound = roundNumber + 1;
            updateTournamentState({ roundNumber: newRound });
            updatePersistentState({ currentRound: newRound });
          }
        }

        // * Set up next match (adaptive pairing prefers close ratings + higher uncertainty)
        const nextMatch = getNextMatch(names, sorter, currentMatchNumber + 1, {
          currentRatings: {
            ...currentRatings,
            [leftName]: {
              ...currentRatings[leftName],
              rating: updatedLeftRating
            },
            [rightName]: {
              ...currentRatings[rightName],
              rating: updatedRightRating
            }
          },
          history: persistentState.matchHistory || []
        });
        if (nextMatch) {
          updateTournamentState({ currentMatch: nextMatch });
        }

        // * Clear transition state after delay
        const timeoutId = setTimeout(() => {
          updateTournamentState({ isTransitioning: false });
        }, 500);

        return () => clearTimeout(timeoutId);
      } catch (error) {
        console.error('Vote handling error:', error);
        updateTournamentState({
          isError: true,
          isTransitioning: false
        });
      }
    },
    [
      isTransitioning,
      isError,
      currentMatch,
      currentMatchNumber,
      totalMatches,
      names,
      roundNumber,
      currentRatings,
      sorter,
      onComplete,
      getCurrentRatings,
      updateTournamentState,
      updatePersistentState,
      userName,
      elo,
      persistentState.matchHistory
    ]
  );

  // * Undo functionality
  const handleUndo = useCallback(() => {
    if (
      isTransitioning ||
      !canUndo ||
      persistentState.matchHistory.length === 0
    ) {
      return;
    }

    updateTournamentState({ isTransitioning: true });

    const lastVote =
      persistentState.matchHistory[persistentState.matchHistory.length - 1];

    updateTournamentState({
      currentMatch: lastVote.match,
      currentMatchNumber: lastVote.matchNumber
    });

    updatePersistentState({
      matchHistory: persistentState.matchHistory.slice(0, -1)
    });

    if (sorter && typeof sorter.undoLastPreference === 'function') {
      sorter.undoLastPreference();
    } else if (sorter && sorter.preferences instanceof Map) {
      // Fallback: remove last preference directly
      const key = `${lastVote.match.left.name}-${lastVote.match.right.name}`;
      const reverseKey = `${lastVote.match.right.name}-${lastVote.match.left.name}`;
      sorter.preferences.delete(key);
      sorter.preferences.delete(reverseKey);
      if (typeof sorter._pairIndex === 'number') {
        sorter._pairIndex = Math.max(0, sorter._pairIndex - 1);
      }
    }

    // * Update round number if needed
    if (currentMatchNumber % Math.ceil(names.length / 2) === 1) {
      updateTournamentState({ roundNumber: roundNumber - 1 });
    }

    updateTournamentState({
      canUndo: persistentState.matchHistory.length > 1
    });

    setTimeout(() => {
      updateTournamentState({ isTransitioning: false });
    }, 500);
  }, [
    isTransitioning,
    canUndo,
    persistentState.matchHistory,
    names.length,
    sorter,
    currentMatchNumber,
    roundNumber,
    updateTournamentState,
    updatePersistentState
  ]);

  // * Calculate progress
  const progress = Math.round((currentMatchNumber / totalMatches) * 100);

  // * Return error state if there's an error
  if (isError) {
    return {
      currentMatch: null,
      handleVote: () => {},
      progress: 0,
      roundNumber: 0,
      currentMatchNumber: 0,
      totalMatches: 0,
      matchHistory: [],
      getCurrentRatings: () => [],
      isError: true,
      userName: persistentState.userName
    };
  }

  // * Return tournament state and handlers
  return {
    currentMatch,
    isTransitioning,
    roundNumber,
    currentMatchNumber,
    totalMatches,
    progress,
    handleVote,
    handleUndo,
    canUndo,
    getCurrentRatings,
    isError,
    matchHistory: persistentState.matchHistory,
    userName: persistentState.userName
  };
}

// * Helper functions

/**
 * Convert vote result to preference value and Elo outcome
 * @param {string} result - Vote result ('left', 'right', 'both', 'none')
 * @returns {Object} Object containing voteValue and eloOutcome
 */
function convertVoteToOutcome(result) {
  switch (result) {
    case 'left':
      return { voteValue: -1, eloOutcome: 'left' };
    case 'right':
      return { voteValue: 1, eloOutcome: 'right' };
    case 'both':
      return {
        voteValue: Math.random() * 0.1 - 0.05,
        eloOutcome: 'both'
      };
    case 'none':
      return {
        voteValue: Math.random() * 0.06 - 0.03,
        eloOutcome: 'none'
      };
    default:
      return { voteValue: 0, eloOutcome: 'none' };
  }
}

/**
 * Create vote data object
 * @param {Object} params - Vote parameters
 * @returns {Object} Vote data object
 */
function createVoteData({
  result,
  matchNumber,
  currentMatch,
  eloOutcome,
  leftRating,
  rightRating,
  updatedLeftRating,
  updatedRightRating,
  userName
}) {
  return {
    matchNumber,
    result,
    timestamp: Date.now(),
    userName: userName || 'anonymous',
    match: {
      left: {
        name: currentMatch.left.name,
        description: currentMatch.left.description || '',
        won: eloOutcome === 'left' || eloOutcome === 'both'
      },
      right: {
        name: currentMatch.right.name,
        description: currentMatch.right.description || '',
        won: eloOutcome === 'right' || eloOutcome === 'both'
      }
    },
    ratings: {
      before: {
        left: leftRating,
        right: rightRating
      },
      after: {
        left: updatedLeftRating,
        right: updatedRightRating
      }
    }
  };
}

/**
 * Get the next match for the tournament
 * @param {Array} names - Array of names
 * @param {PreferenceSorter} sorter - Preference sorter instance
 * @param {number} matchNumber - Current match number
 * @returns {Object|null} Next match object or null if no more matches
 */
function getNextMatch(names, sorter, _matchNumber, options = {}) {
  if (!sorter || names.length <= 2) {
    return null;
  }

  // Preferred: adaptive pairing using ratings/history if provided
  if (options && (options.currentRatings || options.history)) {
    try {
      const nameList = names.map((n) => n.name);
      initializeSorterPairs(sorter, nameList);

      const prefs = getPreferencesMap(sorter);
      const ratings = options.currentRatings || {};
      const history = options.history || [];
      const comparisons = buildComparisonsMap(history);

      let bestPair = null;
      let bestScore = Infinity;
      for (let idx = sorter._pairIndex; idx < sorter._pairs.length; idx++) {
        const [a, b] = sorter._pairs[idx];
        const key = `${a}-${b}`;
        const reverseKey = `${b}-${a}`;
        if (prefs.has(key) || prefs.has(reverseKey)) continue;
        const ra =
          ratings[a]?.rating ??
          (typeof ratings[a] === 'number' ? ratings[a] : 1500);
        const rb =
          ratings[b]?.rating ??
          (typeof ratings[b] === 'number' ? ratings[b] : 1500);
        const diff = Math.abs(ra - rb);
        const ca = comparisons.get(a) || 0;
        const cb = comparisons.get(b) || 0;
        const uncScore = 1 / (1 + ca) + 1 / (1 + cb);
        const score = diff - 50 * uncScore;
        if (score < bestScore) {
          bestScore = score;
          bestPair = [a, b];
        }
      }

      if (bestPair) {
        const [a, b] = bestPair;
        sorter._pairIndex = Math.max(
          0,
          sorter._pairs.findIndex((p) => p[0] === a && p[1] === b)
        );
        return {
          left: names.find((n) => n.name === a) || { name: a },
          right: names.find((n) => n.name === b) || { name: b }
        };
      }
    } catch (e) {
      console.warn('Adaptive next-match selection failed:', e);
    }
  }

  // Next preference: use sorter's own next-match API if present
  if (typeof sorter.getNextMatch === 'function') {
    try {
      const nextMatch = sorter.getNextMatch();
      if (nextMatch) {
        return {
          left: names.find((n) => n.name === nextMatch.left) || nextMatch.left,
          right:
            names.find((n) => n.name === nextMatch.right) || nextMatch.right
        };
      }
    } catch (error) {
      console.warn('Could not get next match from sorter:', error);
    }
  }

  // Fallback: generate pairwise comparisons on the fly using the sorter's preference map
  try {
    const nameList = names.map((n) => n.name);
    initializeSorterPairs(sorter, nameList);

    const prefs = getPreferencesMap(sorter);

    // Adaptive pairing: prefer unjudged pairs with small rating difference and higher uncertainty
    const ratings = options.currentRatings || {};
    const history = options.history || [];

    // Build a quick lookup of comparisons per name to approximate uncertainty
    const comparisons = buildComparisonsMap(history);

    let bestPair = null;
    let bestScore = Infinity; // lower is better

    for (let idx = sorter._pairIndex; idx < sorter._pairs.length; idx++) {
      const [a, b] = sorter._pairs[idx];
      const key = `${a}-${b}`;
      const reverseKey = `${b}-${a}`;
      if (prefs.has(key) || prefs.has(reverseKey)) continue; // already judged

      const ra =
        ratings[a]?.rating ??
        (typeof ratings[a] === 'number' ? ratings[a] : 1500);
      const rb =
        ratings[b]?.rating ??
        (typeof ratings[b] === 'number' ? ratings[b] : 1500);
      const diff = Math.abs(ra - rb);

      const ca = comparisons.get(a) || 0;
      const cb = comparisons.get(b) || 0;
      const uncScore = 1 / (1 + ca) + 1 / (1 + cb); // higher means more uncertain

      // Combined score: prefer low rating diff and higher uncertainty
      // Weight diff more heavily, reduce by uncertainty
      const score = diff - 50 * uncScore;

      if (score < bestScore) {
        bestScore = score;
        bestPair = [a, b];
      }
    }

    if (bestPair) {
      const [a, b] = bestPair;
      // Move currentIndex close to the chosen pair to keep iteration stable
      sorter._pairIndex = Math.max(
        0,
        sorter._pairs.findIndex((p) => p[0] === a && p[1] === b)
      );
      return {
        left: names.find((n) => n.name === a) || { name: a },
        right: names.find((n) => n.name === b) || { name: b }
      };
    }
  } catch (e) {
    console.warn('Fallback next-match generation failed:', e);
  }

  return null;
}
