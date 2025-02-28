import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { PreferenceSorter } from '../components/Tournament/PreferenceSorter';
import EloRating from '../components/Tournament/EloRating';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase/supabaseClient';
import useLocalStorage from '../hooks/useLocalStorage';

// Debug logger with consistent formatting
const log = (action, data) => {
  console.log(`🐱 CatNames [${action}]:`, data);
};

const logError = (action, error) => {
  console.error(`❌ CatNames [${action}]:`, error);
};

const CatNamesContext = createContext();

export function useCatNames() {
  const context = useContext(CatNamesContext);
  if (!context) {
    throw new Error('useCatNames must be used within a CatNamesProvider');
  }
  return context;
}

export function CatNamesProvider({ children }) {
  const { userName } = useAuth();
  
  // Name options state
  const [nameOptions, setNameOptions] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Tournament state
  const [currentMatch, setCurrentMatch] = useState(null);
  const [tournamentComplete, setTournamentComplete] = useState(false);
  const [tournamentNames, setTournamentNames] = useState(null);
  const [voteHistory, setVoteHistory] = useState([]);
  const [ratings, setRatings] = useState({});
  const [elo] = useState(() => new EloRating());
  const [sorter, setSorter] = useState(null);
  
  // Shared state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tournament ID for local storage
  const tournamentId = useMemo(() => {
    if (!tournamentNames) return null;
    const sortedNames = [...tournamentNames].map(n => n.name).sort().join('-');
    const userPrefix = userName || 'anonymous';
    return `tournament-${userPrefix}-${sortedNames}`;
  }, [tournamentNames, userName]);

  // Local storage for tournament state
  const [persistedState, setPersistedState] = useLocalStorage(tournamentId || 'tournament-temp', {
    voteHistory: [],
    currentRound: 1,
    currentMatch: null,
    totalMatches: 0,
    userName: userName || 'anonymous',
    lastUpdated: Date.now()
  });

  // Fetch name options and ratings
  const fetchNameOptions = async (retryCount = 0) => {
    try {
      if (!userName) {
        log('Anonymous User', {
          message: 'No username yet - waiting for login',
          retryCount
        });
        setNameOptions([]);
        setLastUpdate(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      log('Fetching Names', { userName, retryCount });

      // First get hidden name IDs
      const { data: hiddenData, error: hiddenError } = await supabase
        .from('hidden_names')
        .select('name_id');
      
      if (hiddenError) {
        logError('Hidden Names', hiddenError);
        if (retryCount < 3) {
          setTimeout(() => fetchNameOptions(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        throw hiddenError;
      }

      const hiddenIds = hiddenData?.map(item => item.name_id) || [];

      // Get names with ratings
      let query = supabase
        .from('name_options')
        .select(`
          id,
          name,
          description,
          created_at,
          cat_name_ratings!inner (
            rating,
            wins,
            losses,
            updated_at
          )
        `)
        .eq('cat_name_ratings.user_name', userName)
        .order('created_at', { ascending: true });

      // Only apply hidden filter if there are hidden IDs
      if (hiddenIds.length > 0) {
        query = query.not('id', 'in', `(${hiddenIds.join(',')})`);
      }

      const { data, error: fetchError } = await query;

      // Handle the case where user hasn't rated any names yet
      if (fetchError?.code === 'PGRST116' || !data?.length) {
        log('First Time User', {
          userName,
          message: 'Fetching all names with default ratings'
        });

        let namesQuery = supabase
          .from('name_options')
          .select(`
            id,
            name,
            description,
            created_at
          `)
          .order('created_at', { ascending: true });

        if (hiddenIds.length > 0) {
          namesQuery = namesQuery.not('id', 'in', `(${hiddenIds.join(',')})`);
        }

        const { data: namesOnly, error: namesError } = await namesQuery;

        if (namesError) {
          logError('Names Only Fetch', namesError);
          if (retryCount < 3) {
            setTimeout(() => fetchNameOptions(retryCount + 1), 1000 * (retryCount + 1));
            return;
          }
          throw namesError;
        }

        // Transform data to include default rating values
        const processedData = namesOnly?.map(name => ({
          ...name,
          cat_name_ratings: [{
            rating: 1500,
            wins: 0,
            losses: 0,
            updated_at: null
          }]
        })) || [];

        log('Names Loaded (Default Ratings)', {
          count: processedData.length,
          names: processedData.map(n => n.name)
        });

        setNameOptions(processedData);
        setLastUpdate(new Date().toISOString());
        
        // Update ratings state
        const ratingsMap = {};
        processedData.forEach(item => {
          ratingsMap[item.name] = {
            rating: 1500,
            wins: 0,
            losses: 0,
            name_id: item.id
          };
        });
        setRatings(ratingsMap);
        
        setIsLoading(false);
        return;
      }

      if (fetchError) {
        logError('Fetch Names', fetchError);
        if (retryCount < 3) {
          setTimeout(() => fetchNameOptions(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        throw fetchError;
      }

      log('Names Loaded', {
        count: data?.length || 0,
        names: data?.map(n => n.name) || []
      });

      setNameOptions(data || []);
      setLastUpdate(new Date().toISOString());
      
      // Update ratings state
      const ratingsMap = {};
      data.forEach(item => {
        ratingsMap[item.name] = {
          rating: item.cat_name_ratings[0].rating,
          wins: item.cat_name_ratings[0].wins,
          losses: item.cat_name_ratings[0].losses,
          name_id: item.id
        };
      });
      setRatings(ratingsMap);
      
    } catch (err) {
      logError('Fetch Names', {
        error: err,
        context: {
          userName,
          currentCount: nameOptions.length,
          lastUpdate
        }
      });
      setError('Unable to load names. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and subscription setup
  useEffect(() => {
    let isSubscribed = true;
    
    const setupSubscription = async () => {
      if (!isSubscribed) return;
      if (!userName) return;
      
      log('Setup', { userName, isSubscribed });
      
      await fetchNameOptions();
      
      const channel = supabase.channel('db-changes');

      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'name_options'
          },
          (payload) => {
            if (!isSubscribed) return;
            if (payload.eventType !== 'SYNC') {
              log('Database Change', {
                event: payload.eventType,
                record: payload.new?.name || payload.old?.name
              });
              fetchNameOptions();
            }
          }
        )
        .subscribe();

      return () => {
        isSubscribed = false;
        channel.unsubscribe();
      };
    };

    setupSubscription();
    return () => { isSubscribed = false; };
  }, [userName]);

  // Restore tournament state
  useEffect(() => {
    if (persistedState.userName !== (userName || 'anonymous')) {
      setVoteHistory([]);
      setCurrentMatch(null);
      setTournamentComplete(false);
      setTournamentNames(null);
    } else if (persistedState.voteHistory.length > 0) {
      setVoteHistory(persistedState.voteHistory);
      setCurrentMatch(persistedState.currentMatch);
    }
  }, [persistedState, userName]);

  // Sync tournament state
  useEffect(() => {
    if (tournamentId) {
      const stateToSync = {
        voteHistory,
        currentMatch,
        totalMatches: currentMatch?.totalMatches || tournamentNames?.length || 0,
        userName: userName || 'anonymous',
        lastUpdated: Date.now()
      };
      
      log('Syncing Tournament', {
        tournamentId,
        voteHistoryLength: voteHistory.length,
        hasCurrentMatch: !!currentMatch
      });
      
      setPersistedState(stateToSync);
    }
  }, [tournamentId, voteHistory, currentMatch, tournamentNames, userName, setPersistedState]);

  const addNameOption = async (newName, description = '') => {
    if (!newName?.trim()) {
      logError('Add Name', 'Name is required');
      throw new Error('Name is required');
    }
    
    try {
      setIsLoading(true);
      setError(null);

      log('Adding Name', { name: newName, description });

      // First insert the name
      const { data: nameData, error: insertError } = await supabase
        .from('name_options')
        .insert([{ 
          name: newName.trim(),
          description: description.trim()
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Then create initial rating
      const { error: ratingError } = await supabase
        .from('cat_name_ratings')
        .insert([{
          user_name: userName,
          name_id: nameData.id,
          rating: 1500,
          wins: 0,
          losses: 0
        }]);

      if (ratingError) throw ratingError;
      
      log('Name Added', { name: newName });
      await fetchNameOptions();
      
    } catch (err) {
      logError('Add Name', { error: err, name: newName });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const hideNameOption = async (nameId) => {
    try {
      setIsLoading(true);
      setError(null);

      log('Hiding Name', { nameId });

      const { error: hideError } = await supabase
        .from('hidden_names')
        .insert([{ name_id: nameId }]);

      if (hideError) throw hideError;

      log('Name Hidden', { nameId });
      await fetchNameOptions();
      
    } catch (err) {
      logError('Hide Name', { error: err, nameId });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const startTournament = (names) => {
    if (!Array.isArray(names) || names.length < 2) {
      logError('Start Tournament', 'Invalid names array');
      setError('Invalid names array');
      return;
    }

    log('Starting Tournament', {
      totalNames: names.length,
      names: names.map(n => n.name)
    });

    const newSorter = new PreferenceSorter(names);
    const remainingPairs = newSorter.getRemainingPairs();
    const totalMatches = remainingPairs.length;
    
    // Reset tournament state
    setSorter(newSorter);
    setTournamentNames(names);
    setTournamentComplete(false);
    setVoteHistory([]);
    setError(null);
    
    // Get first pair and ensure we have valid name objects
    const [firstPair] = remainingPairs;
    const firstLeft = names.find(n => n.name === firstPair[0]);
    const firstRight = names.find(n => n.name === firstPair[1]);

    // Validate that we found both names
    if (!firstLeft || !firstRight) {
      const error = 'Failed to find name objects for first match';
      logError('Start Tournament', {
        error,
        firstPair,
        foundLeft: !!firstLeft,
        foundRight: !!firstRight,
        availableNames: names.map(n => n.name)
      });
      setError(error);
      return false;
    }
    
    // Create first match with proper name objects
    const firstMatch = {
      left: firstLeft,
      right: firstRight,
      matchNumber: 1,
      totalMatches
    };

    log('First Match', {
      match: `${firstMatch.left.name} vs ${firstMatch.right.name}`,
      progress: `1/${totalMatches}`
    });

    setCurrentMatch(firstMatch);
    return true;
  };

  const handleVote = async (result) => {
    if (!sorter || !currentMatch) {
      logError('Handle Vote', 'Missing sorter or current match');
      return;
    }

    try {
      setIsLoading(true);
      
      // Calculate match numbers
      const totalMatches = sorter.getRemainingPairs().length + voteHistory.length;
      const currentMatchNumber = voteHistory.length + 1;
      
      log('Processing Vote', {
        match: `${currentMatch.left.name} vs ${currentMatch.right.name}`,
        result,
        progress: `${currentMatchNumber}/${totalMatches}`
      });
      
      // Record vote with timestamp and ratings
      const vote = {
        match: {
          left: currentMatch.left,
          right: currentMatch.right,
          matchNumber: currentMatchNumber,
          totalMatches
        },
        result,
        timestamp: Date.now(),
        ratings: {
          before: {
            left: ratings[currentMatch.left.name]?.rating || 1500,
            right: ratings[currentMatch.right.name]?.rating || 1500
          }
        }
      };

      // Update vote history
      const newVoteHistory = [...voteHistory, vote];
      setVoteHistory(newVoteHistory);

      // Process the vote in the sorter
      sorter.recordMatch(currentMatch.left.name, currentMatch.right.name, result);
      
      // Get next match if available
      const remainingPairs = sorter.getRemainingPairs();
      if (remainingPairs.length > 0) {
        const [nextPair] = remainingPairs;
        
        // Ensure we have valid name objects for the next match
        const nextLeft = tournamentNames.find(n => n.name === nextPair[0]);
        const nextRight = tournamentNames.find(n => n.name === nextPair[1]);

        // Validate that we found both names
        if (!nextLeft || !nextRight) {
          logError('Next Match Setup', {
            error: 'Failed to find name objects for next match',
            nextPair,
            foundLeft: !!nextLeft,
            foundRight: !!nextRight,
            availableNames: tournamentNames.map(n => n.name)
          });
          throw new Error('Failed to set up next match - missing name data');
        }

        const nextMatch = {
          left: nextLeft,
          right: nextRight,
          matchNumber: currentMatchNumber + 1,
          totalMatches
        };
        
        log('Next Match', {
          match: `${nextMatch.left.name} vs ${nextMatch.right.name}`,
          progress: `${nextMatch.matchNumber}/${totalMatches}`
        });
        
        setCurrentMatch(nextMatch);
      } else {
        log('Tournament Complete', {
          totalMatches,
          totalVotes: newVoteHistory.length
        });
        setCurrentMatch(null);
        setTournamentComplete(true);
      }

      // Update Elo ratings
      const { 
        newRatingA, 
        newRatingB,
        winsA,
        lossesA,
        winsB,
        lossesB
      } = elo.calculateNewRatings(
        vote.ratings.before.left,
        vote.ratings.before.right,
        result,
        {
          winsA: ratings[currentMatch.left.name]?.wins || 0,
          lossesA: ratings[currentMatch.left.name]?.losses || 0,
          winsB: ratings[currentMatch.right.name]?.wins || 0,
          lossesB: ratings[currentMatch.right.name]?.losses || 0
        }
      );

      // Update ratings in database
      const recordsToUpsert = [
        {
          user_name: userName,
          name_id: currentMatch.left.id,
          rating: Math.round(newRatingA),
          wins: winsA,
          losses: lossesA,
          updated_at: new Date().toISOString()
        },
        {
          user_name: userName,
          name_id: currentMatch.right.id,
          rating: Math.round(newRatingB),
          wins: winsB,
          losses: lossesB,
          updated_at: new Date().toISOString()
        }
      ];

      const { error: upsertError } = await supabase
        .from('cat_name_ratings')
        .upsert(recordsToUpsert, {
          onConflict: 'user_name,name_id',
          returning: 'minimal'
        });

      if (upsertError) throw upsertError;

      // Update local ratings state
      const updatedRatings = {
        ...ratings,
        [currentMatch.left.name]: {
          rating: newRatingA,
          wins: winsA,
          losses: lossesA,
          name_id: currentMatch.left.id
        },
        [currentMatch.right.name]: {
          rating: newRatingB,
          wins: winsB,
          losses: lossesB,
          name_id: currentMatch.right.id
        }
      };
      
      setRatings(updatedRatings);
      
      // Update vote with new ratings
      vote.ratings.after = {
        left: newRatingA,
        right: newRatingB
      };

    } catch (err) {
      logError('Handle Vote', {
        error: err,
        currentMatch,
        result
      });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    // Name options state
    nameOptions,
    lastUpdate,
    addNameOption,
    hideNameOption,
    refreshNames: fetchNameOptions,
    
    // Tournament state
    currentMatch,
    tournamentComplete,
    tournamentNames,
    voteHistory,
    ratings,
    startTournament,
    handleVote,
    
    // Shared state
    isLoading,
    error
  };

  return <CatNamesContext.Provider value={value}>{children}</CatNamesContext.Provider>;
} 