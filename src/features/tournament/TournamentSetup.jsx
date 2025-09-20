/**
 * @module TournamentSetup
 * @description Simple wizard for selecting cat names and starting a tournament.
 * Shows names and descriptions by default. Admin users get advanced filtering options.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  supabase,
  getNamesWithDescriptions,
  tournamentsAPI,
  catNamesAPI,
  imagesAPI
} from '../../../backend/api/supabaseClient';
import { compressImageFile } from '../../shared/utils/imageUtils';
import devLog from '../../shared/utils/logger';
import {
  LoadingSpinner,
  NameCard,
  ErrorBoundary,
  ErrorDisplay,
  InlineError
} from '../../shared/components';
import useErrorHandler from '../../core/hooks/useErrorHandler';
import useToast from '../../core/hooks/useToast';
import {
  validateCatName,
  validateDescription
} from '../../shared/utils/validation';
import styles from './TournamentSetup.module.css';

// Use absolute paths for better image loading compatibility
const CAT_IMAGES = [
  '/assets/images/IMG_4844.jpg',
  '/assets/images/IMG_4845.jpg',
  '/assets/images/IMG_4846.jpg',
  '/assets/images/IMG_4847.jpg',
  '/assets/images/IMG_5044.JPEG',
  '/assets/images/IMG_5071.JPG',
  '/assets/images/IMG_0778.jpg',
  '/assets/images/IMG_0779.jpg',
  '/assets/images/IMG_0865.jpg',
  '/assets/images/IMG_0884.jpg',
  '/assets/images/IMG_0923.jpg',
  '/assets/images/IMG_1116.jpg',
  '/assets/images/IMG_7205.jpg',
  '/assets/images/75209580524__60DCC26F-55A1-4EF8-A0B2-14E80A026A8D.jpg'
];

const DEFAULT_DESCRIPTION = 'A name as unique as your future companion';

const FALLBACK_NAMES = [
  {
    id: 'aaron',
    name: 'aaron',
    description: 'temporary fallback — backend offline'
  },
  {
    id: 'fix',
    name: 'fix',
    description: 'temporary fallback — backend offline'
  },
  {
    id: 'the',
    name: 'the',
    description: 'temporary fallback — backend offline'
  },
  {
    id: 'site',
    name: 'site',
    description: 'temporary fallback — backend offline'
  }
];

// Helper function to get random cat images
const getRandomCatImage = (nameId, imageList = CAT_IMAGES) => {
  // Convert UUID string to a number for consistent image selection
  let numericId;
  if (typeof nameId === 'string') {
    // Use a simple hash of the UUID string to get a consistent number
    numericId = nameId.split('').reduce((hash, char) => {
      return char.charCodeAt(0) + ((hash << 5) - hash);
    }, 0);
  } else {
    numericId = nameId;
  }

  // Use the numeric ID to consistently get the same image for the same name
  const list =
    Array.isArray(imageList) && imageList.length ? imageList : CAT_IMAGES;
  const index = Math.abs(numericId) % list.length;
  return list[index];
};

// Simple name selection - names and descriptions only
const NameSelection = ({
  selectedNames,
  availableNames,
  onToggleName,
  isAdmin,
  // Admin-only props
  categories,
  selectedCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  isSwipeMode,
  showCatPictures,
  imageList
}) => {
  // For non-admin users, just show all names
  const displayNames = isAdmin
    ? (() => {
        // Filter names by category if selected
        const filteredNames = selectedCategory
          ? availableNames.filter(
              (name) =>
                name.categories && name.categories.includes(selectedCategory)
            )
          : availableNames;

        // Filter by search term
        const searchFilteredNames = searchTerm
          ? filteredNames.filter(
              (name) =>
                name.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (name.description &&
                  name.description
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()))
            )
          : filteredNames;

        // Sort names
        return [...searchFilteredNames].sort((a, b) => {
          switch (sortBy) {
            case 'rating':
              return (b.avg_rating || 1500) - (a.avg_rating || 1500);
            case 'popularity':
              return (b.popularity_score || 0) - (a.popularity_score || 0);
            case 'alphabetical':
              return a.name.localeCompare(b.name);
            default:
              return 0;
          }
        });
      })()
    : availableNames; // Non-admin users see all names

  return (
    <div className={styles.nameSelection}>
      {/* Swipe Mode Instructions */}
      {isSwipeMode && (
        <div className={styles.swipeModeInstructions}>
          <span>
            👈 Swipe left to remove • 👉 Swipe right to select for tournament
          </span>
        </div>
      )}

      {/* Admin-only filtering and sorting controls */}
      {isAdmin && (
        <div className={styles.controlsSection}>
          {/* Category filter */}
          {categories && categories.length > 0 && (
            <div className={styles.filterGroup}>
              <label htmlFor="category-filter">Category:</label>
              <select
                id="category-filter"
                value={selectedCategory || ''}
                onChange={(e) => onCategoryChange(e.target.value || null)}
                className={styles.filterSelect}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name} (
                    {
                      availableNames.filter(
                        (name) =>
                          name.categories &&
                          name.categories.includes(category.name)
                      ).length
                    }
                    )
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search filter */}
          <div className={styles.filterGroup}>
            <label htmlFor="search-filter">Search:</label>
            <input
              type="text"
              id="search-filter"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search names or descriptions..."
              className={styles.searchInput}
            />
          </div>

          {/* Sort options */}
          <div className={styles.filterGroup}>
            <label htmlFor="sort-filter">Sort by:</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="alphabetical">Alphabetical</option>
              <option value="rating">Rating (High to Low)</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>
      )}

      {/* Admin-only results count */}
      {isAdmin && (
        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            Showing {displayNames.length} of {availableNames.length} names
            {selectedCategory && ` in "${selectedCategory}" category`}
            {searchTerm && ` matching "${searchTerm}"`}
          </span>
        </div>
      )}

      <div className={styles.cardsContainer}>
        {isSwipeMode ? (
          <SwipeableNameCards
            names={displayNames}
            selectedNames={selectedNames}
            onToggleName={onToggleName}
            isAdmin={isAdmin}
            showCatPictures={showCatPictures}
            imageList={imageList}
          />
        ) : (
          displayNames.map((nameObj) => (
            <NameCard
              key={nameObj.id}
              name={nameObj.name}
              description={nameObj.description || DEFAULT_DESCRIPTION}
              isSelected={selectedNames.some((n) => n.id === nameObj.id)}
              onClick={() => onToggleName(nameObj)}
              size="small"
              // Cat picture when enabled
              image={
                showCatPictures
                  ? getRandomCatImage(nameObj.id, imageList)
                  : undefined
              }
              // Admin-only metadata display
              metadata={
                isAdmin
                  ? {
                      rating: nameObj.avg_rating,
                      popularity: nameObj.popularity_score,
                      tournaments: nameObj.total_tournaments,
                      categories: nameObj.categories
                    }
                  : undefined
              }
            />
          ))
        )}
      </div>

      {isAdmin && displayNames.length === 0 && (
        <div className={styles.noResults}>
          <p>😿 No names found matching your criteria</p>
          <p>Try adjusting your filters or search terms</p>
        </div>
      )}
    </div>
  );
};

// Swipeable Name Cards Component
const SwipeableNameCards = ({
  names,
  selectedNames,
  onToggleName,
  isAdmin,
  showCatPictures = false,
  imageList = CAT_IMAGES
}) => {
  const imgRef = React.useRef(null);
  const imgContainerRef = React.useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [swipeProgress, setSwipeProgress] = useState(0);

  const currentName = names[currentIndex];
  const isSelected = selectedNames.some((n) => n.id === currentName?.id);
  const imageSrc =
    showCatPictures && currentName
      ? getRandomCatImage(currentName.id, imageList)
      : null;

  const handleDragStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
    setSwipeDirection(null);
    setSwipeProgress(0);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;

    const touch = e.touches ? e.touches[0] : e;
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;

    setDragOffset({ x: deltaX, y: deltaY });

    // Calculate swipe progress (0-1)
    const progress = Math.min(Math.abs(deltaX) / 150, 1);
    setSwipeProgress(progress);

    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);

    // If swiped far enough, process the swipe
    if (swipeProgress > 0.5) {
      if (swipeDirection === 'right') {
        // Swipe right = select/like (add to tournament)
        if (!isSelected) {
          onToggleName(currentName);
        }
      } else if (swipeDirection === 'left') {
        // Swipe left = pass (remove from tournament if selected)
        if (isSelected) {
          onToggleName(currentName);
        }
      }

      // Move to next card
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % names.length);
        setDragOffset({ x: 0, y: 0 });
        setSwipeDirection(null);
        setSwipeProgress(0);
      }, 300);
    } else {
      // Reset card position
      setDragOffset({ x: 0, y: 0 });
      setSwipeDirection(null);
      setSwipeProgress(0);
    }
  };

  const handleSwipeButton = (direction) => {
    setSwipeDirection(direction);
    setSwipeProgress(1);

    setTimeout(() => {
      if (direction === 'right') {
        // Right button = select/like (add to tournament)
        if (!isSelected) {
          onToggleName(currentName);
        }
      } else if (direction === 'left') {
        // Left button = pass (remove from tournament if selected)
        if (isSelected) {
          onToggleName(currentName);
        }
      }

      setCurrentIndex((prev) => (prev + 1) % names.length);
      setDragOffset({ x: 0, y: 0 });
      setSwipeDirection(null);
      setSwipeProgress(0);
    }, 300);
  };

  // Lightweight vertical edge-density focal detector (same approach as NameCard)
  const computeFocalY = React.useCallback((imgEl) => {
    try {
      const naturalW = imgEl.naturalWidth || imgEl.width;
      const naturalH = imgEl.naturalHeight || imgEl.height;
      if (!naturalW || !naturalH) return null;
      const targetW = 128;
      const scale = targetW / naturalW;
      const w = Math.max(16, Math.min(targetW, naturalW));
      const h = Math.max(16, Math.floor(naturalH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(imgEl, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const rowEnergy = new Array(h).fill(0);
      const toGray = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;
      const idx = (x, y) => (y * w + x) * 4;
      for (let y = 1; y < h - 1; y++) {
        let sum = 0;
        for (let x = 0; x < w; x++) {
          const i1 = idx(x, y - 1);
          const i2 = idx(x, y + 1);
          sum += Math.abs(
            toGray(data[i2], data[i2 + 1], data[i2 + 2]) -
              toGray(data[i1], data[i1 + 1], data[i1 + 2])
          );
        }
        rowEnergy[y] = sum / w;
      }
      const start = Math.floor(h * 0.08);
      const end = Math.floor(h * 0.7);
      let bestY = start;
      let bestVal = -Infinity;
      for (let y = start; y < end; y++) {
        const e =
          (rowEnergy[y - 1] || 0) + rowEnergy[y] + (rowEnergy[y + 1] || 0);
        if (e > bestVal) {
          bestVal = e;
          bestY = y;
        }
      }
      const pct = Math.min(60, Math.max(10, Math.round((bestY / h) * 100)));
      return pct;
    } catch {
      return null;
    }
  }, []);

  const handleImageLoad = React.useCallback(() => {
    const imgEl = imgRef.current;
    const container = imgContainerRef.current;
    if (!imgEl || !container) return;
    const focal = computeFocalY(imgEl);
    if (focal != null) {
      container.style.setProperty('--image-pos-y', `${focal}%`);
    }
  }, [computeFocalY]);

  if (!currentName) return null;

  const cardStyle = {
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.1}deg)`,
    opacity: isDragging ? 0.9 : 1
  };

  const swipeOverlayStyle = {
    opacity: swipeProgress,
    transform: `scale(${0.8 + swipeProgress * 0.2})`
  };

  return (
    <div className={styles.swipeContainer}>
      <div
        className={`${styles.swipeCardWrapper} ${showCatPictures ? styles.withCatPictures : ''}`}
      >
        <div
          className={`${styles.swipeCard} ${isSelected ? styles.selected : ''} ${showCatPictures ? styles.withCatPictures : ''}`}
          style={cardStyle}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {/* Swipe direction overlays - Fixed to show correct overlay */}
          <div
            className={`${styles.swipeOverlay} ${styles.swipeRight} ${swipeDirection === 'right' ? styles.active : ''}`}
            style={
              swipeDirection === 'right' ? swipeOverlayStyle : { opacity: 0 }
            }
          >
            <span className={styles.swipeText}>👍 SELECTED</span>
          </div>
          <div
            className={`${styles.swipeOverlay} ${styles.swipeLeft} ${swipeDirection === 'left' ? styles.active : ''}`}
            style={
              swipeDirection === 'left' ? swipeOverlayStyle : { opacity: 0 }
            }
          >
            <span className={styles.swipeText}>👎 SKIPPED</span>
          </div>

          {/* Card content */}
          <div className={styles.swipeCardContent}>
            {/* Cat picture when enabled */}
            {showCatPictures && imageSrc && (
              <div
                className={styles.swipeCardImageContainer}
                ref={imgContainerRef}
                style={{ ['--bg-image']: `url(${imageSrc})` }}
              >
                {(() => {
                  const src = imageSrc;
                  if (String(src).startsWith('/assets/images/')) {
                    const base = src.includes('.')
                      ? src.replace(/\.[^.]+$/, '')
                      : src;
                    return (
                      <picture>
                        <source type="image/avif" srcSet={`${base}.avif`} />
                        <source type="image/webp" srcSet={`${base}.webp`} />
                        <img
                          ref={imgRef}
                          src={src}
                          alt="Random cat picture"
                          className={styles.swipeCardImage}
                          loading="eager"
                          decoding="async"
                          onLoad={handleImageLoad}
                          onError={(e) => {
                            console.error(
                              'Image failed to load:',
                              e.target.src
                            );
                          }}
                        />
                      </picture>
                    );
                  }
                  return (
                    <img
                      ref={imgRef}
                      src={src}
                      alt="Random cat picture"
                      className={styles.swipeCardImage}
                      loading="eager"
                      decoding="async"
                      onLoad={handleImageLoad}
                      onError={(e) => {
                        console.error('Image failed to load:', e.target.src);
                      }}
                    />
                  );
                })()}
              </div>
            )}

            <h3 className={styles.swipeCardName}>{currentName.name}</h3>
            <p className={styles.swipeCardDescription}>
              {currentName.description || DEFAULT_DESCRIPTION}
            </p>

            {/* Admin metadata */}
            {isAdmin && (
              <div className={styles.swipeCardMetadata}>
                {currentName.avg_rating && (
                  <span className={styles.metadataItem}>
                    ⭐ {currentName.avg_rating}
                  </span>
                )}
                {currentName.popularity_score && (
                  <span className={styles.metadataItem}>
                    🔥 {currentName.popularity_score}
                  </span>
                )}
                {currentName.categories &&
                  currentName.categories.length > 0 && (
                    <span className={styles.metadataItem}>
                      🏷️ {currentName.categories.join(', ')}
                    </span>
                  )}
              </div>
            )}
          </div>

          {/* Selection indicator - Only show when selected */}
          {isSelected && (
            <div className={`${styles.selectionIndicator} ${styles.selected}`}>
              ✓ Selected
            </div>
          )}
        </div>
      </div>

      {/* Swipe buttons */}
      <div className={styles.swipeButtons}>
        <button
          onClick={() => handleSwipeButton('left')}
          className={`${styles.swipeButton} ${styles.swipeLeftButton}`}
          // Remove disabled state - always allow skipping
        >
          👎 Skip
        </button>

        <div className={styles.cardProgress}>
          {currentIndex + 1} of {names.length}
        </div>

        <button
          onClick={() => handleSwipeButton('right')}
          className={`${styles.swipeButton} ${styles.swipeRightButton}`}
          // Remove disabled state - always allow selecting
        >
          👍 Select
        </button>
      </div>
    </div>
  );
};

const StartButton = ({ selectedNames, onStart, variant = 'default' }) => {
  const validateNames = (names) => {
    return names.every((nameObj) => {
      if (!nameObj || typeof nameObj !== 'object' || !nameObj.id) {
        return false;
      }

      // Validate the name using our validation utility
      const nameValidation = validateCatName(nameObj.name);
      if (!nameValidation.success) {
        console.warn(
          'Invalid name detected:',
          nameObj.name,
          nameValidation.error
        );
        return false;
      }

      return true;
    });
  };

  const handleStart = () => {
    console.log(
      '[DEV] 🎮 StartButton: handleStart called with selectedNames:',
      selectedNames
    );

    if (!validateNames(selectedNames)) {
      console.error('Invalid name objects detected:', selectedNames);
      return;
    }

    console.log(
      '[DEV] 🎮 StartButton: Calling onStart with validated names:',
      selectedNames
    );
    onStart(selectedNames);
  };

  const buttonText =
    selectedNames.length < 2
      ? `Need ${2 - selectedNames.length} More Name${selectedNames.length === 0 ? 's' : ''} 🎯`
      : 'Start Tournament! 🏆';

  const buttonClass =
    variant === 'header' ? styles.startButtonHeader : styles.startButton;

  return (
    <button
      onClick={handleStart}
      className={buttonClass}
      disabled={selectedNames.length < 2}
      aria-label={
        selectedNames.length < 2
          ? 'Select at least 2 names to start'
          : 'Start Tournament'
      }
    >
      {buttonText}
    </button>
  );
};

const NameSuggestionSection = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const nameValidation = validateCatName(name.trim());
    if (!nameValidation.success) {
      setError(nameValidation.error);
      return;
    }

    const descriptionValidation = validateDescription(description.trim());
    if (!descriptionValidation.success) {
      setError(descriptionValidation.error);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await catNamesAPI.addName(
        nameValidation.value,
        descriptionValidation.value
      );
      if (res?.success === false) {
        throw new Error(res.error || 'Failed to add name');
      }
      setSuccess('Thank you for your suggestion!');
      showSuccess('Name suggestion submitted successfully!', {
        duration: 4000
      });
      setName('');
      setDescription('');
    } catch {
      setError('Failed to add name. It might already exist.');
      showError('Failed to submit name suggestion. Please try again.', {
        duration: 5000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.suggestionSection}>
      <div className={styles.suggestionCard}>
        <h2>Suggest a Cat Name</h2>
        <p className={styles.suggestionIntro}>
          Have a great cat name in mind? Share it with the community!
        </p>

        <form
          onSubmit={handleSubmit}
          className={styles.suggestionForm}
          role="form"
          aria-label="Name suggestion form"
        >
          <div className={styles.formGroup}>
            <label htmlFor="suggestion-name">Name</label>
            <input
              type="text"
              id="suggestion-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a cat name"
              maxLength={50}
              disabled={isSubmitting}
              aria-required="true"
              aria-describedby="name-help"
            />
            <div id="name-help" className={styles.helpText}>
              Enter a unique cat name (maximum 50 characters)
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="suggestion-description">Description</label>
            <textarea
              id="suggestion-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about this name's meaning or origin"
              maxLength={500}
              disabled={isSubmitting}
              aria-required="false"
              aria-describedby="description-help"
            />
            <div id="description-help" className={styles.helpText}>
              Optional: Describe the name&apos;s meaning or origin (maximum 500
              characters)
            </div>
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
          {success && <p className={styles.successMessage}>{success}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
            aria-label={
              isSubmitting
                ? 'Submitting name suggestion...'
                : 'Submit name suggestion'
            }
          >
            {isSubmitting ? 'Submitting...' : 'Submit Name'}
          </button>
        </form>
      </div>
    </div>
  );
};

function useTournamentSetup(userName) {
  const [availableNames, setAvailableNames] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef(null);
  const lastSavedHashRef = useRef('');

  // Enhanced error handling
  const onErrorCb = useCallback((error) => {
    console.error('TournamentSetup error:', error);
  }, []);

  const { errors, isError, handleError, clearErrors, clearError } =
    useErrorHandler({
      showUserFeedback: true,
      maxRetries: 2,
      onError: onErrorCb
    });

  useEffect(() => {
    const fetchNames = async () => {
      try {
        setIsLoading(true);
        if (!supabase) {
          setAvailableNames(FALLBACK_NAMES);
          setIsLoading(false);
          return;
        }

        // Get all names and hidden names in parallel for efficiency
        const [namesData, { data: hiddenData, error: hiddenError }] =
          await Promise.all([
            getNamesWithDescriptions(),
            supabase
              .from('cat_name_ratings')
              .select('name_id')
              .eq('is_hidden', true)
          ]);

        if (hiddenError) {
          throw hiddenError;
        }

        // Create Set of hidden IDs for O(1) lookup
        const hiddenIds = new Set(
          hiddenData?.map((item) => item.name_id) || []
        );

        // Filter out hidden names
        const filteredNames = namesData.filter(
          (name) => !hiddenIds.has(name.id)
        );

        // Sort names alphabetically for better UX

        const sortedNames = filteredNames.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        devLog('🎮 TournamentSetup: Data loaded', {
          availableNames: sortedNames.length,
          hiddenNames: hiddenIds.size,
          userPreferences: hiddenData?.length || 0
        });

        setAvailableNames(sortedNames);

        // If any currently selected names are now hidden, remove them
        setSelectedNames((prev) =>
          prev.filter((name) => !hiddenIds.has(name.id))
        );
      } catch (err) {
        // Provide a clear offline fallback list when backend fails
        setAvailableNames(FALLBACK_NAMES);
        handleError(err, 'TournamentSetup - Fetch Names', {
          isRetryable: true,
          affectsUserData: false,
          isCritical: false
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNames();
  }, [handleError, userName]);

  // Save tournament selections to database
  const saveTournamentSelections = useCallback(
    async (selectedNames) => {
      try {
        // Create a unique tournament ID for this selection session
        const tournamentId = `selection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save selections to database
        if (!supabase) return;

        const result = await tournamentsAPI.saveTournamentSelections(
          userName,
          selectedNames,
          tournamentId
        );

        devLog('🎮 TournamentSetup: Selections saved to database', result);
      } catch (error) {
        console.error('Error saving tournament selections:', error);
        // Don't block the UI if saving fails
      }
    },
    [userName]
  );

  const scheduleSave = useCallback(
    (namesToSave) => {
      if (!userName || !Array.isArray(namesToSave) || namesToSave.length === 0)
        return;

      const hash = namesToSave
        .map((n) => n.id || n.name)
        .sort()
        .join(',');

      if (hash === lastSavedHashRef.current) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        lastSavedHashRef.current = hash;
        saveTournamentSelections(namesToSave).catch((e) =>
          console.warn('Save selections debounce error:', e)
        );
      }, 800);
    },
    [userName, saveTournamentSelections]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const toggleName = async (nameObj) => {
    setSelectedNames((prev) => {
      const newSelectedNames = prev.some((n) => n.id === nameObj.id)
        ? prev.filter((n) => n.id !== nameObj.id)
        : [...prev, nameObj];

      // Log the updated selected names (throttled to avoid spam)
      if (!toggleName.lastLogTs || Date.now() - toggleName.lastLogTs > 1000) {
        devLog('🎮 TournamentSetup: Selected names updated', newSelectedNames);
        toggleName.lastLogTs = Date.now();
      }

      // Debounce save of selections to database
      scheduleSave(newSelectedNames);

      return newSelectedNames;
    });
  };

  const handleSelectAll = () => {
    setSelectedNames(
      selectedNames.length === availableNames.length ? [] : [...availableNames]
    );
  };

  return {
    availableNames,
    selectedNames,
    isLoading,
    errors,
    isError,
    clearErrors,
    clearError,
    toggleName,
    handleSelectAll
  };
}

function TournamentSetupContent({ onStart, userName }) {
  const {
    availableNames,
    selectedNames,
    isLoading,
    errors,
    isError,
    clearErrors,
    clearError,
    toggleName,
    handleSelectAll
  } = useTournamentSetup(userName);

  // Enhanced state for new features
  const [openImages, setOpenImages] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [isSwipeMode, setIsSwipeMode] = useState(false);
  const [showCatPictures, setShowCatPictures] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [galleryImages, setGalleryImages] = useState(CAT_IMAGES);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Load gallery dynamically from Supabase Storage (cat-images bucket)
  // Merge with static gallery.json and built-in defaults (de-dup by basename)
  useEffect(() => {
    let cancelled = false;
    const trySupabase = async () => {
      try {
        if (!supabase) return false;
        const list = await imagesAPI.list('');
        if (Array.isArray(list) && list.length) return list;
      } catch {
        // Ignore errors when trying to load images
      }
      return [];
    };

    const tryStaticManifest = async () => {
      try {
        const res = await fetch('/assets/images/gallery.json', {
          cache: 'no-cache'
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (Array.isArray(data) && data.length) return data;
      } catch {
        // Ignore errors when trying to load images
      }
      return [];
    };

    (async () => {
      const supa = await trySupabase();
      const manifest = await tryStaticManifest();

      // Merge: supa first, then manifest, then built-ins
      const merged = [...(supa || []), ...(manifest || []), ...CAT_IMAGES];

      // Deduplicate by base name (ignore extension), prefer earlier entries
      const seen = new Set();
      const deduped = [];
      for (const url of merged) {
        if (!url) continue;
        // strip query/hash and extension
        const clean = String(url).split(/[?#]/)[0];
        const name = clean.substring(clean.lastIndexOf('/') + 1);
        const base = name.replace(/\.[^.]+$/, '').toLowerCase();
        if (seen.has(base)) continue;
        seen.add(base);
        deduped.push(url);
      }

      if (!cancelled) setGalleryImages(deduped);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Get categories and other enhanced data
  const [categories, setCategories] = useState([]);

  // Derive categories from available names to avoid schema coupling
  useEffect(() => {
    const unique = new Set();
    (availableNames || []).forEach((n) => {
      (n.categories || []).forEach((c) => unique.add(c));
    });
    const list = Array.from(unique)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, name }));
    setCategories(list);
  }, [availableNames]);

  // Simple admin detection - user "aaron" gets admin features
  // TODO: Replace with actual user authentication check
  const isAdmin = (userName || '').toLowerCase() === 'aaron';

  const handleImageOpen = (image) => {
    const idx = galleryImages.indexOf(image);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const handleMouseMove = (e) => {
    setOpenImages((prev) =>
      prev.map((img) => {
        if (img.isDragging) {
          return {
            ...img,
            position: {
              x: e.clientX - img.dragStart.x,
              y: e.clientY - img.dragStart.y
            }
          };
        }
        return img;
      })
    );
  };

  const handleMouseUp = () => {
    setOpenImages((prev) =>
      prev.map((img) => ({
        ...img,
        isDragging: false
      }))
    );
  };

  const handleResizeMove = (e) => {
    setOpenImages((prev) =>
      prev.map((img) => {
        if (img.isResizing) {
          const deltaX = e.clientX - img.resizeStart.x;
          const aspectRatio = img.size.width / img.size.height;

          let newWidth = img.size.width;
          let newHeight = img.size.height;

          switch (img.resizeHandle) {
            case 'nw':
              newWidth = Math.max(200, img.size.width - deltaX);
              newHeight = newWidth / aspectRatio;
              break;
            case 'ne':
              newWidth = Math.max(200, img.size.width + deltaX);
              newHeight = newWidth / aspectRatio;
              break;
            case 'sw':
              newWidth = Math.max(200, img.size.width - deltaX);
              newHeight = newWidth / aspectRatio;
              break;
            case 'se':
              newWidth = Math.max(200, img.size.width + deltaX);
              newHeight = newWidth / aspectRatio;
              break;
          }

          return {
            ...img,
            size: {
              width: newWidth,
              height: newHeight
            },
            resizeStart: {
              x: e.clientX,
              y: e.clientY
            }
          };
        }
        return img;
      })
    );
  };

  const handleResizeEnd = () => {
    setOpenImages((prev) =>
      prev.map((img) => ({
        ...img,
        isResizing: false,
        resizeHandle: null
      }))
    );
  };

  useEffect(() => {
    const hasDragging = openImages.some((img) => img.isDragging);
    const hasResizing = openImages.some((img) => img.isResizing);

    if (hasDragging || hasResizing) {
      window.addEventListener(
        'mousemove',
        hasResizing ? handleResizeMove : handleMouseMove
      );
      window.addEventListener(
        'mouseup',
        hasResizing ? handleResizeEnd : handleMouseUp
      );
      return () => {
        window.removeEventListener(
          'mousemove',
          hasResizing ? handleResizeMove : handleMouseMove
        );
        window.removeEventListener(
          'mouseup',
          hasResizing ? handleResizeEnd : handleMouseUp
        );
      };
    }
  }, [openImages]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Error Loading Names</h2>
          <ErrorDisplay
            errors={errors}
            onRetry={() => window.location.reload()}
            onDismiss={clearError}
            onClearAll={clearErrors}
            showDetails={process.env.NODE_ENV === 'development'}
          />
        </div>
      </div>
    );
  }

  if (availableNames.length === 0) {
    return (
      <div className={styles.container}>
        <h2>No Names Available</h2>
        <p className={styles.errorMessage}>
          There are no names available for the tournament at this time.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        {/* Selection Panel */}
        <div className={styles.selectionPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.headerRow}>
              <div className={styles.headerContent}>
                <h2 className={styles.panelTitle}>
                  Select Tournament Competitors
                </h2>
                <p className={styles.panelSubtitle}>
                  Choose at least 2 names to start your tournament
                </p>
              </div>
              <div className={styles.headerActions}>
                <button
                  onClick={handleSelectAll}
                  className={styles.selectAllButton}
                  aria-label={
                    selectedNames.length === availableNames.length
                      ? 'Clear all selections'
                      : 'Select all names'
                  }
                >
                  {selectedNames.length === availableNames.length
                    ? '✨ Start Fresh'
                    : '🎲 Select All'}
                </button>

                <button
                  onClick={() => setIsSwipeMode(!isSwipeMode)}
                  className={`${styles.swipeModeToggleButton} ${isSwipeMode ? styles.active : ''}`}
                  aria-label={
                    isSwipeMode ? 'Switch to card mode' : 'Switch to swipe mode'
                  }
                >
                  {isSwipeMode ? '🎯 Cards' : '💫 Swipe'}
                </button>

                <button
                  onClick={() => setShowCatPictures(!showCatPictures)}
                  className={`${styles.catPicturesToggleButton} ${showCatPictures ? styles.active : ''}`}
                  aria-label={
                    showCatPictures
                      ? 'Hide cat pictures'
                      : 'Show cat pictures on cards'
                  }
                  title="Add random cat pictures to make it more like Tinder! 🐱"
                >
                  {showCatPictures ? '🐱 Hide Cats' : '🐱 Show Cats'}
                </button>

                {selectedNames.length >= 2 && (
                  <StartButton
                    selectedNames={selectedNames}
                    onStart={onStart}
                    variant="header"
                  />
                )}
              </div>
            </div>

            {/* Name count for all users */}
            <div className={styles.nameCount}>
              <span className={styles.countText}>
                {selectedNames.length === 0
                  ? 'Pick some pawsome names! 🐾'
                  : `${selectedNames.length} Names Selected`}
              </span>

              {selectedNames.length === 1 && (
                <span className={styles.helperText} role="alert">
                  Just one more to start! 🎯
                </span>
              )}
            </div>

            {/* Admin-only enhanced statistics */}
            {isAdmin && (
              <div className={styles.nameStats}>
                <span className={styles.statItem}>
                  📊 {availableNames.length} total names
                </span>
                <span className={styles.statItem}>
                  ⭐{' '}
                  {availableNames.length > 0
                    ? Math.round(
                        availableNames.reduce(
                          (sum, name) => sum + (name.avg_rating || 1500),
                          0
                        ) / availableNames.length
                      )
                    : 1500}{' '}
                  avg rating
                </span>
                <span className={styles.statItem}>
                  🔥{' '}
                  {
                    availableNames.filter(
                      (name) => (name.popularity_score || 0) > 5
                    ).length
                  }{' '}
                  popular names
                </span>
              </div>
            )}
          </div>

          <NameSelection
            selectedNames={selectedNames}
            availableNames={availableNames}
            onToggleName={toggleName}
            isAdmin={isAdmin}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortBy={sortBy}
            onSortChange={setSortBy}
            isSwipeMode={isSwipeMode}
            onSwipeModeToggle={() => setIsSwipeMode(!isSwipeMode)}
            showCatPictures={showCatPictures}
            imageList={galleryImages}
          />

          {selectedNames.length >= 2 && (
            <div className={styles.startSection}>
              <StartButton selectedNames={selectedNames} onStart={onStart} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <div className={styles.tournamentHeader}>
              <h1 className={styles.tournamentTitle}>🏆 Cat Name Tournament</h1>
              <p className={styles.tournamentSubtitle}>
                Pick the perfect name for your cat through fun head-to-head
                battles!
              </p>
            </div>

            <div className={styles.progressSection}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${Math.max((selectedNames.length / Math.max(availableNames.length, 1)) * 100, 5)}%`
                  }}
                />
              </div>
              <span className={styles.progressText}>
                {selectedNames.length} of {availableNames.length} names selected
              </span>
            </div>

            <div className={styles.starsSection}>
              <h3 className={styles.starsTitle}>Cat Photos 📸</h3>
              <p className={styles.starsDescription}>
                Click any photo to get a closer look
              </p>
              <div className={styles.photoGrid}>
                {(showAllPhotos
                  ? galleryImages
                  : galleryImages.slice(0, 8)
                ).map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    className={`${styles.photoThumbnail} ${styles.photoThumbButton}`}
                    onClick={() => handleImageOpen(image)}
                    aria-label={`Open cat photo ${index + 1}`}
                  >
                    {image.startsWith('/assets/images/') ? (
                      (() => {
                        const base = image.replace(/\.[^.]+$/, '');
                        return (
                          <picture>
                            <source type="image/avif" srcSet={`${base}.avif`} />
                            <source type="image/webp" srcSet={`${base}.webp`} />
                            <img
                              src={image}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width="200"
                              height="200"
                            />
                          </picture>
                        );
                      })()
                    ) : (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width="200"
                        height="200"
                      />
                    )}
                    <div className={styles.photoOverlay}>
                      <span className={styles.photoIcon}>👁️</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className={styles.photoToolbar}>
                {galleryImages.length > 8 && (
                  <div className={styles.photoActionsRow}>
                    <button
                      type="button"
                      className={styles.photoMoreButton}
                      onClick={() => setShowAllPhotos((v) => !v)}
                    >
                      {showAllPhotos
                        ? 'Show fewer photos'
                        : `Show ${galleryImages.length - 8} more photos`}
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <div className={styles.photoUploadRow}>
                    <input
                      id="gallery-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (!files.length) return;
                        try {
                          const uploaded = [];
                          for (const f of files) {
                            const compressed = await compressImageFile(f, {
                              maxWidth: 1600,
                              maxHeight: 1600,
                              quality: 0.82
                            });
                            const url = await imagesAPI.upload(
                              compressed,
                              userName || 'aaron'
                            );
                            if (url) uploaded.push(url);
                          }
                          if (uploaded.length) {
                            setGalleryImages((prev) => [...uploaded, ...prev]);
                          }
                        } catch (err) {
                          console.error('Upload failed', err);

                          alert('Upload failed. Please try again.');
                        } finally {
                          e.target.value = '';
                        }
                      }}
                    />
                    <label
                      htmlFor="gallery-upload"
                      className={styles.photoUploadButton}
                    >
                      Upload Photos
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.sidebarCard}>
            <NameSuggestionSection />
          </div>
        </aside>
      </div>

      {lightboxOpen && (
        <Lightbox
          images={galleryImages}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={() =>
            setLightboxIndex(
              (i) => (i - 1 + galleryImages.length) % galleryImages.length
            )
          }
          onNext={() => setLightboxIndex((i) => (i + 1) % galleryImages.length)}
        />
      )}
    </div>
  );
}

function TournamentSetup(props) {
  return (
    <ErrorBoundary>
      <TournamentSetupContent {...props} />
    </ErrorBoundary>
  );
}

TournamentSetup.displayName = 'TournamentSetup';

TournamentSetup.propTypes = {
  onStart: PropTypes.func.isRequired
};

export default TournamentSetup;

// Lightweight lightbox component with keyboard navigation
function Lightbox({ images, index, onClose, onPrev, onNext }) {
  const closeBtnRef = React.useRef(null);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  React.useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  const current = images[index] || images[0];
  const base = current.replace(/\.[^.]+$/, '');

  return (
    <div
      className={styles.overlayBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      <div
        className={styles.lightboxContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.lightboxClose}
          onClick={onClose}
          aria-label="Close gallery"
          ref={closeBtnRef}
        >
          ×
        </button>
        <button
          type="button"
          className={`${styles.lightboxNav} ${styles.left}`}
          onClick={onPrev}
          aria-label="Previous photo"
        >
          ‹
        </button>
        <div className={styles.lightboxImageWrap}>
          <picture>
            <source type="image/avif" srcSet={`${base}.avif`} />
            <source type="image/webp" srcSet={`${base}.webp`} />
            <img
              src={current}
              alt={`Cat photo ${index + 1} of ${images.length}`}
              className={styles.lightboxImage}
              loading="eager"
              decoding="async"
            />
          </picture>
        </div>
        <button
          type="button"
          className={`${styles.lightboxNav} ${styles.right}`}
          onClick={onNext}
          aria-label="Next photo"
        >
          ›
        </button>
        <div className={styles.lightboxCounter} aria-live="polite">
          {index + 1} / {images.length}
        </div>
      </div>
    </div>
  );
}

Lightbox.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string).isRequired,
  index: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
  onPrev: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired
};
