import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import styles from './Sidebar.module.css';

const Sidebar = ({ currentPath, isOpen, onToggle }) => {
  const { userName, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      onToggle();
    }
  }, [isOpen, onToggle]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle backdrop and animation states with improved timing
  useEffect(() => {
    if (isOpen) {
      // Show backdrop immediately when opening
      setShowBackdrop(true);
      setIsAnimating(true);
      
      // Allow time for animation to complete
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 400); // Slightly longer than CSS transition
      
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(true);
      
      // Delay hiding backdrop until close animation completes
      const timer = setTimeout(() => {
        setShowBackdrop(false);
        setIsAnimating(false);
      }, 400);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when sidebar is open
  useEffect(() => {
    const body = document.body;
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - body.clientWidth;
      body.style.overflow = 'hidden';
      body.style.paddingRight = `${scrollbarWidth}px`; // Prevent layout shift
    } else {
      body.style.overflow = '';
      body.style.paddingRight = '';
    }
    return () => {
      body.style.overflow = '';
      body.style.paddingRight = '';
    };
  }, [isOpen]);

  const handleNavigation = (path) => {
    navigate(path);
    onToggle();
  };

  return (
    <>
      <button 
        className={styles.menuButton} 
        onClick={onToggle}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        <div className={`${styles.hamburger} ${isOpen ? styles.open : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      
      {/* Backdrop with improved animation support */}
      {showBackdrop && (
        <div 
          className={`${styles.backdrop} ${isOpen ? styles.open : ''} ${isAnimating ? styles.animating : ''}`}
          onClick={onToggle}
          aria-hidden="true"
          role="presentation"
        />
      )}
      
      <aside 
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
        role="complementary"
        aria-label="Navigation menu"
      >
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>
            {isLoggedIn ? `Hi, ${userName}! 👋` : 'Welcome! 👋'}
          </h2>
        </div>
        
        <nav className={styles.sidebarNav}>
          <button 
            className={currentPath === '/tournament' ? styles.active : styles.navButton}
            onClick={() => handleNavigation('/tournament')}
            aria-current={currentPath === '/tournament' ? 'page' : undefined}
          >
            <span className={styles.buttonIcon} aria-hidden="true">🏆</span>
            <span className={styles.buttonText}>Tournament</span>
          </button>
          
          {isLoggedIn && (
            <>
              <button 
                className={currentPath === '/profile' ? styles.active : styles.navButton}
                onClick={() => handleNavigation('/profile')}
                aria-current={currentPath === '/profile' ? 'page' : undefined}
              >
                <span className={styles.buttonIcon} aria-hidden="true">👤</span>
                <span className={styles.buttonText}>My Profile</span>
              </button>
            </>
          )}
        </nav>

        {isLoggedIn && (
          <div className={styles.sidebarFooter}>
            <button 
              className={styles.logoutButton}
              onClick={() => {
                logout();
                onToggle();
                navigate('/login');
              }}
            >
              <span className={styles.buttonIcon} aria-hidden="true">👋</span>
              <span className={styles.buttonText}>Logout</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar; 