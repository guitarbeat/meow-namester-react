/**
 * @module Tournament
 * @description A React component that handles the tournament-style voting interface for cat names.
 * Provides a UI for comparing two names, with options for liking both or neither.
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo
} from 'react';
import PropTypes from 'prop-types';
import { useTournament } from '../../core/hooks/useTournament';
import useToast from '../../core/hooks/useToast';
import LoadingSpinner from '../../shared/components/LoadingSpinner/LoadingSpinner';
import ErrorBoundary from '../../shared/components/ErrorBoundary/ErrorBoundary';
import NameCard from '../../shared/components/NameCard/NameCard';
import InlineError from '../../shared/components/InlineError/InlineError';
import Bracket from '../../shared/components/Bracket/Bracket';
import TournamentControls from './TournamentControls';
import styles from './Tournament.module.css';
import { shuffleArray } from '../../shared/utils/arrayUtils';

// * Custom hook for audio management
function useAudioManager() {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState({ music: 0.2, effects: 0.3 });
  const [audioError, setAudioError] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);

  const audioRef = useRef(null);
  const musicRef = useRef(null);

  const musicTracks = useMemo(
    () => [
      {
        path: '/assets/sounds/AdhesiveWombat - Night Shade.mp3',
        name: 'Night Shade'
      },
      { path: '/assets/sounds/MiseryBusiness.mp3', name: 'Misery Business' },
      { path: '/assets/sounds/what-is-love.mp3', name: 'What is Love' },
      {
        path: '/assets/sounds/Lemon Demon - The Ultimate Showdown (8-Bit Remix).mp3',
        name: 'Ultimate Showdown (8-Bit)'
      },
      { path: '/assets/sounds/Main Menu 1 (Ruins).mp3', name: 'Ruins' }
    ],
    []
  );

  const soundEffects = useMemo(
    () => [
      { path: '/assets/sounds/gameboy-pluck.mp3', weight: 0.5 },
      { path: '/assets/sounds/wow.mp3', weight: 0.2 },
      { path: '/assets/sounds/surprise.mp3', weight: 0.1 },
      { path: '/assets/sounds/level-up.mp3', weight: 0.2 }
    ],
    []
  );

  // * Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(soundEffects[0].path);
    audioRef.current.volume = volume.effects;

    musicRef.current = new Audio(musicTracks[0].path);
    musicRef.current.volume = volume.music;
    musicRef.current.loop = false; // allow auto-advance on 'ended'

    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [soundEffects, volume.effects, musicTracks, volume.music]);

  // * Pick a random starting track on mount
  useEffect(() => {
    setCurrentTrack(Math.floor(Math.random() * musicTracks.length));
  }, [musicTracks.length]);

  // * Get random sound effect based on weights
  const getRandomSoundEffect = useCallback(() => {
    const totalWeight = soundEffects.reduce(
      (sum, effect) => sum + effect.weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const effect of soundEffects) {
      if (random < effect.weight) {
        return effect.path;
      }
      random -= effect.weight;
    }
    return soundEffects[0].path;
  }, [soundEffects]);

  // * Play sound effect
  const playSound = useCallback(() => {
    try {
      if (!isMuted && audioRef.current) {
        const soundEffect = getRandomSoundEffect();
        audioRef.current.src = soundEffect;
        audioRef.current.currentTime = 0;
        audioRef.current.volume = volume.effects;
        audioRef.current.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Error playing sound effect:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error playing sound effect:', error);
    }
  }, [isMuted, volume.effects, getRandomSoundEffect]);

  // * Handle track changes
  useEffect(() => {
    const playNewTrack = async () => {
      try {
        if (musicRef.current) {
          musicRef.current.pause();
          await new Promise((resolve) => setTimeout(resolve, 50));

          musicRef.current.src = musicTracks[currentTrack].path;
          musicRef.current.volume = volume.music;
          musicRef.current.loop = false;

          if (!isMuted) {
            await musicRef.current.play();
          }
        }
        setAudioError(null);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error playing audio:', error);
          setAudioError('Unable to play background music. Click to try again.');
        }
      }
    };

    playNewTrack();
  }, [currentTrack, isMuted, volume.music, musicTracks]);

  // * Auto-advance on track end
  useEffect(() => {
    const node = musicRef.current;
    if (!node) return;
    const onEnded = () => {
      setCurrentTrack((prev) => {
        if (isShuffle) {
          if (musicTracks.length <= 1) return prev;
          let next = Math.floor(Math.random() * musicTracks.length);
          if (next === prev) next = (prev + 1) % musicTracks.length;
          return next;
        }
        return (prev + 1) % musicTracks.length;
      });
    };
    node.addEventListener('ended', onEnded);
    return () => node.removeEventListener('ended', onEnded);
  }, [isShuffle, musicTracks.length]);

  // * Toggle mute
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      try {
        if (newMuted) {
          if (musicRef.current) musicRef.current.pause();
          if (audioRef.current) audioRef.current.pause();
        } else if (musicRef.current) {
          setTimeout(() => {
            if (musicRef.current && !newMuted) {
              musicRef.current.play().catch((error) => {
                if (error.name !== 'AbortError') {
                  setAudioError('Unable to play audio. Click to try again.');
                }
              });
            }
          }, 50);
        }
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
      return newMuted;
    });
  }, []);

  // * Next track
  const handleNextTrack = useCallback(() => {
    setCurrentTrack((prev) => (prev + 1) % musicTracks.length);
  }, [musicTracks.length]);

  // * Toggle shuffle
  const handleToggleShuffle = useCallback(() => {
    setIsShuffle((s) => !s);
  }, []);

  // * Retry audio
  const retryAudio = useCallback(() => {
    if (audioError && !isMuted && musicRef.current) {
      setTimeout(() => {
        if (musicRef.current && !isMuted) {
          musicRef.current
            .play()
            .then(() => setAudioError(null))
            .catch((error) => {
              if (error.name !== 'AbortError') {
                console.error('Error retrying audio:', error);
                setAudioError('Unable to play audio. Click to try again.');
              }
            });
        }
      }, 50);
    }
  }, [audioError, isMuted]);

  // * Handle volume change
  const handleVolumeChange = useCallback((type, value) => {
    setVolume((prev) => {
      const newVolume = { ...prev, [type]: value };
      if (audioRef.current && type === 'effects') {
        audioRef.current.volume = value;
      }
      if (musicRef.current && type === 'music') {
        musicRef.current.volume = value;
      }
      return newVolume;
    });
  }, []);

  return {
    isMuted,
    volume,
    audioError,
    currentTrack,
    isShuffle,
    trackInfo: musicTracks[currentTrack],
    playSound,
    handleToggleMute,
    handleNextTrack,
    handleToggleShuffle,
    retryAudio,
    handleVolumeChange
  };
}

// * Custom hook for tournament state management
function useTournamentState(names, existingRatings, onComplete, _onVote) {
  const [randomizedNames, setRandomizedNames] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastMatchResult, setLastMatchResult] = useState(null);
  const [showMatchResult, setShowMatchResult] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [nextRoundNumber, setNextRoundNumber] = useState(null);
  const [votingError, setVotingError] = useState(null);

  const tournamentStateRef = useRef({ isActive: false });

  // * Set up randomized names
  // Shuffle only when the identity set (ids) changes, not on shallow changes
  const namesIdentity = useMemo(
    () =>
      Array.isArray(names) ? names.map((n) => n.id || n.name).join(',') : '',
    [names]
  );
  useEffect(() => {
    if (Array.isArray(names) && names.length > 0) {
      setRandomizedNames((prev) => {
        const prevIds = Array.isArray(prev)
          ? prev.map((n) => n.id || n.name).join(',')
          : '';
        if (prevIds === namesIdentity) return prev; // no reshuffle
        return shuffleArray([...names]);
      });
    }
  }, [names, namesIdentity]);

  // * Tournament hook
  const tournament = useTournament({
    names: randomizedNames,
    existingRatings,
    onComplete
  });

  // * Reset state on error
  useEffect(() => {
    if (tournament.isError) {
      setSelectedOption(null);
      setIsTransitioning(false);
      setIsProcessing(false);
      tournamentStateRef.current.isActive = false;
    }
  }, [tournament.isError]);

  // * Track tournament state
  useEffect(() => {
    if (tournament.currentMatch) {
      tournamentStateRef.current.isActive = true;
    }
  }, [tournament.currentMatch]);

  // * Round transition effect
  useEffect(() => {
    if (tournament.roundNumber > 1) {
      setShowRoundTransition(true);
      setNextRoundNumber(tournament.roundNumber);

      const timer = setTimeout(() => {
        setShowRoundTransition(false);
        setNextRoundNumber(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [tournament.roundNumber]);

  return {
    randomizedNames,
    selectedOption,
    setSelectedOption,
    isTransitioning,
    setIsTransitioning,
    isProcessing,
    setIsProcessing,
    lastMatchResult,
    setLastMatchResult,
    showMatchResult,
    setShowMatchResult,
    showBracket,
    setShowBracket,
    showKeyboardHelp,
    setShowKeyboardHelp,
    showRoundTransition,
    nextRoundNumber,
    votingError,
    setVotingError,
    tournamentStateRef,
    tournament
  };
}

// * Custom hook for keyboard controls
function useKeyboardControls(
  selectedOption,
  isProcessing,
  isTransitioning,
  isMuted,
  handleVoteWithAnimation,
  { onToggleHelp, onUndo, canUndoNow, onClearSelection } = {}
) {
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isProcessing || isTransitioning) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          // Handle left selection
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Handle right selection
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (selectedOption) {
            handleVoteWithAnimation(selectedOption);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVoteWithAnimation('both');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVoteWithAnimation('neither');
          break;
        case 'Tab':
          break;
        case 'Escape':
          e.preventDefault();
          if (canUndoNow && typeof onUndo === 'function') {
            onUndo();
          } else if (typeof onClearSelection === 'function') {
            onClearSelection();
          }
          break;
        case '?':
          e.preventDefault();
          if (typeof onToggleHelp === 'function') onToggleHelp();
          break;
        case '/':
          if (e.shiftKey) {
            e.preventDefault();
            if (typeof onToggleHelp === 'function') onToggleHelp();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    selectedOption,
    isProcessing,
    isTransitioning,
    isMuted,
    handleVoteWithAnimation,
    onToggleHelp,
    onUndo,
    canUndoNow,
    onClearSelection
  ]);
}

// * Match result component
function MatchResult({
  showMatchResult,
  lastMatchResult,
  roundNumber,
  currentMatchNumber,
  totalMatches
}) {
  if (!showMatchResult || !lastMatchResult) return null;

  return (
    <div className={styles.matchResult} role="status" aria-live="polite">
      <div className={styles.resultContent}>
        <span className={styles.resultMessage}>{lastMatchResult}</span>
        <span className={styles.tournamentProgress}>
          Round {roundNumber} - Match {currentMatchNumber} of {totalMatches}
        </span>
      </div>
    </div>
  );
}

// * Round transition component
function RoundTransition({ showRoundTransition, nextRoundNumber }) {
  if (!showRoundTransition || !nextRoundNumber) return null;

  return (
    <div className={styles.roundTransition} role="status" aria-live="polite">
      <div className={styles.transitionContent}>
        <div className={styles.roundIcon}>🏆</div>
        <h2 className={styles.roundTitle}>Round {nextRoundNumber}</h2>
        <p className={styles.roundSubtitle}>Tournament continues...</p>
      </div>
    </div>
  );
}

// * Main tournament content component
function TournamentContent({
  onComplete,
  existingRatings = {},
  names = [],
  onVote
}) {
  const { showSuccess, showError } = useToast();

  // * Custom hooks
  const audioManager = useAudioManager();
  const tournamentState = useTournamentState(
    names,
    existingRatings,
    onComplete,
    onVote
  );

  const {
    randomizedNames,
    selectedOption,
    setSelectedOption,
    isTransitioning,
    setIsTransitioning,
    isProcessing,
    setIsProcessing,
    lastMatchResult,
    setLastMatchResult,
    showMatchResult,
    setShowMatchResult,
    showBracket,
    setShowBracket,
    showKeyboardHelp,
    setShowKeyboardHelp,
    showRoundTransition,
    nextRoundNumber,
    votingError,
    setVotingError,
    tournament
  } = tournamentState;

  const {
    currentMatch,
    handleVote,
    handleUndo,
    progress,
    roundNumber,
    currentMatchNumber,
    totalMatches,
    matchHistory = [],
    getCurrentRatings,
    isError
  } = tournament;

  // * Debug logging (development only, throttled)
  const lastRenderLogRef = useRef(0);
  if (process.env.NODE_ENV === 'development') {
    const now = Date.now();
    if (now - lastRenderLogRef.current > 500) {
      console.debug('[DEV] 🎮 Tournament: render', {
        namesCount: names?.length || 0,
        randomizedCount: randomizedNames?.length || 0,
        hasMatch: !!currentMatch
      });
      lastRenderLogRef.current = now;
    }
  }

  // * Rate limiting for voting
  const lastVoteTimeRef = useRef(0);
  const VOTE_COOLDOWN = 500;

  // * Undo window (2.5s)
  const [undoExpiresAt, setUndoExpiresAt] = useState(null);
  const undoRemainingMs = undoExpiresAt
    ? Math.max(0, undoExpiresAt - Date.now())
    : 0;
  const canUndoNow = !!undoExpiresAt && undoRemainingMs > 0;
  useEffect(() => {
    if (!undoExpiresAt) return;
    const id = setInterval(() => {
      if (Date.now() >= undoExpiresAt) {
        setUndoExpiresAt(null);
      } else {
        // trigger re-render
        setUndoExpiresAt((ts) => ts);
      }
    }, 200);
    return () => clearInterval(id);
  }, [undoExpiresAt]);

  // * Update match result
  const updateMatchResult = useCallback(
    (option) => {
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

      setLastMatchResult(resultMessage);
      setTimeout(() => setShowMatchResult(true), 500);
      setTimeout(() => setShowMatchResult(false), 2500);
      showSuccess('Vote recorded successfully!', { duration: 3000 });
      // Start undo window
      setUndoExpiresAt(Date.now() + 2500);
    },
    [currentMatch, showSuccess, setLastMatchResult, setShowMatchResult]
  );

  // * Handle vote with animation
  const handleVoteWithAnimation = useCallback(
    async (option) => {
      if (isProcessing || isTransitioning || isError) return;

      // Rate limiting check
      const now = Date.now();
      if (now - lastVoteTimeRef.current < VOTE_COOLDOWN) return;
      lastVoteTimeRef.current = now;

      try {
        setIsProcessing(true);
        setIsTransitioning(true);

        audioManager.playSound();
        updateMatchResult(option);

        const updatedRatings = await handleVote(option);

        if (onVote && currentMatch) {
          const leftName = currentMatch.left.name;
          const rightName = currentMatch.right.name;

          let leftOutcome = 'skip';
          let rightOutcome = 'skip';

          switch (option) {
            case 'left':
              leftOutcome = 'win';
              rightOutcome = 'loss';
              break;
            case 'right':
              leftOutcome = 'loss';
              rightOutcome = 'win';
              break;
            case 'both':
              leftOutcome = 'win';
              rightOutcome = 'win';
              break;
            case 'neither':
              break;
          }

          const voteData = {
            match: {
              left: {
                name: leftName,
                id: currentMatch.left.id,
                description: currentMatch.left.description || '',
                outcome: leftOutcome
              },
              right: {
                name: rightName,
                id: currentMatch.right.id,
                description: currentMatch.right.description || '',
                outcome: rightOutcome
              }
            },
            result:
              option === 'left'
                ? -1
                : option === 'right'
                  ? 1
                  : option === 'both'
                    ? 0.5
                    : 0,
            ratings: updatedRatings,
            timestamp: new Date().toISOString()
          };

          await onVote(voteData);
        }

        setSelectedOption(null);
        await new Promise((resolve) => setTimeout(resolve, 200));
        setIsProcessing(false);
        await new Promise((resolve) => setTimeout(resolve, 100));
        setIsTransitioning(false);
      } catch (error) {
        console.error('Error handling vote:', error);
        setVotingError({
          message: 'Failed to submit vote. Please try again.',
          severity: 'MEDIUM',
          isRetryable: true,
          originalError: error
        });

        showError('Failed to submit vote. Please try again.', {
          duration: 5000
        });
        setIsProcessing(false);
        setIsTransitioning(false);
      }
    },
    [
      isProcessing,
      isTransitioning,
      isError,
      audioManager,
      updateMatchResult,
      handleVote,
      onVote,
      currentMatch,
      showError,
      setIsProcessing,
      setIsTransitioning,
      setSelectedOption,
      setVotingError
    ]
  );

  // * Handle name card click
  const handleNameCardClick = useCallback(
    (option) => {
      if (isProcessing || isTransitioning) return;
      setSelectedOption(option);
      handleVoteWithAnimation(option);
    },
    [isProcessing, isTransitioning, handleVoteWithAnimation, setSelectedOption]
  );

  // * Handle end early
  const handleEndEarly = useCallback(async () => {
    try {
      setIsProcessing(true);
      const currentRatings = getCurrentRatings();
      if (currentRatings && Object.keys(currentRatings).length > 0) {
        await onComplete(currentRatings);
      }
    } catch (error) {
      console.error('Error ending tournament:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [getCurrentRatings, onComplete, setIsProcessing]);

  // * Handle vote retry
  const handleVoteRetry = useCallback(() => {
    setVotingError(null);
  }, [setVotingError]);

  // * Keyboard controls
  useKeyboardControls(
    selectedOption,
    isProcessing,
    isTransitioning,
    audioManager.isMuted,
    handleVoteWithAnimation,
    {
      onToggleHelp: () => setShowKeyboardHelp((v) => !v),
      onUndo: () => {
        if (canUndoNow) {
          handleUndo();
          setUndoExpiresAt(null);
        }
      },
      canUndoNow,
      onClearSelection: () => setSelectedOption(null)
    }
  );

  // * Transform match history for bracket
  const transformedMatches = useMemo(() => {
    const matchesPerRound = Math.ceil((names?.length || 2) / 2);
    return matchHistory.map((vote, index) => {
      // Prefer explicit win flags if available
      const leftWon = vote?.match?.left?.won === true;
      const rightWon = vote?.match?.right?.won === true;
      let winner;
      if (leftWon && rightWon) {
        winner = 0; // both advance
      } else if (leftWon && !rightWon) {
        winner = -1; // left wins
      } else if (!leftWon && rightWon) {
        winner = 1; // right wins
      } else {
        // Fallback to numeric result thresholds
        if (typeof vote.result === 'number') {
          if (vote.result < -0.1) winner = -1;
          else if (vote.result > 0.1) winner = 1;
          else if (Math.abs(vote.result) <= 0.1)
            winner = 0; // tie
          else winner = 2; // skipped/other
        } else {
          winner = 2;
        }
      }

      const matchNumber = vote?.matchNumber ?? index + 1;
      const round = Math.max(
        1,
        Math.ceil(matchNumber / Math.max(1, matchesPerRound))
      );

      return {
        id: matchNumber,
        round,
        name1: vote.match.left.name,
        name2: vote.match.right.name,
        winner
      };
    });
  }, [matchHistory, names]);

  // * Error state
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

  // * Loading state
  if (!randomizedNames.length || !currentMatch) {
    return (
      <div className={styles.tournamentContainer}>
        <LoadingSpinner />
        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          {!randomizedNames.length
            ? 'Setting up tournament...'
            : 'Preparing tournament...'}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tournament} role="main" aria-live="polite">
      {/* Progress Information */}
      <div
        className={styles.progressInfo}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={styles.roundInfo}>
          <span className={styles.roundNumber}>Round {roundNumber}</span>
          <span className={styles.matchCount}>
            Match {currentMatchNumber} of {totalMatches}
          </span>
        </div>
        <div
          className={styles.percentageInfo}
          aria-label={`Tournament is ${progress}% complete`}
        >
          {progress}% Complete
        </div>
      </div>

      {/* Tournament Controls */}
      <TournamentControls
        onEndEarly={handleEndEarly}
        isTransitioning={isTransitioning || isProcessing}
        isMuted={audioManager.isMuted}
        onToggleMute={audioManager.handleToggleMute}
        onNextTrack={audioManager.handleNextTrack}
        isShuffle={audioManager.isShuffle}
        onToggleShuffle={audioManager.handleToggleShuffle}
        currentTrack={audioManager.currentTrack}
        trackInfo={audioManager.trackInfo}
        audioError={audioManager.audioError}
        onRetryAudio={audioManager.retryAudio}
        volume={audioManager.volume}
        onVolumeChange={audioManager.handleVolumeChange}
      />

      {/* Undo banner */}
      {canUndoNow && (
        <div className={styles.undoBanner} role="status" aria-live="polite">
          <span>
            Vote recorded.
            <span className={styles.undoTimer} aria-hidden="true">
              {` ${Math.max(0, (undoRemainingMs / 1000).toFixed(1))}s`}
            </span>
          </span>
          <button
            className={styles.undoButton}
            onClick={() => {
              handleUndo();
              setUndoExpiresAt(null);
            }}
            aria-label="Undo last vote (Esc)"
          >
            Undo (Esc)
          </button>
        </div>
      )}

      {/* Main Tournament Layout */}
      <div
        className={styles.tournamentLayout}
        role="main"
        aria-label="Tournament voting interface"
      >
        {/* Matchup Section */}
        <div
          className={styles.matchup}
          role="region"
          aria-label="Current matchup"
          aria-busy={isTransitioning || isProcessing}
        >
          <div className={styles.namesRow}>
            <div
              className={`${styles.nameContainer} ${selectedOption === 'left' ? styles.selected : ''}`}
              role="group"
              aria-label="Left name option"
            >
              <NameCard
                name={currentMatch.left.name}
                description={currentMatch.left.description}
                onClick={() => handleNameCardClick('left')}
                selected={selectedOption === 'left'}
                disabled={isProcessing || isTransitioning}
                shortcutHint="Press ← arrow key"
                size="medium"
              />
            </div>

            <div className={styles.vsSection} aria-hidden="true">
              <span className={styles.vsText}>vs</span>
            </div>

            <div
              className={`${styles.nameContainer} ${selectedOption === 'right' ? styles.selected : ''}`}
              role="group"
              aria-label="Right name option"
            >
              <NameCard
                name={currentMatch.right.name}
                description={currentMatch.right.description}
                onClick={() => handleNameCardClick('right')}
                selected={selectedOption === 'right'}
                disabled={isProcessing || isTransitioning}
                shortcutHint="Press → arrow key"
                size="medium"
              />
            </div>
          </div>

          {/* Extra Voting Options */}
          <div
            className={styles.extraOptions}
            role="group"
            aria-label="Additional voting options"
          >
            <button
              className={`${styles.extraOptionsButton} ${selectedOption === 'both' ? styles.selected : ''}`}
              onClick={() => handleVoteWithAnimation('both')}
              disabled={isProcessing || isTransitioning}
              aria-pressed={selectedOption === 'both'}
              aria-label="Vote for both names (Press Up arrow key)"
              type="button"
            >
              I Like Both!{' '}
              <span className={styles.shortcutHint} aria-hidden="true">
                (↑ Up)
              </span>
            </button>

            <button
              className={`${styles.extraOptionsButton} ${selectedOption === 'neither' ? styles.selected : ''}`}
              onClick={() => handleVoteWithAnimation('neither')}
              disabled={isProcessing || isTransitioning}
              aria-pressed={selectedOption === 'neither'}
              aria-label="Skip this match (Press Down arrow key)"
              type="button"
            >
              Skip{' '}
              <span className={styles.shortcutHint} aria-hidden="true">
                (↓ Down)
              </span>
            </button>
          </div>

          {/* Voting Error Display */}
          {votingError && (
            <InlineError
              error={votingError}
              context="vote"
              position="below"
              onRetry={handleVoteRetry}
              onDismiss={() => setVotingError(null)}
              showRetry={true}
              showDismiss={true}
              size="medium"
              className={styles.votingError}
            />
          )}
        </div>

        {/* Tournament Controls */}
        <div className={styles.tournamentControls}>
          <button
            className={styles.bracketToggle}
            onClick={() => setShowBracket(!showBracket)}
            aria-expanded={showBracket}
            aria-controls="bracketView"
          >
            {showBracket
              ? 'Hide Tournament History'
              : 'Show Tournament History'}
            <span className={styles.bracketToggleIcon}>
              {showBracket ? '▼' : '▶'}
            </span>
          </button>

          <button
            className={styles.keyboardHelpToggle}
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
            aria-expanded={showKeyboardHelp}
            aria-controls="keyboardHelp"
            type="button"
          >
            <span className={styles.keyboardIcon}>⌨️</span>
            Keyboard Shortcuts
            <span className={styles.keyboardHelpIcon}>
              {showKeyboardHelp ? '▼' : '▶'}
            </span>
          </button>
        </div>

        {/* Keyboard Help */}
        {showKeyboardHelp && (
          <div
            id="keyboardHelp"
            className={styles.keyboardHelp}
            role="complementary"
            aria-label="Keyboard shortcuts help"
          >
            <h3>Keyboard Shortcuts</h3>
            <ul>
              <li>
                <kbd>←</kbd> Select left name
              </li>
              <li>
                <kbd>→</kbd> Select right name
              </li>
              <li>
                <kbd>↑</kbd> Vote for both names
              </li>
              <li>
                <kbd>↓</kbd> Skip this match
              </li>
              <li>
                <kbd>Space</kbd> or <kbd>Enter</kbd> Vote for selected name
              </li>
              <li>
                <kbd>Escape</kbd> Clear selection
              </li>
              <li>
                <kbd>Tab</kbd> Navigate between elements
              </li>
            </ul>
          </div>
        )}

        {/* Bracket View */}
        {showBracket && (
          <div
            id="bracketView"
            className={styles.bracketView}
            role="complementary"
            aria-label="Tournament bracket history"
          >
            <Bracket matches={transformedMatches} />
          </div>
        )}
      </div>

      {/* Match Result and Round Transition */}
      <MatchResult
        showMatchResult={showMatchResult}
        lastMatchResult={lastMatchResult}
        roundNumber={roundNumber}
        currentMatchNumber={currentMatchNumber}
        totalMatches={totalMatches}
      />
      <RoundTransition
        showRoundTransition={showRoundTransition}
        nextRoundNumber={nextRoundNumber}
      />
    </div>
  );
}

// * Main Tournament component with error boundary
function Tournament(props) {
  return (
    <ErrorBoundary>
      <TournamentContent {...props} />
    </ErrorBoundary>
  );
}

Tournament.displayName = 'Tournament';

Tournament.propTypes = {
  names: PropTypes.array,
  existingRatings: PropTypes.object,
  onComplete: PropTypes.func,
  userName: PropTypes.string,
  onVote: PropTypes.func
};

export default Tournament;
