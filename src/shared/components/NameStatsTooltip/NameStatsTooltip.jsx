/**
 * @module NameStatsTooltip
 * @description Interactive tooltip component showing detailed statistics for a cat name
 */
import React from 'react';
import PropTypes from 'prop-types';
import styles from './NameStatsTooltip.module.css';

function NameStatsTooltip({ nameData, isVisible, position }) {
  if (!nameData || !isVisible) return null;

  const {
    name,
    description,
    rating,
    wins,
    losses,
    totalMatches,
    winRate,
    rank,
    categories
  } = nameData;

  return (
    <div
      className={styles.tooltip}
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipHeader}>
          <h3 className={styles.nameTitle}>{name}</h3>
          <span className={styles.rankBadge}>#{rank}</span>
        </div>

        {description && <p className={styles.description}>{description}</p>}

        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Rating</span>
            <span className={styles.statValue}>{rating}</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>Win Rate</span>
            <span className={styles.statValue}>{winRate}%</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>Wins</span>
            <span className={styles.statValue}>{wins}</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>Losses</span>
            <span className={styles.statValue}>{losses}</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Matches</span>
            <span className={styles.statValue}>{totalMatches}</span>
          </div>
        </div>

        {categories && categories.length > 0 && (
          <div className={styles.categories}>
            <span className={styles.categoriesLabel}>Categories:</span>
            <div className={styles.categoryTags}>
              {categories.map((category, index) => (
                <span key={index} className={styles.categoryTag}>
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

NameStatsTooltip.displayName = 'NameStatsTooltip';

NameStatsTooltip.propTypes = {
  nameData: PropTypes.shape({
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    rating: PropTypes.number.isRequired,
    wins: PropTypes.number.isRequired,
    losses: PropTypes.number.isRequired,
    totalMatches: PropTypes.number.isRequired,
    winRate: PropTypes.number.isRequired,
    rank: PropTypes.number.isRequired,
    categories: PropTypes.arrayOf(PropTypes.string)
  }),
  isVisible: PropTypes.bool.isRequired,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired
};

export default NameStatsTooltip;
