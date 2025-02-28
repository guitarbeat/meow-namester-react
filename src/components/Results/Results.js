/**
 * @module Results
 * @description Main results component that displays the final rankings of cat names.
 * Shows the tournament results with ratings and provides option to restart.
 */

import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTournament, useUserPreferences, useNameOptions } from '../../contexts';
import { LoadingSpinner, ErrorBoundary } from '../';
import RankingAdjustment from '../RankingAdjustment/RankingAdjustment';
import Bracket from '../Bracket/Bracket';
import styles from './Results.module.css';

// Memoized stats card component for better performance
const StatsCard = memo(({ title, value }) => (
  <div className={styles.statCard} role="status" aria-label={`${title}: ${value}`}>
    <h3>{title}</h3>
    <div className={styles.statValue}>{value}</div>
  </div>
));

// Toast component extracted for reusability
const Toast = memo(({ message, type, onClose }) => (
  <div 
    role="alert"
    className={type === 'success' ? styles.toastSuccess : styles.toastError}
    onClick={onClose}
  >
    {message}
  </div>
));

function Results({ 
  ratings, 
  userName, 
  onUpdateRatings, 
  currentTournamentNames, 
  voteHistory,
  onStartNewTournament 
}) {
  const navigate = useNavigate();
  const { nameOptions } = useNameOptions();
  
  const [currentRankings, setCurrentRankings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Convert vote history to bracket matches
  const getBracketMatches = useCallback(() => {
    if (!voteHistory || !voteHistory.length) {
      console.log('🏆 Results: No vote history available');
      return [];
    }
    
    console.log('🏆 Results: Processing vote history:', {
      totalVotes: voteHistory.length,
      tournamentNames: currentTournamentNames?.length || 0
    });
    
    // Filter to only include matches from the current tournament
    const tournamentNameSet = new Set(currentTournamentNames?.map(n => n.name) || []);
    
    // Get current stats for all names
    const nameStats = {};
    Object.entries(ratings || {}).forEach(([name, rating]) => {
      nameStats[name] = {
        wins: rating.wins || 0,
        losses: rating.losses || 0
      };
    });
    
    const matches = voteHistory
      .filter(vote => 
        tournamentNameSet.has(vote.match.left.name) && 
        tournamentNameSet.has(vote.match.right.name)
      )
      .map((vote, index) => ({
        id: index + 1,
        name1: vote.match.left.name,
        name2: vote.match.right.name,
        winner: vote.result < 0 ? -1 : vote.result > 0 ? 1 : 0,
        player1: {
          name: vote.match.left.name,
          ...nameStats[vote.match.left.name]
        },
        player2: {
          name: vote.match.right.name,
          ...nameStats[vote.match.right.name]
        }
      }));

    console.log('🏆 Results: Bracket matches processed:', {
      totalMatches: matches.length,
      validMatches: matches.filter(m => m.winner !== undefined).length
    });

    return matches;
  }, [voteHistory, currentTournamentNames, ratings]);

  // Memoized rankings processor
  const processRankings = useCallback((ratingsData) => {
    // Filter to only include names from the current tournament
    const tournamentNameSet = new Set(currentTournamentNames?.map(n => n.name) || []);
    
    return Object.entries(ratingsData || {})
      .filter(([name]) => tournamentNameSet.has(name))
      .map(([name, rating]) => ({
        name,
        rating: Math.round(typeof rating === 'number' ? rating : rating?.rating || 1500),
        wins: typeof rating === 'object' ? rating.wins || 0 : 0,
        losses: typeof rating === 'object' ? rating.losses || 0 : 0,
        change: 0
      }))
      .sort((a, b) => b.rating - a.rating);
  }, [currentTournamentNames]);

  useEffect(() => {
    const processRatings = async () => {
      if (!currentTournamentNames?.length) {
        console.log('🏆 Results: No tournament names to process');
        return;
      }

      setIsLoading(true);

      // Wait for ratings to be available
      let retryCount = 0;
      while (!nameOptions?.length && retryCount < 5) {
        console.log('🏆 Results: Waiting for ratings', { 
          retryCount,
          nameOptionsCount: nameOptions?.length || 0,
          tournamentNamesCount: currentTournamentNames?.length || 0
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryCount++;
      }

      const ratingsMap = new Map();
      nameOptions?.forEach(option => {
        const rating = option.cat_name_ratings?.[0]?.rating || 1500;
        ratingsMap.set(option.name, rating);
      });

      const processedRankings = currentTournamentNames.map(name => ({
        name,
        rating: ratingsMap.get(name) || 1500
      }));

      console.log('🏆 Results: Processing complete', {
        totalRatings: ratingsMap.size,
        processedNames: processedRankings.length,
        tournamentNames: currentTournamentNames.length
      });

      setCurrentRankings(processedRankings);
      setIsLoading(false);
    };

    processRatings();
  }, [currentTournamentNames, nameOptions]);

  const handleSaveAdjustments = useCallback(async (adjustedRankings) => {
    try {
      setIsLoading(true);
      
      console.log('🏆 Results: Starting rankings update:', {
        adjustedCount: adjustedRankings.length,
        currentCount: currentRankings.length
      });
      
      const updatedRankings = adjustedRankings.map(ranking => {
        const oldRanking = currentRankings.find(r => r.name === ranking.name);
        const ratingChange = oldRanking ? ranking.rating - oldRanking.rating : 0;
        
        console.log('🏆 Results: Processing ranking update:', {
          name: ranking.name,
          oldRating: oldRanking?.rating,
          newRating: ranking.rating,
          change: ratingChange
        });

        return {
          ...ranking,
          change: ratingChange
        };
      });

      const newRatings = updatedRankings.map(({ name, rating }) => {
        const existingRating = ratings[name];
        const nameOption = nameOptions.find(n => n.name === name);
        
        if (!existingRating?.name_id && !nameOption?.id) {
          console.warn('⚠️ Results: Missing name_id for rating:', {
            name,
            existingRating,
            nameOption
          });
        }
        
        return {
          name,
          name_id: existingRating?.name_id || nameOption?.id,
          rating: Math.round(rating),
          wins: existingRating?.wins || 0,
          losses: existingRating?.losses || 0
        };
      });

      console.log('🏆 Results: Updating ratings:', {
        totalUpdates: newRatings.length,
        validUpdates: newRatings.filter(r => r.name_id).length
      });

      await onUpdateRatings(newRatings);
      setCurrentRankings(updatedRankings);
      
      setToast({
        show: true,
        message: 'Rankings updated successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('❌ Results: Failed to update rankings:', {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint
      });
      
      let errorMessage = 'Failed to update rankings. ';
      if (error.code === '23502') {
        errorMessage += 'Missing required name ID for one or more names.';
      } else {
        errorMessage += 'Please try again.';
      }
      
      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentRankings, ratings, onUpdateRatings, nameOptions]);

  const closeToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(closeToast, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show, closeToast]);

  // Memoize processed rankings
  const processedRankings = useMemo(() => 
    processRankings(ratings), [ratings]
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Tournament Results</h1>
        <div className={styles.headerActions}>
          <button 
            onClick={async () => {
              try {
                setIsLoading(true);
                const success = await onStartNewTournament();
                if (success) {
                  navigate('/tournament', { replace: true });
                } else {
                  throw new Error('Failed to start tournament');
                }
              } catch (error) {
                console.error('Error starting new tournament:', error);
                setToast({
                  show: true,
                  message: 'Failed to start new tournament. Please try again.',
                  type: 'error'
                });
              } finally {
                setIsLoading(false);
              }
            }}
            className={styles.actionButton}
            disabled={isLoading}
          >
            <span className={styles.buttonIcon}>🏆</span>
            Start New Tournament
          </button>
          <button 
            onClick={() => navigate('/profile', { replace: true })}
            className={styles.actionButton}
            disabled={isLoading}
          >
            <span className={styles.buttonIcon}>👤</span>
            My Profile
          </button>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.rankingsSection}>
          <h2>Final Rankings</h2>
          <RankingAdjustment
            rankings={currentRankings}
            onSave={handleSaveAdjustments}
            isLoading={isLoading}
          />
        </section>

        <section className={styles.bracketSection}>
          <h2>Tournament History</h2>
          <Bracket matches={getBracketMatches()} />
        </section>
      </div>

      {toast.show && (
        <div 
          className={`${styles.toast} ${styles[toast.type]}`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default function ResultsWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Results />
    </ErrorBoundary>
  );
}
