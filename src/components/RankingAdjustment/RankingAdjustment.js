import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import './RankingAdjustment.css';

function RankingAdjustment({ rankings = [], onSave }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(rankings);
  const [saveStatus, setSaveStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Helper function to check if rankings have actually changed
  const haveRankingsChanged = (newItems, oldRankings) => {
    if (!newItems || !oldRankings) return false;
    if (newItems.length !== oldRankings.length) return true;
    return newItems.some((item, index) => {
      return item.name !== oldRankings[index].name || 
             item.rating !== oldRankings[index].rating;
    });
  };

  useEffect(() => {
    if (!rankings || rankings.length === 0) return;
    
    // Sort rankings by rating first, then by win percentage if ratings are equal
    const sortedRankings = [...rankings].sort((a, b) => {
      // Calculate win percentages
      const aWinPercent = (a.wins || 0) / (Math.max((a.wins || 0) + (a.losses || 0), 1));
      const bWinPercent = (b.wins || 0) / (Math.max((b.wins || 0) + (b.losses || 0), 1));
      
      // If ratings differ by more than 10 points, sort by rating
      if (Math.abs(a.rating - b.rating) > 10) {
        return b.rating - a.rating;
      }
      
      // If ratings are close, sort by win percentage first
      if (aWinPercent !== bWinPercent) {
        return bWinPercent - aWinPercent;
      }
      
      // If win percentages are equal, sort by total wins
      if ((a.wins || 0) !== (b.wins || 0)) {
        return (b.wins || 0) - (a.wins || 0);
      }
      
      // Finally, sort by rating
      return b.rating - a.rating;
    });
    setItems(sortedRankings);
  }, [rankings]);

  useEffect(() => {
    if (items && rankings && haveRankingsChanged(items, rankings)) {
      console.log('Rankings changed, preparing to save:', {
        currentItems: items,
        previousRankings: rankings,
        differences: items.map(item => {
          const oldRanking = rankings.find(r => r.name === item.name);
          return {
            name: item.name,
            oldRating: oldRanking?.rating,
            newRating: item.rating,
            difference: oldRanking ? item.rating - oldRanking.rating : 'new item'
          };
        })
      });

      setSaveStatus('saving');
      const saveTimer = setTimeout(async () => {
        try {
          console.log('Initiating save operation with items:', items);
          await onSave(items);
          console.log('Save operation completed successfully');
          setSaveStatus('success');
          setTimeout(() => setSaveStatus(''), 2000);
        } catch (error) {
          console.error('Failed to save rankings:', {
            error,
            items,
            rankings,
            errorDetails: {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            }
          });
          setSaveStatus('error');
          setTimeout(() => setSaveStatus(''), 3000);
        }
      }, 500);

      return () => clearTimeout(saveTimer);
    }
  }, [items, rankings, onSave]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result) => {
    setIsDragging(false);
    if (!result.destination) return;

    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    // Enhanced rating calculation with better wins/losses preservation
    const adjustedItems = newItems.map((item, index) => {
      const originalItem = items.find(original => original.name === item.name);
      return {
        ...item,
        rating: Math.round(
          1000 + (1000 * (newItems.length - index)) / newItems.length
        ),
        // Explicitly preserve wins and losses from the original item
        wins: originalItem?.wins ?? 0,
        losses: originalItem?.losses ?? 0
      };
    });

    setItems(adjustedItems);
  };

  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saving':
        return <div className="save-status-toast saving">Saving changes...</div>;
      case 'success':
        return <div className="save-status-toast success">✓ Changes saved</div>;
      case 'error':
        return <div className="save-status-toast error">Failed to save. Try again.</div>;
      default:
        return null;
    }
  };

  return (
    <div className={`ranking-adjustment ${isDragging ? 'is-dragging' : ''}`}>
      <header className="ranking-header">
        <h2>Your Cat Name Rankings</h2>
      </header>
      {saveStatus && (
        <div className="save-status-container">
          {getSaveStatusDisplay()}
        </div>
      )}

      <div className="instructions-card">
        <div className="instruction-icon">↕️</div>
        <div className="instruction-text">
          <h3>How to Adjust Rankings</h3>
          <p>
            Drag and drop names to reorder them. Names at the top will receive higher
            ratings. Your changes are saved automatically.
          </p>
        </div>
      </div>
      
      <div className="rankings-grid">
        <div className="rankings-header">
          <div className="rank-header">Rank</div>
          <div className="name-header">Name</div>
          <div className="rating-header">Rating</div>
        </div>

        <DragDropContext 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Droppable droppableId="rankings">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`rankings-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
              >
                {items.map((item, index) => (
                  <Draggable 
                    key={item.name} 
                    draggableId={item.name} 
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`ranking-card ${snapshot.isDragging ? 'dragging' : ''}`}
                      >
                        <div className="rank-badge">{index + 1}</div>
                        <div className="card-content">
                          <h3 className="name">{item.name}</h3>
                          <div className="stats">
                            <span className="rating">Rating: {Math.round(item.rating)}</span>
                            <span className="record">W: {item.wins || 0} L: {item.losses || 0}</span>
                          </div>
                        </div>
                        <div className="drag-handle">
                          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                            <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="adjustment-controls">
        <button 
          onClick={() => navigate('/tournament', { replace: true })}
          className="back-button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Tournament
        </button>
      </div>
    </div>
  );
}

export default RankingAdjustment; 