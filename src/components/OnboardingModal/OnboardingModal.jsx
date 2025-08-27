import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './OnboardingModal.module.css';

/**
 * Floating bubbles onboarding - ONLY bubbles, no traditional modal
 * Each bubble is a complete step that appears sequentially
 * Features: Drag & Drop, Easy Close, Smart Positioning
 */
const OnboardingModal = ({ isOpen, onClose, onDontShowAgain, isLightTheme = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [bubblePositions, setBubblePositions] = useState([]);
  const [expandedBubble, setExpandedBubble] = useState(null);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [draggedBubble, setDraggedBubble] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setExpandedBubble(null);
      setDraggedBubble(null);

      // Initialize first bubble position
      const firstBubble = {
        x: 50, // Center of screen
        y: 50,
        delay: 0,
        speed: 0.1 + Math.random() * 0.2,
        directionX: Math.random() > 0.5 ? 1 : -1,
        directionY: Math.random() > 0.5 ? 1 : -1
      };
      setBubblePositions([firstBubble]);
    }
  }, [isOpen]);

  // Animate bubbles with proper boundary checking (only when not dragging)
  useEffect(() => {
    if (!isOpen || draggedBubble !== null) return;

    const interval = setInterval(() => {
      setBubblePositions(prev => prev.map((bubble, index) => {
        // Only animate if bubble is visible (step is active)
        if (index > currentStep) return bubble;

        // Calculate new positions with slower movement
        let newX = bubble.x + (bubble.speed * 0.02) * bubble.directionX;
        let newY = bubble.y + (bubble.speed * 0.015) * bubble.directionY;

        // Bounce off edges with proper boundary checking
        if (newX <= 20 || newX >= 80) {
          newX = bubble.x;
          bubble.directionX = -bubble.directionX;
        }
        if (newY <= 20 || newY >= 80) {
          newY = bubble.y;
          bubble.directionY = -bubble.directionY;
        }

        // Ensure bubbles stay within safe bounds
        newX = Math.max(20, Math.min(80, newX));
        newY = Math.max(20, Math.min(80, newY));

        return {
          ...bubble,
          x: newX,
          y: newY,
          directionX: bubble.directionX,
          directionY: bubble.directionY
        };
      }));
    }, 150);

    return () => clearInterval(interval);
  }, [isOpen, currentStep, draggedBubble]);

  const steps = [
    {
      icon: '🚀',
      title: 'Welcome to Aaron&apos;s Folly!',
      content: 'Get ready for a wild ride through the most indecisive naming adventure you\'ve ever seen. Buckle up!',
      features: [
        { icon: '🎯', title: 'Smart Suggestions', description: 'AI-powered name recommendations' },
        { icon: '🎨', title: 'Creative Themes', description: 'Endless customization options' }
      ]
    },
    {
      icon: '🎭',
      title: 'Why So Many Names?',
      content: 'Because why settle for one when you can have a hundred? Our AI generates unique, creative names that actually make sense.',
      features: [
        { icon: '🧠', title: 'AI Magic', description: 'Advanced algorithms at work' },
        { icon: '✨', title: 'Unique Results', description: 'No two names are alike' }
      ]
    },
    {
      icon: '🎪',
      title: 'Ready to Name Everything?',
      content: 'From pets to projects, from businesses to babies - if it needs a name, we\'ve got you covered. Let\'s make some magic!',
      features: [
        { icon: '🎯', title: 'Instant Results', description: 'Get names in seconds' },
        { icon: '💾', title: 'Save Favorites', description: 'Keep track of your best picks' }
      ]
    }
  ];

  const handleBubbleClick = (index) => {
    if (index === currentStep && !draggedBubble) {
      setExpandedBubble(index);
    }
  };

  const handleBubbleClose = () => {
    setExpandedBubble(null);

    // Mark current step as completed
    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.add(currentStep);
    setCompletedSteps(newCompletedSteps);

    // Move to next step or complete onboarding
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);

      // Add new bubble for next step
      const newBubble = {
        x: Math.random() * 60 + 20,
        y: Math.random() * 60 + 20,
        delay: 0,
        speed: 0.1 + Math.random() * 0.2,
        directionX: Math.random() > 0.5 ? 1 : -1,
        directionY: Math.random() > 0.5 ? 1 : -1
      };
      setBubblePositions(prev => [...prev, newBubble]);
    } else {
      // All steps completed
      onClose();
    }
  };

  const handleDontShowAgain = () => {
    onDontShowAgain();
    onClose();
  };

  // Drag and Drop Handlers
  const handleMouseDown = (e, index) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggedBubble(index);
    setDragOffset({ x: offsetX, y: offsetY });

    // Add global mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (draggedBubble === null) return;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate new position based on mouse position and offset
    let newX = ((e.clientX - dragOffset.x) / viewportWidth) * 100;
    let newY = ((e.clientY - dragOffset.y) / viewportHeight) * 100;
    
    // Keep bubbles within safe bounds (5% to 95% of viewport)
    newX = Math.max(5, Math.min(95, newX));
    newY = Math.max(5, Math.min(95, newY));
    
    setBubblePositions(prev => prev.map((bubble, index) => 
      index === draggedBubble 
        ? { ...bubble, x: newX, y: newY }
        : bubble
    ));
  };

  const handleMouseUp = () => {
    setDraggedBubble(null);
    setDragOffset({ x: 0, y: 0 });
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e, index) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    
    setDraggedBubble(index);
    setDragOffset({ x: offsetX, y: offsetY });
    
    // Add global touch event listeners
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e) => {
    if (draggedBubble === null) return;
    e.preventDefault(); // Prevent scrolling while dragging
    
    const touch = e.touches[0];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newX = ((touch.clientX - dragOffset.x) / viewportWidth) * 100;
    let newY = ((touch.clientY - dragOffset.y) / viewportHeight) * 100;
    
    newX = Math.max(5, Math.min(95, newX));
    newY = Math.max(5, Math.min(95, newY));
    
    setBubblePositions(prev => prev.map((bubble, index) => 
      index === draggedBubble 
        ? { ...bubble, x: newX, y: newY }
        : bubble
    ));
  };

  const handleTouchEnd = () => {
    setDraggedBubble(null);
    setDragOffset({ x: 0, y: 0 });
    
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  if (!isOpen) return null;

  return (
    <div className={`${styles.overlay} ${isLightTheme ? styles.lightTheme : styles.darkTheme}`}>
      {/* Only show bubbles for completed and current steps */}
      {bubblePositions.slice(0, currentStep + 1).map((bubble, index) => {
        const step = steps[index];
        const isCompleted = completedSteps.has(index);
        const isCurrent = index === currentStep;
        const isExpanded = expandedBubble === index;
        const isDragging = draggedBubble === index;

        return (
          <div
            key={index}
            className={`${styles.floatingBubble} ${styles.contentBubble} ${
              isExpanded ? styles.expandedBubble : ''
            } ${isCurrent ? styles.activeBubble : ''} ${
              isCompleted ? styles.completedBubble : ''
            } ${isDragging ? styles.draggingBubble : ''}`}
            style={{
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${5 + (bubble.speed || 0.1) * 20}s`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onClick={() => handleBubbleClick(index)}
            onMouseDown={(e) => handleMouseDown(e, index)}
            onTouchStart={(e) => handleTouchStart(e, index)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBubbleClick(index);
              }
            }}
            aria-label={`Step ${index + 1}: ${step.title} - Click to expand, drag to move`}
          >
            {/* Drag Handle */}
            <div className={styles.dragHandle}>
              <span className={styles.dragIcon}>⋮⋮</span>
            </div>

            <div className={styles.bubbleContent}>
              <div className={styles.bubbleIcon}>{step.icon}</div>
              <h3 className={styles.bubbleTitle}>{step.title}</h3>
              
              {isExpanded && (
                <>
                  <p className={styles.bubbleText}>{step.content}</p>
                  <div className={styles.bubbleFeatures}>
                    {step.features.map((feature, idx) => (
                      <div key={idx} className={styles.bubbleFeature}>
                        <span className={styles.bubbleFeatureIcon}>{feature.icon}</span>
                        <span className={styles.bubbleFeatureText}>{feature.title}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Action buttons */}
                  <div className={styles.bubbleActions}>
                    {currentStep < steps.length - 1 ? (
                      <button
                        className={styles.bubbleNextButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBubbleClose();
                        }}
                        aria-label="Continue to next step"
                      >
                        Continue →
                      </button>
                    ) : (
                      <button
                        className={styles.bubbleFinishButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBubbleClose();
                        }}
                        aria-label="Finish onboarding"
                      >
                        Get Started! 🎉
                      </button>
                    )}
                    
                    <button
                      className={styles.bubbleDontShowButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDontShowAgain();
                      }}
                      aria-label="Don't show onboarding again"
                    >
                      Don&apos;t show again
                    </button>
                  </div>

                  {/* Close Button */}
                  <button
                    className={styles.bubbleCloseButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedBubble(null);
                    }}
                    aria-label="Close this bubble"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

OnboardingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onDontShowAgain: PropTypes.func.isRequired,
  isLightTheme: PropTypes.bool
};

export default OnboardingModal;
