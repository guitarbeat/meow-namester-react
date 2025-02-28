import React, { useState, useEffect, useCallback } from 'react';
import { supabase, getNamesWithDescriptions } from '../../supabase/supabaseClient';
import { LoadingSpinner, NameCard, ErrorBoundary } from '../';
import { useAuth, useTournament, useUserPreferences, useNameOptions } from '../../contexts';
import styles from './TournamentSetup.module.css';

const CAT_IMAGES = [
  'IMG_4844.jpg',
  'IMG_4845.jpg',
  'IMG_4846.jpg',
  'IMG_4847.jpg',
  'IMG_5044.JPEG',
  'IMG_5071.JPG'
];

const DEFAULT_DESCRIPTION = "A name as unique as your future companion";

const WelcomeSection = ({ isExpanded, setIsExpanded }) => (
  <div className={styles.welcomeSection}>
    <h2>yo, help me pick a name ✌️</h2>
    <div className={`${styles.welcomeText} ${isExpanded ? styles.expanded : ''}`}>
      <button 
        className={styles.expandToggle}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="welcome-instructions"
      >
        <span className={styles.toggleText}>{isExpanded ? 'Hide Instructions' : 'Show Instructions'}</span>
        <span className={styles.toggleIcon}>{isExpanded ? '−' : '+'}</span>
      </button>
      <div id="welcome-instructions" className={styles.instructionsContent}>
        <p>here's how it works:</p>
        <ol className={styles.tournamentSteps}>
          <li>pick some names you vibe with</li>
          <li>vote on your faves in 1v1 battles</li>
          <li>watch the best name win</li>
          <li>that's it!</li>
        </ol>
      </div>
    </div>
  </div>
);

const NameCounter = ({ selectedCount, totalCount, onSelectAll }) => (
  <div className={styles.nameCount}>
    <div className={styles.countAndSelect}>
      <span className={styles.countText}>
        {selectedCount === 0 
          ? "Pick some pawsome names! 🐾" 
          : `${selectedCount} Names Selected`}
      </span>
      <button 
        onClick={onSelectAll}
        className={styles.selectAllButton}
        aria-label={selectedCount === totalCount ? 'Clear all selections' : 'Select all names'}
      >
        {selectedCount === totalCount 
          ? '✨ Start Fresh' 
          : '🎲 Select All'}
      </button>
    </div>
    {selectedCount === 1 && (
      <span className={styles.helperText} role="alert">
        Just one more to start! 🎯
      </span>
    )}
  </div>
);

const NameSelection = ({ selectedNames, availableNames, onToggleName }) => (
  <div className={styles.nameSelection}>
    <h2 className={styles.heading}>Pick multiple names you sorta like</h2>
    <p className={styles.selectionGuide}>
      You can pick as many as you want, but 2 is the minimum to start. The more you pick, the longer the tournament will take.
    </p>

    <div className={styles.cardsContainer}>
      {availableNames.map(nameObj => (
        <NameCard
          key={nameObj.id}
          name={nameObj.name}
          description={nameObj.description || DEFAULT_DESCRIPTION}
          isSelected={selectedNames.some(n => n.id === nameObj.id)}
          onClick={() => onToggleName(nameObj)}
          size="small"
          // shortcutHint={`Press Enter to ${selectedNames.some(n => n.id === nameObj.id) ? 'deselect' : 'select'} ${nameObj.name}`}
        />
      ))}
    </div>
  </div>
);

const StartButton = ({ selectedNames, onStart }) => {
  const validateNames = (names) => {
    return names.every(nameObj => 
      nameObj && 
      typeof nameObj === 'object' && 
      nameObj.name && 
      typeof nameObj.name === 'string' &&
      nameObj.id
    );
  };

  const handleStart = () => {
    if (!validateNames(selectedNames)) {
      console.error('Invalid name objects detected:', selectedNames);
      return;
    }
    onStart(selectedNames);
  };

  return (
    <div className={styles.startSection}>
      <button
        onClick={handleStart}
        className={styles.startButton}
        disabled={selectedNames.length < 2}
        aria-label={selectedNames.length < 2 ? 'Select at least 2 names to start' : 'Start Tournament'}
      >
        {selectedNames.length < 2 ? (
          <>Need {2 - selectedNames.length} More Name{selectedNames.length === 0 ? 's' : ''} 🎯</>
        ) : (
          <>Start Tournament! 🏆</>
        )}
      </button>
    </div>
  );
};

const NameSuggestionSection = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { addNameOption, loading } = useNameOptions();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    try {
      await addNameOption(name.trim(), description.trim());
      setSuccess('Thank you for your suggestion!');
      setName('');
      setDescription('');
    } catch (err) {
      setError('Failed to add name. It might already exist.');
    }
  };

  return (
    <div className={styles.suggestionSection}>
      <div className={styles.suggestionCard}>
        <h2>Suggest a Cat Name</h2>
        <p className={styles.suggestionIntro}>
          Have a great cat name in mind? Share it with the community!
        </p>

        <form onSubmit={handleSubmit} className={styles.suggestionForm}>
          <div className={styles.formGroup}>
            <label htmlFor="suggestion-name">Name</label>
            <input
              type="text"
              id="suggestion-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a cat name"
              maxLength={50}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="suggestion-description">Description</label>
            <textarea
              id="suggestion-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about this name's meaning or origin"
              maxLength={500}
              disabled={loading}
            />
          </div>

          {error && <p className={styles.errorMessage}>{error}</p>}
          {success && <p className={styles.successMessage}>{success}</p>}

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Name'}
          </button>
        </form>
      </div>
    </div>
  );
};

function useTournamentSetup() {
  const { userName } = useAuth();
  const { startTournament } = useTournament();
  const { preferences } = useUserPreferences();
  
  const [availableNames, setAvailableNames] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [error, setError] = useState(null);
  const [namesData, setNamesData] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Fetch names data only once on mount
  useEffect(() => {
    const fetchNames = async () => {
      try {
        if (isInitialLoad) {
          console.log('🎮 TournamentSetup: Initial setup started');
          setIsInitialLoad(false);
        }
        setIsLoading(true);
        setError(null);
        
        const [names, { data: hiddenData, error: hiddenError }] = await Promise.all([
          getNamesWithDescriptions(),
          supabase.from('hidden_names').select('name_id')
        ]);
        
        if (hiddenError) throw hiddenError;
        
        const newHiddenIds = new Set(hiddenData?.map(item => item.name_id) || []);
        setNamesData(names);
        setHiddenIds(newHiddenIds);
        
        console.log('🎮 TournamentSetup: Data loaded', {
          availableNames: names.length,
          hiddenNames: newHiddenIds.size,
          userPreferences: preferences.hiddenNames?.size || 0
        });
        
      } catch (err) {
        console.error('❌ TournamentSetup: Error fetching names:', err);
        setError(`Failed to load names: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNames();
  }, [preferences.hiddenNames]); // Only depend on preferences.hiddenNames

  // Filter and sort names when data or preferences change
  useEffect(() => {
    if (!namesData) return;

    const filteredNames = namesData
      .filter(name => 
        !hiddenIds.has(name.id) && 
        (!preferences.hiddenNames || !preferences.hiddenNames.has(name.id))
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const hasNamesChanged = 
      filteredNames.length !== availableNames.length ||
      JSON.stringify(filteredNames) !== JSON.stringify(availableNames);

    if (hasNamesChanged) {
      console.log('🎮 TournamentSetup: Names updated', {
        available: filteredNames.length,
        selected: selectedNames.length,
        hidden: hiddenIds.size
      });
      setAvailableNames(filteredNames);
      
      // Update selected names to remove any that are now hidden
      setSelectedNames(prev => {
        const updatedSelection = prev.filter(name => 
          !hiddenIds.has(name.id) && 
          (!preferences.hiddenNames || !preferences.hiddenNames.has(name.id))
        );
        return updatedSelection;
      });
    }
  }, [namesData, hiddenIds, preferences.hiddenNames]);

  const toggleName = useCallback((nameObj) => {
    setSelectedNames(prev => {
      const isSelected = prev.some(n => n.id === nameObj.id);
      const newSelection = isSelected
        ? prev.filter(n => n.id !== nameObj.id)
        : [...prev, nameObj];
      
      // Only log significant selection changes
      if (newSelection.length === 2 || newSelection.length === 0) {
        console.log('🎮 TournamentSetup: Selection updated', {
          count: newSelection.length,
          ready: newSelection.length >= 2
        });
      }
      
      return newSelection;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedNames(prev => {
      const newSelection = prev.length === availableNames.length ? [] : [...availableNames];
      console.log('🎮 TournamentSetup: Bulk selection', {
        action: newSelection.length === 0 ? 'cleared' : 'selected all',
        count: newSelection.length
      });
      return newSelection;
    });
  }, [availableNames]);

  const handleStart = useCallback((names) => {
    if (names.length < 2) {
      console.warn('❌ TournamentSetup: Cannot start - insufficient names selected');
      return;
    }
    console.log('🎮 TournamentSetup: Starting tournament', {
      participants: names.length,
      names: names.map(n => n.name)
    });
    startTournament(names);
  }, [startTournament]);

  return {
    availableNames,
    selectedNames,
    isLoading,
    error,
    enlargedImage,
    setEnlargedImage,
    toggleName,
    handleSelectAll,
    handleStart
  };
}

function TournamentSetupContent() {
  const {
    availableNames,
    selectedNames,
    isLoading,
    error,
    enlargedImage,
    setEnlargedImage,
    toggleName,
    handleSelectAll,
    handleStart
  } = useTournamentSetup();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (!enlargedImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !enlargedImage) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setDragOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!enlargedImage) {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [enlargedImage]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Error Loading Names</h2>
          <p className={styles.errorMessage}>{error}</p>
        </div>
      </div>
    );
  }

  if (availableNames.length === 0) {
    return (
      <div className={styles.container}>
        <h2>No Names Available</h2>
        <p className={styles.errorMessage}>There are no names available for the tournament at this time.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tournamentLayout}>
        <aside className={styles.photoSidebar}>
          <div className={styles.photoSidebarContent}>
            <h3>Name This Star! 🌟</h3>
            <p>Help choose a name worthy of this fabulous feline</p>
            <div className={styles.photoGrid}>
              {CAT_IMAGES.map((image, index) => (
                <div 
                  key={image}
                  className={styles.photoThumbnail}
                  onClick={() => setEnlargedImage(image)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View cat photo ${index + 1}`}
                >
                  <img 
                    src={`/images/${image}`}
                    alt={`Cat photo ${index + 1}`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <NameSuggestionSection />
        </aside>

        <main className={styles.namesContent}>
          <WelcomeSection 
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
          />

          <NameSelection 
            selectedNames={selectedNames}
            availableNames={availableNames}
            onToggleName={toggleName}
          />

          <NameCounter 
            selectedCount={selectedNames.length}
            totalCount={availableNames.length}
            onSelectAll={handleSelectAll}
          />

          {selectedNames.length >= 2 && (
            <StartButton 
              selectedNames={selectedNames}
              onStart={handleStart}
            />
          )}
        </main>

        {enlargedImage && (
          <div 
            className={styles.overlayBackdrop}
            onClick={() => setEnlargedImage(null)}
            role="button"
            tabIndex={-1}
            aria-label="Close enlarged image"
          >
            <div className={styles.overlayContent}>
              <img 
                src={`/images/${enlargedImage}`}
                alt="Enlarged cat photo"
                className={styles.enlargedImage}
                style={{
                  transform: `translate(-50%, -50%) translate(${dragOffset.x}px, ${dragOffset.y}px)`,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
              />
              <button 
                className={styles.closeButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setEnlargedImage(null);
                }}
                aria-label="Close enlarged image"
              >
                ×
              </button>
              <p className={styles.imageInstructions}>
                Click and drag to pan • Press ESC or click outside to close
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentSetup() {
  return (
    <ErrorBoundary>
      <TournamentSetupContent />
    </ErrorBoundary>
  );
}

export default TournamentSetup; 