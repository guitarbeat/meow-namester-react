/**
 * @module WelcomeScreen
 * @description Simple welcome screen that displays the cat's name with interactive editing.
 * Features large, readable fonts and full-screen layout.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
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
  const [displayName, setDisplayName] = useState(catName || 'Gabi');
  const [ownerName, setOwnerName] = useState('Your Name'); // Replace with your actual name
  const nameRef = useRef(null);

  // Update display name when catName prop changes
  useEffect(() => {
    if (catName && catName !== 'Loading...') {
      setDisplayName(catName);
    }
  }, [catName]);

  // Add welcome-page class to body and html when component mounts
  useEffect(() => {
    document.body.classList.add('welcome-page');
    document.documentElement.classList.add('welcome-page');

    // Animate in after a brief delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    // Remove class when component unmounts
    return () => {
      document.body.classList.remove('welcome-page');
      document.documentElement.classList.remove('welcome-page');
      clearTimeout(timer);
    };
  }, []);

  const handleContinue = () => {
    setIsAnimating(true);
    setShowProgress(true);

    // Add a small delay for the animation before continuing
    setTimeout(() => {
      onContinue();
    }, 800);
  };

  // No interactive editing needed - this is a personal site

  return (
    <div
      className={`${styles.welcomeWrapper} ${isVisible ? styles.visible : ''} ${isAnimating ? styles.animating : ''} ${isTransitioning ? styles.transitioning : ''}`}
      role="main"
      aria-label="Welcome screen showing your cat's name"
    >
      {/* Background with overlay */}
      <div className={styles.backgroundContainer}>
        <div className={styles.backgroundImage} />
        <div className={styles.overlay} />
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

      {/* Main Content */}
      <div className={styles.contentContainer}>
        <div className={styles.mainContent}>
          <h1 className={styles.title}>
            Hello! I'm {ownerName} and my cat's name is
            <span className={styles.nameSpan}>
              <p 
                ref={nameRef}
                id="name"
                className={styles.name}
              >
                {displayName}
              </p>
            </span>
          </h1>
          
          <button
            onClick={handleContinue}
            className={styles.continueButton}
            disabled={isAnimating}
            aria-label={
              isAnimating
                ? 'Entering tournament, please wait'
                : 'Enter the cat name tournament'
            }
          >
            {isAnimating ? 'Entering Tournament...' : 'Enter the Tournament!'}
          </button>
        </div>
      </div>
    </div>
  );
}

WelcomeScreen.displayName = 'WelcomeScreen';

WelcomeScreen.propTypes = {
  onContinue: PropTypes.func.isRequired,
  catName: PropTypes.string.isRequired,
  nameStats: PropTypes.array,
  isTransitioning: PropTypes.bool
};

export default WelcomeScreen;
