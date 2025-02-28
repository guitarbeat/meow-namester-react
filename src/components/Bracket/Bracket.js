/**
 * @module Bracket
 * @description A React component that displays a tournament bracket visualization.
 * Shows the progression of matches in a merge sort tournament structure.
 * Supports different match outcomes including wins, ties, and skipped matches.
 * 
 * @example
 * <Bracket
 *   matches={[
 *     { id: 1, name1: "Whiskers", name2: "Mittens", winner: -1 },
 *     { id: 2, name1: "Luna", name2: "Shadow", winner: 1 }
 *   ]}
 * />
 * 
 * @param {Object} props
 * @param {Array} props.matches - Array of match objects containing match details
 * @param {number} props.matches[].id - Unique identifier for the match
 * @param {string} props.matches[].name1 - First name in the match
 * @param {string} props.matches[].name2 - Second name in the match
 * @param {number} props.matches[].winner - Winner indicator (-1: first, 1: second, 0: both, 2: skip)
 */

import React, { useMemo } from 'react';
import styles from './Bracket.module.css';

const MatchResult = {
  PENDING: 'pending',
  FIRST_WIN: 'first',
  SECOND_WIN: 'second',
  BOTH_ADVANCE: 'both',
  SKIPPED: 'skip',
  NEITHER: 'neither'
};

function Match({ match, isLastRound }) {
  const status = useMemo(() => {
    if (!match.winner && match.winner !== 0) return MatchResult.PENDING;
    if (match.winner === -1) return MatchResult.FIRST_WIN;
    if (match.winner === 1) return MatchResult.SECOND_WIN;
    if (match.winner === 0) return MatchResult.BOTH_ADVANCE;
    if (match.winner === 2) return MatchResult.NEITHER;
    return MatchResult.SKIPPED;
  }, [match.winner]);

  const getPlayerClass = (isFirst) => {
    if (!match.winner && match.winner !== 0) return styles.player;
    switch (status) {
      case MatchResult.FIRST_WIN:
        return isFirst ? styles.playerWinner : styles.playerLoser;
      case MatchResult.SECOND_WIN:
        return isFirst ? styles.playerLoser : styles.playerWinner;
      case MatchResult.BOTH_ADVANCE:
        return styles.playerBothWin;
      case MatchResult.NEITHER:
        return styles.playerNeither;
      default:
        return styles.player;
    }
  };

  const getResultBadge = (isFirst) => {
    switch (status) {
      case MatchResult.FIRST_WIN:
        return isFirst && <span className={styles.winnerBadge} title="Winner">Winner</span>;
      case MatchResult.SECOND_WIN:
        return !isFirst && <span className={styles.winnerBadge} title="Winner">Winner</span>;
      case MatchResult.BOTH_ADVANCE:
        return <span className={styles.tieBadge} title="Both Liked">Both Advance</span>;
      case MatchResult.NEITHER:
        return <span className={styles.skipBadge} title="Skipped">Skipped</span>;
      default:
        return null;
    }
  };

  const getPlayerStats = (player) => {
    if (!player) return null;
    return (
      <span className={styles.playerStats}>
        {player.wins || 0}W - {player.losses || 0}L
      </span>
    );
  };

  return (
    <div className={styles.match}>
      <div className={styles.matchContent}>
        <div className={getPlayerClass(true)}>
          <div className={styles.playerInfo}>
            <span className={styles.playerName}>{match.name1}</span>
            {getPlayerStats(match.player1)}
          </div>
          {getResultBadge(true)}
        </div>
        <div className={styles.vsDivider}>vs</div>
        {match.name2 ? (
          <div className={getPlayerClass(false)}>
            <div className={styles.playerInfo}>
              <span className={styles.playerName}>{match.name2}</span>
              {getPlayerStats(match.player2)}
            </div>
            {getResultBadge(false)}
          </div>
        ) : (
          <div className={styles.playerBye}>
            <span className={styles.byeText}>Bye</span>
          </div>
        )}
      </div>
      {!isLastRound && <div className={styles.matchConnector} />}
    </div>
  );
}

function Round({ matches, roundNumber, isLastRound }) {
  return (
    <div className={styles.round}>
      <div className={styles.roundHeader}>
        <span className={styles.roundTitle}>Round {roundNumber}</span>
        <span className={styles.roundMatches}>
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
      </div>
      <div className={styles.matches}>
        {matches.map((match) => (
          <Match 
            key={match.id} 
            match={match} 
            isLastRound={isLastRound}
          />
        ))}
      </div>
    </div>
  );
}

function Bracket({ matches }) {
  const tree = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    
    const totalRounds = Math.ceil(Math.log2(matches.length + 1));
    const rounds = Array(totalRounds).fill().map(() => []);
    
    matches.forEach(match => {
      const roundIndex = Math.floor(Math.log2(match.id));
      if (roundIndex >= 0 && roundIndex < totalRounds) {
        rounds[roundIndex].push(match);
      }
    });

    // Sort matches within each round
    rounds.forEach(round => round.sort((a, b) => a.id - b.id));
    
    return rounds;
  }, [matches]);

  if (!matches || matches.length === 0) {
    return (
      <div className={styles.emptyState}>
        No matches to display yet
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.bracket}>
        {tree.map((roundMatches, index) => (
          <Round
            key={index}
            matches={roundMatches}
            roundNumber={index + 1}
            isLastRound={index === tree.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(Bracket); 