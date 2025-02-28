/**
 * @module Tournament
 * @description A React component that handles the tournament-style voting interface for cat names.
 * Provides a UI for comparing two names, with options for liking both or neither.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { useAuth, useTournament, useUserPreferences } from '../../contexts';
import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorBoundary from '../ErrorBoundary/ErrorBoundary';
import NameCard from '../NameCard/NameCard';
import Bracket from '../Bracket/Bracket';
import TournamentControls from './TournamentControls';
import styles from './Tournament.module.css';
import { shuffleArray } from '../../utils/arrayUtils';

function TournamentContent() {
  const { userName } = useAuth();
  const { 
    currentMatch,
    handleVote,
    progress,
    roundNumber,
    currentMatchNumber = 1,
    totalMatches = 1,
    voteHistory,
    isError,
    isLoading,
    tournamentNames: names
  } = useTournament();
  const { preferences, updatePreferences } = useUserPreferences();

  // Memoize initial audio state
  const initialAudioState = useMemo(() => ({
    isMuted: !preferences.soundEnabled,
    volume: {
      music: preferences.musicVolume,
      effects: preferences.effectsVolume
    }
  }), []); // Empty deps since this should only run once

  const [randomizedNames, setRandomizedNames] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(initialAudioState.isMuted);
  const [volume, setVolume] = useState(initialAudioState.volume);
  const [audioError, setAudioError] = useState(null);
  const audioRef = useRef(null);
  const musicRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [lastMatchResult, setLastMatchResult] = useState(null);
  const [showMatchResult, setShowMatchResult] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [shouldUpdatePreferences, setShouldUpdatePreferences] = useState(false);

  const musicTracks = [
    { path: '/sounds/AdhesiveWombat - Night Shade.mp3', name: 'Night Shade' },
    { path: '/sounds/MiseryBusiness.mp3', name: 'Misery Business' },
    { path: '/sounds/what-is-love.mp3', name: 'What is Love' },
    { path: '/sounds/Lemon Demon - The Ultimate Showdown (8-Bit Remix).mp3', name: 'Ultimate Showdown (8-Bit)' },
    { path: '/sounds/Main Menu 1 (Ruins).mp3', name: 'Ruins' }
  ];

  // Sound effects configuration with updated weights
  const soundEffects = [
    { path: '/sounds/gameboy-pluck.mp3', weight: 0.5 },
    { path: '/sounds/wow.mp3', weight: 0.2 },
    { path: '/sounds/surprise.mp3', weight: 0.1 },
    { path: '/sounds/level-up.mp3', weight: 0.2 },
  ];

  // Initialize audio only once
  useEffect(() => {
    try {
      audioRef.current = new Audio(soundEffects[0].path);
      audioRef.current.volume = volume.effects;
      
      musicRef.current = new Audio(musicTracks[0].path);
      musicRef.current.volume = volume.music;
      musicRef.current.loop = true;
    } catch (error) {
      console.warn('Audio initialization failed:', error);
      setAudioError('Audio initialization failed. Some features may be unavailable.');
    }

    return () => {
      try {
        if (musicRef.current) {
          musicRef.current.pause();
          musicRef.current = null;
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      } catch (error) {
        console.warn('Error cleaning up audio:', error);
      }
    };
  }, []);

  // Function to pick a random sound effect based on weights
  const getRandomSoundEffect = useCallback(() => {
    const totalWeight = soundEffects.reduce((sum, effect) => sum + effect.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const effect of soundEffects) {
      if (random < effect.weight) {
        return effect.path;
      }
      random -= effect.weight;
    }
    
    return soundEffects[0].path; // Fallback to default sound
  }, []);

  const playSound = useCallback(() => {
    try {
      if (!isMuted && audioRef.current) {
        const soundEffect = getRandomSoundEffect();
        audioRef.current.src = soundEffect;
        audioRef.current.currentTime = 0;
        audioRef.current.volume = volume.effects;
        
        // Use Promise to handle play errors gracefully
        audioRef.current.play().catch(error => {
          // Ignore AbortError as it's expected when sounds are interrupted
          if (error.name !== 'AbortError') {
            console.warn('Error playing sound effect:', error);
          }
        });
      }
    } catch (error) {
      // Only log non-abort errors
      if (error.name !== 'AbortError') {
        console.warn('Error in playSound:', error);
      }
    }
  }, [isMuted, volume.effects, getRandomSoundEffect]);

  // Handle track changes
  useEffect(() => {
    let isSubscribed = true; // For cleanup/unmount handling

    const playNewTrack = async () => {
      try {
        if (!musicRef.current || !isSubscribed) return;

        await musicRef.current.pause();
        musicRef.current.src = musicTracks[currentTrack].path;
        musicRef.current.volume = volume.music;
        musicRef.current.loop = true;
        
        if (!isMuted && isSubscribed) {
          try {
            await musicRef.current.play();
            setAudioError(null);
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.warn('Error playing music:', error);
              setAudioError('Unable to play background music. Click to try again.');
            }
          }
        }
      } catch (error) {
        if (isSubscribed) {
          console.warn('Error handling track change:', error);
          setAudioError('Unable to change music track. Click to try again.');
        }
      }
    };

    playNewTrack();

    return () => {
      isSubscribed = false;
      try {
        if (musicRef.current) {
          musicRef.current.pause();
        }
      } catch (error) {
        console.warn('Error cleaning up music track:', error);
      }
    };
  }, [currentTrack, isMuted, volume.music]);

  // Sync with preference changes
  useEffect(() => {
    if (
      isMuted === !preferences.soundEnabled &&
      volume.music === preferences.musicVolume &&
      volume.effects === preferences.effectsVolume
    ) {
      return; // No changes needed
    }

    setIsMuted(!preferences.soundEnabled);
    setVolume({
      music: preferences.musicVolume,
      effects: preferences.effectsVolume
    });
  }, [preferences.soundEnabled, preferences.musicVolume, preferences.effectsVolume]);

  // Batch audio preference updates
  useEffect(() => {
    if (!shouldUpdatePreferences) return;

    const timeoutId = setTimeout(() => {
      const newPreferences = {
        soundEnabled: !isMuted,
        musicVolume: volume.music,
        effectsVolume: volume.effects
      };

      // Only update if values have actually changed
      if (
        newPreferences.soundEnabled === preferences.soundEnabled &&
        newPreferences.musicVolume === preferences.musicVolume &&
        newPreferences.effectsVolume === preferences.effectsVolume
      ) {
        setShouldUpdatePreferences(false);
        return;
      }

      updatePreferences(newPreferences);
      setShouldUpdatePreferences(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isMuted, volume, preferences, updatePreferences, shouldUpdatePreferences]);

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      try {
        if (newMuted) {
          if (musicRef.current) musicRef.current.pause();
          if (audioRef.current) audioRef.current.pause();
        } else if (musicRef.current) {
          musicRef.current.play().catch(error => {
            if (error.name !== 'AbortError') {
              console.warn('Error toggling mute:', error);
              setAudioError('Unable to play audio. Click to try again.');
            }
          });
        }
      } catch (error) {
        console.warn('Error toggling mute:', error);
      }
      setShouldUpdatePreferences(true);
      return newMuted;
    });
  }, []);

  const handleNextTrack = useCallback(() => {
    setCurrentTrack(prev => (prev + 1) % musicTracks.length);
  }, [musicTracks.length]);

  const retryAudio = useCallback(() => {
    if (audioError && !isMuted && musicRef.current) {
      musicRef.current.play()
        .then(() => setAudioError(null))
        .catch(error => {
          console.error('Error retrying audio:', error);
          setAudioError('Unable to play audio. Click to try again.');
        });
    }
  }, [audioError, isMuted]);

  // Track tournament state
  useEffect(() => {
    console.log('Current Match:', currentMatch);
    console.log('Current Match Number:', currentMatchNumber);
    console.log('Total Matches:', totalMatches);
    
    if (currentMatch) {
        console.log('🎮 Tournament: New match started:', {
            left: currentMatch.left.name,
            right: currentMatch.right.name,
            progress: `${currentMatchNumber}/${totalMatches}`
        });
    }
  }, [currentMatch, currentMatchNumber, totalMatches]);

  const handleRandomize = useCallback(() => {
    if (!isTransitioning && !isProcessing && !isRandomizing && Array.isArray(names) && names.length > 0) {
      // if (tournamentStateRef.current.isActive) {
        return;
      // }

      setIsRandomizing(true);
      setIsTransitioning(true);
      
      setTimeout(() => {
        setRandomizedNames(shuffleArray([...names]));
        setIsRandomizing(false);
        setIsTransitioning(false);
      }, 500);
    }
  }, [names, isTransitioning, isProcessing, isRandomizing]);

  // Track match results and tournament progress
  const updateMatchResult = useCallback((option) => {
    let resultMessage = '';
    if (option === 'both') {
      resultMessage = `Both "${currentMatch.left.name}" and "${currentMatch.right.name}" advance!`;
    } else if (option === 'left') {
      resultMessage = `"${currentMatch.left.name}" wins this round!`;
    } else if (option === 'right') {
      resultMessage = `"${currentMatch.right.name}" wins this round!`;
    } else if (option === 'neither') {
      resultMessage = 'Match skipped';
    }

    console.log('🎮 Tournament: Match result:', {
      result: resultMessage,
      option,
      match: {
        left: currentMatch.left.name,
        right: currentMatch.right.name
      }
    });

    setLastMatchResult(resultMessage);
    
    // Show result after a short delay
    setTimeout(() => setShowMatchResult(true), 500);
    // Hide result after 2 seconds
    setTimeout(() => setShowMatchResult(false), 2500);
  }, [currentMatch]);

  const handleVoteWithAnimation = async (option) => {
    if (isProcessing || isTransitioning || isError) {
        console.warn('🎮 Tournament: Vote blocked -', {
            isProcessing,
            isTransitioning,
            isError,
            currentMatch: currentMatch?.left.name + ' vs ' + currentMatch?.right.name
        });
        return;
    }
    
    try {
        console.log('🎮 Tournament: Processing vote:', {
            match: {
                left: currentMatch.left.name,
                right: currentMatch.right.name
            },
            option,
            matchNumber: currentMatchNumber,
            totalMatches
        });

        setIsProcessing(true);
        setIsTransitioning(true);
        
        playSound();
        updateMatchResult(option);
        
        await handleVote(option);
        setSelectedOption(null);
        
        console.log('🎮 Tournament: Vote processed successfully', {
            progress: `${currentMatchNumber}/${totalMatches}`,
            percentComplete: Math.round((currentMatchNumber / totalMatches) * 100)
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        setIsProcessing(false);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        setIsTransitioning(false);
    } catch (error) {
        console.error('❌ Tournament: Error handling vote:', {
            error,
            match: currentMatch,
            option
        });
        setIsProcessing(false);
        setIsTransitioning(false);
    }
  };

  // Separate click handler for name cards
  const handleNameCardClick = (option) => {
    if (isProcessing || isTransitioning) return;
    
    // Set the selected option first
    setSelectedOption(option);
    
    // Then trigger the vote
    handleVoteWithAnimation(option);
  };

  // Match result component
  const MatchResult = () => {
    if (!showMatchResult || !lastMatchResult) return null;

    return (
      <div 
        className={styles.matchResult}
        role="status"
        aria-live="polite"
      >
        <div className={styles.resultContent}>
          <span className={styles.resultMessage}>{lastMatchResult}</span>
          <span className={styles.tournamentProgress}>
            Round {roundNumber} - Match {currentMatchNumber} of {totalMatches}
          </span>
        </div>
      </div>
    );
  };

  const handleVolumeChange = useCallback((type, value) => {
    setVolume(prev => {
      const newVolume = { ...prev, [type]: value };
      if (audioRef.current && type === 'effects') {
        audioRef.current.volume = value;
      }
      if (musicRef.current && type === 'music') {
        musicRef.current.volume = value;
      }
      setShouldUpdatePreferences(true);
      return newVolume;
    });
  }, []);

  // Transform vote history for the Bracket component
  const transformedMatches = useMemo(() => {
    if (!voteHistory || !Array.isArray(voteHistory)) {
      return [];
    }
    
    // Track player stats
    const playerStats = new Map();
    
    // Initialize player stats
    voteHistory.forEach(vote => {
      if (!playerStats.has(vote.match.left.name)) {
        playerStats.set(vote.match.left.name, { wins: 0, losses: 0 });
      }
      if (!playerStats.has(vote.match.right.name)) {
        playerStats.set(vote.match.right.name, { wins: 0, losses: 0 });
      }
    });
    
    // Calculate stats from vote history
    voteHistory.forEach(vote => {
      const leftStats = playerStats.get(vote.match.left.name);
      const rightStats = playerStats.get(vote.match.right.name);
      
      if (vote.result === 'left') {
        // left won
        leftStats.wins++;
        rightStats.losses++;
      } else if (vote.result === 'right') {
        // right won
        rightStats.wins++;
        leftStats.losses++;
      } else if (vote.result === 'both') {
        // both advance
        leftStats.wins++;
        rightStats.wins++;
      }
      // Skip case: no stats change
    });
    
    return voteHistory.map((vote, index) => {
      // Convert string result to winner format
      let winner;
      if (vote.result === 'left') winner = -1;      // left won
      else if (vote.result === 'right') winner = 1;   // right won
      else if (vote.result === 'both') winner = 0;  // both advance
      else winner = 2; // skip/none

      return {
        id: index + 1,
        name1: vote.match.left.name,
        name2: vote.match.right.name,
        player1: {
          name: vote.match.left.name,
          description: vote.match.left.description,
          stats: playerStats.get(vote.match.left.name)
        },
        player2: {
          name: vote.match.right.name,
          description: vote.match.right.description,
          stats: playerStats.get(vote.match.right.name)
        },
        winner
      };
    });
  }, [voteHistory]);

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <h3>Tournament Error</h3>
        <p>There was an error with the tournament. Please try again.</p>
        <button 
          onClick={() => window.location.reload()} 
          className={styles.retryButton}
        >
          Restart Tournament
        </button>
      </div>
    );
  }

  if (isLoading || !currentMatch) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.tournament}>
      <div className={styles.progressInfo}>
        <div className={styles.roundInfo}>
          <span className={styles.roundNumber}>Round {roundNumber}</span>
          <span className={styles.matchCount}>
            Match {currentMatchNumber} of {totalMatches}
          </span>
        </div>
        <div className={styles.percentageInfo}>
          {Math.round((currentMatchNumber / totalMatches) * 100)}% Complete
        </div>
      </div>

      {currentMatch && (
        <div className={styles.matchup}>
          <div className={styles.namesRow}>
            <div className={`${styles.nameContainer} ${selectedOption === 'left' ? styles.selected : ''}`}>
              <NameCard
                name={currentMatch.left.name}
                description={currentMatch.left.description}
                onClick={() => handleNameCardClick('left')}
                isSelected={selectedOption === 'left'}
                isDisabled={isProcessing}
              />
            </div>
            <div className={styles.vsSection}>
              <span className={styles.vsText}>VS</span>
            </div>
            <div className={`${styles.nameContainer} ${selectedOption === 'right' ? styles.selected : ''}`}>
              <NameCard
                name={currentMatch.right.name}
                description={currentMatch.right.description}
                onClick={() => handleNameCardClick('right')}
                isSelected={selectedOption === 'right'}
                isDisabled={isProcessing}
              />
            </div>
          </div>
          <div className={styles.extraOptions}>
            <button
              className={`${styles.extraOptionsButton} ${selectedOption === 'both' ? styles.selected : ''}`}
              onClick={() => handleNameCardClick('both')}
              disabled={isProcessing}
            >
              I Like Both
            </button>
            <button
              className={`${styles.extraOptionsButton} ${selectedOption === 'none' ? styles.selected : ''}`}
              onClick={() => handleNameCardClick('none')}
              disabled={isProcessing}
            >
              Skip Both
            </button>
          </div>
        </div>
      )}

      <button
        className={styles.bracketToggle}
        onClick={() => setShowBracket(!showBracket)}
      >
        {showBracket ? 'Hide Bracket' : 'Show Bracket'}
      </button>

      {showBracket && (
        <div className={styles.bracketView}>
          <Bracket matches={transformedMatches} />
        </div>
      )}

      <TournamentControls
        onToggleMute={handleToggleMute}
        onVolumeChange={handleVolumeChange}
        onNextTrack={handleNextTrack}
        isMuted={isMuted}
        volume={volume}
        currentTrack={musicTracks[currentTrack]}
        audioError={audioError}
        onRetryAudio={retryAudio}
      />

      <MatchResult />
    </div>
  );
}

function Tournament() {
  return (
    <ErrorBoundary>
      <TournamentContent />
    </ErrorBoundary>
  );
}

export default Tournament; 