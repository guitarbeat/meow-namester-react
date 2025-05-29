import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PreferenceSorter } from '../components/Tournament/PreferenceSorter';
import EloRating from '../components/Tournament/EloRating';
import useLocalStorage from './useLocalStorage';
import useUserSession from './useUserSession';

export function useTournament({ names = [], existingRatings = {}, onComplete }) {
  const { userName, isLoggedIn } = useUserSession();

  // Create a stable storage key using the names array and user name
  const tournamentId = useMemo(() => {
    const sortedNames = [...names].map(n => n.name).sort().join('-');
    const userPrefix = userName || 'anonymous';
    return `tournament-${userPrefix}-${sortedNames}`;
  }, [names, userName]);

  // Core tournament state
  const [currentMatch, setCurrentMatch] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [currentMatchNumber, setCurrentMatchNumber] = useState(1);
  const [totalMatches, setTotalMatches] = useState(1);
  const [sorter, setSorter] = useState(null);
  const [elo] = useState(() => new EloRating());
  const [resolveVote, setResolveVote] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [currentRatings, setCurrentRatings] = useState(existingRatings);
  const [isError, setIsError] = useState(false);

  // Use useLocalStorage for persistent tournament state
  const [tournamentState, setTournamentState] = useLocalStorage(tournamentId, {
    matchHistory: [],
    currentRound: 1,
    currentMatch: 1,
    totalMatches: 0,
    userName: userName || 'anonymous', // Store user context with tournament
    lastUpdated: Date.now()
  });

  // Destructure match history from tournament state
  const { matchHistory } = tournamentState;

  // Update tournament state helper
  const updateTournamentState = useCallback((updates) => {
    setTournamentState(prev => ({
      ...prev,
      ...updates,
      lastUpdated: Date.now(),
      userName: userName || 'anonymous'
    }));
  }, [setTournamentState, userName]);

  // Reset tournament state when user changes
  useEffect(() => {
    if (tournamentState.userName !== (userName || 'anonymous')) {
      updateTournamentState({
        matchHistory: [],
        currentRound: 1,
        currentMatch: 1,
        totalMatches: 0,
        userName: userName || 'anonymous'
      });
    }
  }, [userName, tournamentState.userName, updateTournamentState]);

  // Reset error state when names change
  useEffect(() => {
    setIsError(false);
  }, [names]);

  // Add validation check with early return
  if (!Array.isArray(names) || names.length < 2) {
    console.error('Invalid names array:', names);
    setIsError(true);
    return {
      currentMatch: null,
      handleVote: () => {},
      progress: 0,
      roundNumber: 0,
      currentMatchNumber: 0,
      totalMatches: 0,
      matchHistory: [],
      getCurrentRatings: () => [],
      isError: true
    };
  }

  // Reset tournament state when names change
  useEffect(() => {
    if (!names || names.length === 0) {
      return;
    }

    const nameStrings = names.map(n => n.name);
    const newSorter = new PreferenceSorter(nameStrings);
    setSorter(newSorter);
    
    const n = names.length;
    const estimatedMatches = n <= 2 ? 1 : Math.ceil(n * Math.log2(n));
    
    // Reset tournament state
    updateTournamentState({
      matchHistory: [],
      currentRound: 1,
      currentMatch: 1,
      totalMatches: estimatedMatches
    });

    setTotalMatches(estimatedMatches);
    setCurrentMatchNumber(1);
    setRoundNumber(1);
    setCanUndo(false);
    setCurrentRatings(existingRatings);

    runTournament(newSorter);
  }, [names, updateTournamentState]);

  // Define getCurrentRatings first since it's used in handleVote
  const getCurrentRatings = useCallback(() => {
    return names.map(name => {
          const existingData = typeof currentRatings[name.name] === 'object'
            ? currentRatings[name.name]
            : { rating: currentRatings[name.name] || 1500, wins: 0, losses: 0 };
    
          const totalNames = names.length;
          const position = matchHistory.filter(vote => 
            (vote.match.left.name === name.name && vote.result === 'left') ||
            (vote.match.right.name === name.name && vote.result === 'right')
          ).length;
    
          // Count wins and losses from vote history
          const wins = matchHistory.filter(vote => 
            (vote.match.left.name === name.name && vote.result === 'left') ||
            (vote.match.right.name === name.name && vote.result === 'right')
          ).length;
    
          const losses = matchHistory.filter(vote => 
            (vote.match.left.name === name.name && vote.result === 'right') ||
            (vote.match.right.name === name.name && vote.result === 'left')
          ).length;
    
          const ratingSpread = Math.min(1000, totalNames * 25);
          const positionValue = ((totalNames - position - 1) / (totalNames - 1)) * ratingSpread;
          const newPositionRating = 1500 + positionValue;
          const matchesPlayed = currentMatchNumber;
          const maxMatches = totalMatches;
          const blendFactor = Math.min(0.8, (matchesPlayed / maxMatches) * 0.9);
          const newRating = Math.round(
            (blendFactor * newPositionRating) +
            ((1 - blendFactor) * existingData.rating)
          );
          const minRating = 1000;
          const maxRating = 2000;
          const finalRating = Math.max(minRating, Math.min(maxRating, newRating));
    
          return {
            name: name.name,
            rating: finalRating,
            wins: existingData.wins + wins,
            losses: existingData.losses + losses,
            confidence: (matchesPlayed / maxMatches)
          };
        });
  }, [names, currentRatings, matchHistory, currentMatchNumber, totalMatches]);

  const handleVote = useCallback((result) => {
    if (isTransitioning || !resolveVote || isError) {
      return;
    }

    try {
      setIsTransitioning(true);
      
      // Convert vote to preference value for PreferenceSorter
      let voteValue;
      let eloOutcome;
      switch (result) {
        case 'left':
          voteValue = -1;
          eloOutcome = 'left';
          break;
        case 'right':
          voteValue = 1;
          eloOutcome = 'right';
          break;
        case 'both': // Both equally liked with small random variance
          voteValue = Math.random() * 0.1 - 0.05; // Small random value centered at 0
          eloOutcome = 'both';
          break;
        case 'none': // Neither liked with small random variance
          voteValue = Math.random() * 0.06 - 0.03; // Even smaller random value centered at 0
          eloOutcome = 'none';
          break;
        default:
          voteValue = 0;
          eloOutcome = 'none';
      }
      
      // Update Elo ratings
      const leftName = currentMatch.left.name;
      const rightName = currentMatch.right.name;
      
      const leftRating = currentRatings[leftName]?.rating || 1500;
      const rightRating = currentRatings[rightName]?.rating || 1500;
      
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
      } = elo.calculateNewRatings(leftRating, rightRating, eloOutcome, leftStats);
      
      // Update PreferenceSorter
      if (sorter) {
        sorter.addPreference(leftName, rightName, voteValue);
      }
      
      const voteData = {
        matchNumber: currentMatchNumber,
        result: voteValue,
        timestamp: Date.now(),
        userName: userName || 'anonymous',
        match: {
          left: {
            name: leftName,
            description: currentMatch.left.description || '',
            won: eloOutcome === 'left' || eloOutcome === 'both'
          },
          right: {
            name: rightName,
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

      // Update tournament state with new vote and ratings
      updateTournamentState(prev => ({
        ...prev,
        matchHistory: [...prev.matchHistory, voteData],
        currentMatch: currentMatchNumber + 1
      }));

      // Update current ratings with new ratings and win/loss counts
      setCurrentRatings(prev => ({
        ...prev,
        [leftName]: {
          ...prev[leftName],
          rating: updatedLeftRating,
          wins: newLeftWins,
          losses: newLeftLosses
        },
        [rightName]: {
          ...prev[rightName],
          rating: updatedRightRating,
          wins: newRightWins,
          losses: newRightLosses
        }
      }));
      
      setCanUndo(true);
      resolveVote(voteValue);
      
      if (currentMatchNumber >= totalMatches) {
        const finalRatings = getCurrentRatings();
        onComplete(finalRatings);
        return;
      }

      setCurrentMatchNumber(prev => prev + 1);
      
      if (names.length > 2) {
        const matchesPerRound = Math.ceil(names.length / 2);
        if (currentMatchNumber % matchesPerRound === 0) {
          const newRound = roundNumber + 1;
          setRoundNumber(newRound);
          updateTournamentState(prev => ({
            ...prev,
            currentRound: newRound
          }));
        }
      }
      
      // Ensure transition state is cleared
      const timeoutId = setTimeout(() => {
        setIsTransitioning(false);
      }, 500);

      return () => clearTimeout(timeoutId);
    } catch (error) {
      console.error('Vote handling error:', error);
      setIsError(true);
      setIsTransitioning(false);
    }
  }, [resolveVote, isTransitioning, currentMatchNumber, totalMatches, names.length, currentMatch, onComplete, getCurrentRatings, isError, roundNumber, updateTournamentState, userName, currentRatings, elo, sorter]);

  const runTournament = async (tournamentSorter) => {
    try {
      const initialState = {
        names,
        existingRatings,
        currentMatchNumber: 1,
        roundNumber: 1,
        matchHistory: []
      };
      localStorage.setItem('tournamentState', JSON.stringify(initialState));

      // Add timeout to prevent infinite waiting
      const sortedResults = await Promise.race([
        tournamentSorter.sort(async (leftName, rightName) => {
          const left = names.find(n => n.name === leftName);
          const right = names.find(n => n.name === rightName);
          if (!left || !right) {
            throw new Error('Invalid match pair');
          }
          setCurrentMatch({ left, right });
          return new Promise((resolve) => {
            setResolveVote(() => resolve);
          });
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tournament timeout')), 300000) // 5 minute timeout
        )
      ]);

      const ratingsArray = sortedResults.map((name, index) => {
        const existingData = typeof existingRatings[name] === 'object'
          ? existingRatings[name]
          : { rating: existingRatings[name] || 1500, wins: 0, losses: 0 };

        const totalNames = sortedResults.length;
        const position = index;
        const ratingSpread = Math.min(1000, totalNames * 25);
        const positionValue = ((totalNames - position - 1) / (totalNames - 1)) * ratingSpread;
        const newPositionRating = 1500 + positionValue;
        const matchesPlayed = currentMatchNumber;
        const maxMatches = totalMatches;
        const blendFactor = Math.min(0.8, (matchesPlayed / maxMatches) * 0.9);
        const newRating = Math.round(
          (blendFactor * newPositionRating) +
          ((1 - blendFactor) * existingData.rating)
        );
        const minRating = 1000;
        const maxRating = 2000;
        const finalRating = Math.max(minRating, Math.min(maxRating, newRating));

        return {
          name,
          rating: finalRating,
          wins: existingData.wins,
          losses: existingData.losses,
          confidence: (matchesPlayed / maxMatches)
        };
      });

      localStorage.removeItem('tournamentState');
      onComplete(ratingsArray);
    } catch (error) {
      console.error('Tournament error:', error);
      setIsError(true);
      // Clear tournament state on error
      localStorage.removeItem('tournamentState');
      // Reset all state
      setCurrentMatch(null);
      setIsTransitioning(false);
      setRoundNumber(1);
      setCurrentMatchNumber(1);
      updateTournamentState(prev => ({ ...prev, matchHistory: [] }));
      setCanUndo(false);
      throw error; // Propagate error to parent
    }
  };

  const handleUndo = useCallback(() => {
    if (isTransitioning || !canUndo || matchHistory.length === 0) {
      return;
    }

    setIsTransitioning(true);

    const lastVote = matchHistory[matchHistory.length - 1];
    setCurrentMatch(lastVote.match);
    setCurrentMatchNumber(lastVote.matchNumber);
    updateTournamentState(prev => ({ ...prev, matchHistory: prev.matchHistory.slice(0, -1) }));
    
    if (sorter) {
      sorter.undoLastPreference();
    }

    if (currentMatchNumber % Math.ceil(names.length / 2) === 1) {
      setRoundNumber(prev => prev - 1);
    }

    setCanUndo(matchHistory.length > 1);
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 500);
  }, [isTransitioning, canUndo, matchHistory, names.length, sorter]);

  const progress = Math.round((currentMatchNumber / totalMatches) * 100);

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
    matchHistory: tournamentState.matchHistory,
    userName: tournamentState.userName
  };
} 