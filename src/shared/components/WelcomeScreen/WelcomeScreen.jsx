/**
 * @module WelcomeScreen
 * @description Enhanced welcome screen that displays the cat's name based on tournament rankings.
 * Features improved animations, particle effects, and interactive elements.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NameStatsTooltip } from '../index';
import styles from './WelcomeScreen.module.css';

function WelcomeScreen({
  onContinue,
  catName,
  nameStats = [],
  isTransitioning = false
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [hoveredName, setHoveredName] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const containerRef = useRef(null);
  const nameRefs = useRef({});
  const animationFrameRef = useRef(null);

  // Particle system for enhanced visual appeal
  const createParticle = useCallback(() => {
    // Reduce particle count on mobile for better performance
    const isMobile = window.innerWidth <= 768;

    return {
      id: Math.random(),
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * (isMobile ? 0.3 : 0.5),
      vy: (Math.random() - 0.5) * (isMobile ? 0.3 : 0.5),
      size: Math.random() * (isMobile ? 2 : 3) + 1,
      opacity: Math.random() * (isMobile ? 0.3 : 0.5) + 0.2,
      life: 1,
      decay: Math.random() * 0.02 + 0.01
    };
  }, []);

  const animateParticles = useCallback(() => {
    setParticles((prevParticles) =>
      prevParticles
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          life: particle.life - particle.decay,
          opacity: particle.opacity * particle.life
        }))
        .filter((particle) => particle.life > 0)
        .concat(
          Array.from({ length: Math.random() < 0.1 ? 1 : 0 }, createParticle)
        )
    );
  }, [createParticle]);

  // Add welcome-page class to body and html when component mounts
  useEffect(() => {
    document.body.classList.add('welcome-page');
    document.documentElement.classList.add('welcome-page');

    // Initialize particles with mobile optimization
    const isMobile = window.innerWidth <= 768;
    const particleCount = isMobile ? 10 : 20;
    const initialParticles = Array.from(
      { length: particleCount },
      createParticle
    );
    setParticles(initialParticles);

    // Animate in after a brief delay
    const timer = setTimeout(() => {
      setIsVisible(true);
      setShowCelebration(true);
    }, 100);

    // Start particle animation with mobile optimization
    const animate = () => {
      // Reduce animation frequency on mobile
      const isMobile = window.innerWidth <= 768;
      if (!isMobile || Math.random() < 0.7) {
        animateParticles();
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    // Remove class when component unmounts
    return () => {
      document.body.classList.remove('welcome-page');
      document.documentElement.classList.remove('welcome-page');
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clean up name refs to prevent memory leaks
      nameRefs.current = {};
    };
  }, [createParticle, animateParticles]);

  const handleContinue = () => {
    setIsAnimating(true);
    setShowProgress(true);

    // Enhanced haptic feedback for mobile
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }

    // Play sound effect if available
    try {
      const audio = new Audio('/assets/sounds/button-click.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Silently fail if audio can't play
      });
    } catch {
      // Silently fail if audio file doesn't exist
    }

    // Add a small delay for the animation before continuing
    setTimeout(() => {
      onContinue();
    }, 800);
  };

  // Handle mobile-specific button interactions
  const handleButtonTouchStart = (event) => {
    event.target.style.transform = 'scale(0.98)';
  };

  const handleButtonTouchEnd = (event) => {
    event.target.style.transform = 'scale(1)';
  };

  const handleButtonTouchCancel = (event) => {
    event.target.style.transform = 'scale(1)';
  };

  // Handle mouse events for interactive names
  const handleNameMouseEnter = (nameData, event) => {
    const rect = event.target.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredName(nameData);

    // Add subtle haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  const handleNameMouseLeave = () => {
    setHoveredName(null);
  };

  // Handle touch events for mobile
  const handleNameTouchStart = (nameData, event) => {
    event.preventDefault();
    setTooltipPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    setHoveredName(nameData);

    // Add haptic feedback for touch
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }

    // Add visual feedback
    event.target.style.transform = 'scale(0.95)';
  };

  const handleNameTouchEnd = (event) => {
    event.preventDefault();
    // Reset visual feedback
    event.target.style.transform = 'scale(1)';

    // Delay hiding to allow user to see the tooltip
    setTimeout(() => {
      setHoveredName(null);
    }, 3000);
  };

  const handleNameTouchCancel = (event) => {
    event.preventDefault();
    // Reset visual feedback
    event.target.style.transform = 'scale(1)';
    setHoveredName(null);
  };

  // Create individual name components from the cat name
  const createInteractiveNames = () => {
    if (!catName || catName === 'Loading...' || nameStats.length === 0) {
      return (
        <span
          className={styles.catNameText}
          role="text"
          aria-label="Loading cat name"
        >
          {catName || 'Loading...'}
        </span>
      );
    }

    // Handle error state
    if (catName === 'Mystery Cat' || !nameStats || nameStats.length === 0) {
      return (
        <span
          className={styles.catNameText}
          role="text"
          aria-label="Cat name: Mystery Cat"
        >
          {catName}
        </span>
      );
    }

    // Find all matches in the original name without modifying it
    const matchedNames = [];
    const sortedStats = [...nameStats].sort((a, b) => b.rating - a.rating);

    // Find all occurrences of each name in the cat name
    for (const stat of sortedStats) {
      let searchIndex = 0;
      while (searchIndex < catName.length) {
        const index = catName.indexOf(stat.name, searchIndex);
        if (index === -1) break;

        matchedNames.push({
          ...stat,
          startIndex: index,
          endIndex: index + stat.name.length
        });
        searchIndex = index + 1; // Move past this match to find overlapping ones
      }
    }

    // Remove overlapping matches (keep the one with higher rating)
    const filteredMatches = [];
    for (const match of matchedNames) {
      const hasOverlap = filteredMatches.some(
        (existing) =>
          match.startIndex < existing.endIndex &&
          match.endIndex > existing.startIndex
      );
      if (!hasOverlap) {
        filteredMatches.push(match);
      }
    }

    // Sort by position in the original name
    filteredMatches.sort((a, b) => a.startIndex - b.startIndex);

    const nameComponents = [];
    let lastIndex = 0;

    filteredMatches.forEach((nameData, index) => {
      // Add any text before this name
      if (nameData.startIndex > lastIndex) {
        const beforeText = catName.substring(lastIndex, nameData.startIndex);
        nameComponents.push(
          <span key={`text-${index}`} className={styles.catNameText}>
            {beforeText}
          </span>
        );
      }

      // Add the interactive name
      nameComponents.push(
        <span
          key={`name-${index}`}
          ref={(el) => {
            if (el) nameRefs.current[nameData.name] = el;
          }}
          className={`${styles.catNameText} ${styles.interactiveName}`}
          onMouseEnter={(e) => handleNameMouseEnter(nameData, e)}
          onMouseLeave={handleNameMouseLeave}
          onTouchStart={(e) => handleNameTouchStart(nameData, e)}
          onTouchEnd={handleNameTouchEnd}
          onTouchCancel={handleNameTouchCancel}
          title={`Tap to see stats for ${nameData.name}`}
          aria-label={`Interactive name: ${nameData.name}. Rating: ${nameData.rating}, Win rate: ${nameData.winRate}%. Tap to view detailed statistics.`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNameMouseEnter(nameData, e);
            }
          }}
        >
          {nameData.name}
        </span>
      );

      lastIndex = nameData.endIndex;
    });

    // Add any remaining text
    if (lastIndex < catName.length) {
      const remainingText = catName.substring(lastIndex);
      nameComponents.push(
        <span key="text-end" className={styles.catNameText}>
          {remainingText}
        </span>
      );
    }

    return nameComponents.length > 0 ? (
      nameComponents
    ) : (
      <span className={styles.catNameText}>{catName}</span>
    );
  };

  return (
    <div
      className={`${styles.welcomeWrapper} ${isVisible ? styles.visible : ''} ${isAnimating ? styles.animating : ''} ${isTransitioning ? styles.transitioning : ''}`}
      role="main"
      aria-label="Welcome screen showing your cat's tournament-generated name"
    >
      {/* Background with overlay */}
      <div className={styles.backgroundContainer}>
        <div className={styles.backgroundImage} />
        <div className={styles.overlay} />

        {/* Particle effects */}
        <div className={styles.particleContainer}>
          {particles.map((particle) => (
            <div
              key={particle.id}
              className={styles.particle}
              style={{
                left: particle.x,
                top: particle.y,
                width: particle.size,
                height: particle.size,
                opacity: particle.opacity,
                transform: `rotate(${particle.x * 0.1}deg)`
              }}
            />
          ))}
        </div>

        {/* Celebration effects */}
        {showCelebration && (
          <div className={styles.celebrationContainer}>
            <div className={styles.confetti} />
            <div className={styles.confetti} />
            <div className={styles.confetti} />
            <div className={styles.confetti} />
            <div className={styles.confetti} />
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {showProgress && (
        <div
          className={styles.progressContainer}
          role="status"
          aria-live="polite"
          aria-label="Loading tournament"
        >
          <div className={styles.progressBar} aria-hidden="true">
            <div className={styles.progressFill} />
          </div>
          <p className={styles.progressText}>
            Preparing your tournament experience...
          </p>
        </div>
      )}

      {/* Centered Content Container */}
      <div className={styles.contentContainer} ref={containerRef}>
        {/* Main Content Section */}
        <div className={styles.mainContent}>
          <div className={styles.catImageContainer}>
            <picture>
              <source type="image/avif" srcSet="/assets/images/IMG_5071.avif" />
              <source type="image/webp" srcSet="/assets/images/IMG_5071.webp" />
              <img
                src="/assets/images/IMG_5071.JPG"
                alt="Cute cat avatar"
                className={`${styles.catImage} ${showCelebration ? styles.catImageCelebration : ''}`}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
            </picture>
            <div className={styles.catImageGlow} />
          </div>

          <div className={styles.catNameSection}>
            <h2
              className={`${styles.catNameTitle} ${showCelebration ? styles.catNameTitleCelebration : ''}`}
            >
              <span className={styles.titleText}>My cat&apos;s name is:</span>
              <span className={styles.titleSparkle}>✨</span>
            </h2>
            <div
              className={`${styles.catNameDisplay} ${showCelebration ? styles.catNameDisplayCelebration : ''}`}
            >
              {createInteractiveNames()}
            </div>
            <p
              className={`${styles.catNameSubtext} ${showCelebration ? styles.catNameSubtextCelebration : ''}`}
            >
              A name carefully crafted from all the tournament results, ranked
              from most to least voted!
            </p>
          </div>
        </div>

        {/* Action Section */}
        <div
          className={`${styles.actionSection} ${showCelebration ? styles.actionSectionCelebration : ''}`}
        >
          <button
            onClick={handleContinue}
            onTouchStart={handleButtonTouchStart}
            onTouchEnd={handleButtonTouchEnd}
            onTouchCancel={handleButtonTouchCancel}
            className={`${styles.continueButton} ${showCelebration ? styles.continueButtonCelebration : ''}`}
            disabled={isAnimating}
            aria-label={
              isAnimating
                ? 'Entering tournament, please wait'
                : 'Start the tournament'
            }
            aria-describedby="button-description"
          >
            <span className={styles.buttonContent}>
              <span className={styles.buttonText}>
                {isAnimating
                  ? 'Entering Tournament...'
                  : 'Start the Tournament!'}
              </span>
              <span
                className={`${styles.buttonEmoji} ${showCelebration ? styles.buttonEmojiCelebration : ''}`}
                aria-hidden="true"
              >
                🏆
              </span>
            </span>
            <div className={styles.buttonGlow} />
          </button>

          <div className={styles.explanationText} id="button-description">
            <p>
              This name represents the collective wisdom of all tournament
              participants!
            </p>
          </div>
        </div>
      </div>

      {/* Interactive tooltip */}
      <NameStatsTooltip
        nameData={hoveredName}
        isVisible={!!hoveredName}
        position={tooltipPosition}
      />
    </div>
  );
}

WelcomeScreen.displayName = 'WelcomeScreen';

WelcomeScreen.propTypes = {
  onContinue: PropTypes.func.isRequired,
  catName: PropTypes.string.isRequired,
  nameStats: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      description: PropTypes.string,
      rating: PropTypes.number.isRequired,
      wins: PropTypes.number.isRequired,
      losses: PropTypes.number.isRequired,
      totalMatches: PropTypes.number.isRequired,
      winRate: PropTypes.number.isRequired,
      rank: PropTypes.number.isRequired,
      categories: PropTypes.arrayOf(PropTypes.string)
    })
  ),
  isTransitioning: PropTypes.bool
};

export default WelcomeScreen;
