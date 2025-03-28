import React, { useState, useEffect, useRef } from 'react';
import styles from './Login.module.css';
import BongoCat from '../BongoCat/BongoCat';

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [catFact, setCatFact] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [offsetY, setOffsetY] = useState(-160);
  
  const containerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Update offset based on screen size
  useEffect(() => {
    const updateOffset = () => {
      // Use a smaller (less negative) offset on mobile to position the cat less behind
      if (window.innerWidth <= 768) {
        setOffsetY(-90); // Much less negative offset for mobile - brings cat more forward
      } else {
        setOffsetY(-160); // Original offset for desktop
      }
    };
    
    // Set initial offset
    updateOffset();
    
    // Update offset on resize
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  const funnyPrefixes = [
    'Captain', 'Dr.', 'Professor', 'Lord', 'Lady', 'Sir', 'Duchess', 'Count',
    'Princess', 'Chief', 'Master', 'Agent', 'Detective', 'Admiral'
  ];

  const funnyAdjectives = [
    'Whiskers', 'Purrington', 'Meowington', 'Pawsome', 'Fluffles', 'Scratchy',
    'Naptastic', 'Furball', 'Cattastic', 'Pawdorable', 'Whiskertron', 'Purrfect'
  ];

  const generateFunName = () => {
    const prefix = funnyPrefixes[Math.floor(Math.random() * funnyPrefixes.length)];
    const adjective = funnyAdjectives[Math.floor(Math.random() * funnyAdjectives.length)];
    const randomNumber = Math.floor(Math.random() * 99) + 1;
    
    const generatedName = `${prefix} ${adjective}${randomNumber}`;
    setName(generatedName);
    
    // Trigger typing state for BongoCat
    setIsTyping(true);
    resetTypingTimer();
    
    if (error) setError('');
  };

  const resetTypingTimer = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  useEffect(() => {
    // Fetch a random cat fact for fun
    fetch('https://catfact.ninja/fact')
      .then(res => res.json())
      .then(data => setCatFact(data.fact))
      .catch(() => setCatFact('Cats make purr-fect companions!'));
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleNameChange = (e) => {
    setName(e.target.value);
    
    // Set typing state for BongoCat
    setIsTyping(true);
    resetTypingTimer();
    
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      await onLogin(trimmedName);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginWrapper}>
      {/* BongoCat component with responsive offsetY */}
      <BongoCat 
        containerRef={containerRef}
        color="#000"
        offsetY={offsetY}
        onBongo={() => console.log('Cat bongoed!')}
      />
      
      <div className={styles.backgroundContainer}>
        <div className={styles.overlay} />
        <img 
          src="/images/IMG_5044.JPEG" 
          alt="" 
          className={styles.backgroundImage}
          loading="eager"
        />
      </div>

      <div className={styles.loginContainer} ref={containerRef}>
        <section className={styles.imageSection}>
          <h1 className={styles.welcomeTitle}>Welcome</h1>
          <img 
            src="/images/IMG_5071.JPG" 
            alt="Cute cat avatar" 
            className={styles.catImage}
            loading="eager"
          />
          <p className={styles.welcomeText}>
            Sign in or create an account to join our cat-naming community!
          </p>
        </section>

        <div className={styles.loginContent}>
          <div>
            <h2 className={styles.loginTitle}>Sign In</h2>
            <p className={styles.catFact}>{catFact || 'Loading a fun cat fact...'}</p>
            {isTyping ? (
              <p className={styles.helperText}>The cat is watching you type!</p>
            ) : null}
          </div>
          
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.inputWrapper}>
              <label htmlFor="loginName" className={styles.inputLabel}>Your Account Name:</label>
              <input
                id="loginName"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter name to sign in or create account"
                className={`${styles.loginInput} ${error ? styles.error : ''}`}
                autoFocus
                disabled={isLoading}
                aria-label="Your account name"
                maxLength={30}
              />
              {error && <p className={styles.errorMessage} role="alert">{error}</p>}
            </div>

            <button
              type="button"
              onClick={generateFunName}
              className={styles.generateButton}
              disabled={isLoading}
            >
              <span className={styles.buttonContent}>
                Generate Random Username
                <span className={styles.buttonEmoji} aria-hidden="true">😺</span>
              </span>
            </button>
            
            <button 
              type="submit" 
              className={`${styles.startButton} ${isLoading ? styles.loading : ''}`}
              disabled={!name.trim() || isLoading}
            >
              <span className={styles.buttonContent}>
                {isLoading ? (
                  <>
                    <span className={styles.spinner} />
                    Loading...
                  </>
                ) : (
                  <>
                    Continue
                    <span className={styles.buttonEmoji} aria-hidden="true">→</span>
                  </>
                )}
              </span>
            </button>
          </form>

          <p className={styles.helperText}>
            After signing in, you'll be able to vote in cat name tournaments and see results.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login; 