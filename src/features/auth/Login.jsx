/**
 * @module Login
 * @description User login component with fun cat-themed interactions.
 */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import { InlineError } from '../../shared/components';
import useToast from '../../core/hooks/useToast';
import { validateUsername } from '../../shared/utils/validation';
import styles from './Login.module.css';

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [catFact, setCatFact] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { showSuccess, showError } = useToast();

  const containerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Add login-page class to body and html when component mounts
  useEffect(() => {
    document.body.classList.add('login-page');
    document.documentElement.classList.add('login-page');

    // Remove class when component unmounts
    return () => {
      document.body.classList.remove('login-page');
      document.documentElement.classList.remove('login-page');
    };
  }, []);

  const funnyPrefixes = [
    'Captain',
    'Dr.',
    'Professor',
    'Lord',
    'Lady',
    'Sir',
    'Duchess',
    'Count',
    'Princess',
    'Chief',
    'Master',
    'Agent',
    'Detective',
    'Admiral'
  ];

  const funnyAdjectives = [
    'Whiskers',
    'Purrington',
    'Meowington',
    'Pawsome',
    'Fluffles',
    'Scratchy',
    'Naptastic',
    'Furball',
    'Cattastic',
    'Pawdorable',
    'Whiskertron',
    'Purrfect'
  ];

  const generateFunName = () => {
    const prefix =
      funnyPrefixes[Math.floor(Math.random() * funnyPrefixes.length)];
    const adjective =
      funnyAdjectives[Math.floor(Math.random() * funnyAdjectives.length)];
    return `${prefix} ${adjective}`;
  };

  const exampleRandomName = generateFunName();

  const resetTypingTimer = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
  };

  // Fetch cat fact on component mount
  useEffect(() => {
    fetch('https://catfact.ninja/fact')
      .then((response) => response.json())
      .then((data) => setCatFact(data.fact))
      .catch((error) => {
        console.error('Error fetching cat fact:', error);
        setCatFact('Cats are amazing creatures with unique personalities!');
      });

    const currentTimeout = typingTimeoutRef.current;
    return () => {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
    };
  }, []);

  const handleNameChange = (e) => {
    setName(e.target.value);
    setIsTyping(true);
    resetTypingTimer();
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalName = name.trim() || generateFunName();

    // Validate the username
    const validation = validateUsername(finalName);
    if (!validation.success) {
      setError(validation.error);
      showError(validation.error);
      return;
    }

    try {
      setIsLoading(true);
      await onLogin(validation.value);
      showSuccess(`Welcome, ${validation.value}! 🎉`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      showError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginWrapper}>
      {/* Background with overlay */}
      <div className={styles.backgroundContainer}>
        <picture>
          <source type="image/avif" srcSet="/assets/images/IMG_5071.avif" />
          <source type="image/webp" srcSet="/assets/images/IMG_5071.webp" />
          <img
            src="/assets/images/IMG_5071.JPG"
            alt="Cat background"
            className={styles.backgroundImage}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </picture>
        <div className={styles.overlay} />
      </div>

      {/* Centered Hero Container */}
      <div className={styles.heroContainer} ref={containerRef}>
        {/* Hero Content Section */}
        <div className={styles.heroContent}>
          <div className={styles.stepIndicator}>
            <span className={styles.stepNumber}>2</span>
            <span className={styles.stepText}>Create Your Judge Profile</span>
          </div>
          <h1 className={styles.welcomeTitle}>Ready to Judge the Names?</h1>
          <picture>
            <source type="image/avif" srcSet="/assets/images/IMG_5071.avif" />
            <source type="image/webp" srcSet="/assets/images/IMG_5071.webp" />
            <img
              src="/assets/images/IMG_5071.JPG"
              alt="Cute cat avatar"
              className={styles.catImage}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          </picture>
          <p className={styles.welcomeText}>
            Now it&apos;s your turn! Enter your name to start judging cat names
            and help find the perfect one.
          </p>
        </div>

        {/* Form Section */}
        <div className={styles.formSection}>
          <h2 className={styles.loginTitle}>Cat Name Olympics</h2>
          <p className={styles.catFact}>
            {catFact ? (
              <>{catFact}</>
            ) : (
              <span className={styles.loadingFact}>
                <span className={styles.loadingDots}>
                  Loading a fun cat fact
                </span>
                <span className={styles.loadingDots}>...</span>
              </span>
            )}
          </p>
          {isTyping ? (
            <div className={styles.typingIndicator}>
              <span className={styles.typingText}>
                The cat is watching you type!
              </span>
              <span className={styles.typingDots}>
                <span className={styles.dot}>.</span>
                <span className={styles.dot}>.</span>
                <span className={styles.dot}>.</span>
              </span>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className={styles.loginForm}
            role="form"
            aria-label="Login form"
          >
            <div className={styles.inputWrapper}>
              <label htmlFor="loginName" className={styles.inputLabel}>
                Your Judge Name:
              </label>
              <div className={styles.inputContainer}>
                <input
                  id="loginName"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="Enter your name (or leave empty for random)"
                  className={`${styles.loginInput} ${error ? styles.error : ''}`}
                  autoFocus
                  disabled={isLoading}
                  aria-label="Your name"
                  aria-describedby={error ? 'loginError' : 'loginHelp'}
                  aria-required="false"
                  maxLength={30}
                />
                {!name.trim() && (
                  <div
                    className={styles.randomNameIndicator}
                    title="A random name will be generated"
                    aria-hidden="true"
                  >
                    <span className={styles.diceIcon}>🎲</span>
                  </div>
                )}
              </div>
              {error && (
                <InlineError
                  error={error}
                  context="form"
                  position="below"
                  onDismiss={() => setError('')}
                  showRetry={false}
                  showDismiss={true}
                  size="medium"
                  className={styles.loginError}
                />
              )}
              <p id="loginHelp" className={styles.explainerText}>
                Type your name to save your ratings, or leave it blank for a
                surprise name!
              </p>
              {name.trim() && (
                <div className={styles.characterCounter}>
                  <span className={styles.counterText}>
                    {name.length}/30 characters
                  </span>
                  <div className={styles.counterBar}>
                    <div
                      className={styles.counterProgress}
                      style={{ width: `${(name.length / 30) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className={`${styles.singleButton} ${isLoading ? styles.loading : ''} ${name.trim() ? styles.hasName : ''}`}
              disabled={isLoading}
            >
              <span className={styles.buttonContent}>
                {isLoading ? (
                  <>
                    <span className={styles.spinner} />
                    Loading...
                  </>
                ) : (
                  <>
                    {name.trim() ? 'Start Judging!' : 'Get Random Name & Start'}
                    <span className={styles.buttonEmoji} aria-hidden="true">
                      🏆
                    </span>
                  </>
                )}
              </span>
            </button>
          </form>

          <div className={styles.namePreview}>
            {name ? (
              <p className={styles.helperText}>
                You&apos;ll be known as{' '}
                <span className={styles.nameHighlight}>&quot;{name}&quot;</span>
              </p>
            ) : (
              <div className={styles.randomPreview}>
                <p className={`${styles.helperText} ${styles.randomNameText}`}>
                  We&apos;ll generate a fun name automatically!
                </p>
                <p className={styles.randomNameExample}>
                  <span className={styles.exampleLabel}>Example: </span>
                  <span className={styles.exampleValue}>
                    {exampleRandomName}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

Login.displayName = 'Login';

Login.propTypes = {
  onLogin: PropTypes.func.isRequired
};

export default Login;
