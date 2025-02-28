/**
 * @module App
 * @description Main application component for the cat name tournament app.
 * Manages the overall application state and tournament flow, including:
 * - Name input and management
 * - Tournament progression
 * - Rating calculations
 * - Results display
 * 
 * Uses the Elo rating system for ranking and a custom sorting algorithm
 * for determining the best cat name through user preferences.
 * 
 * @component
 * @returns {JSX.Element} The complete application UI
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { 
  Results, 
  ErrorBoundary,
  Login,
  Profile,
  TournamentSetup
} from './components';
import Sidebar from './components/Sidebar/Sidebar';
import Tournament from './components/Tournament/Tournament';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import { useAuth, useTournament, useUserPreferences } from './contexts';
import { getNamesWithDescriptions } from './supabase/supabaseClient';

function App() {
  const { userName, isLoggedIn, login, logout } = useAuth();
  const { 
    tournamentComplete,
    tournamentNames,
    voteHistory,
    ratings,
    startTournament,
    handleVote,
    updateRatings
  } = useTournament();
  const { preferences, updatePreferences } = useUserPreferences();
  const navigate = useNavigate();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTournamentLoading, setIsTournamentLoading] = useState(false);

  // Update loading state effect
  useEffect(() => {
    setIsTournamentLoading(tournamentNames?.length === 0 ?? false);
  }, [tournamentNames]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  return (
    <div className="app">
      <Sidebar 
        currentPath={window.location.pathname}
        isLoggedIn={isLoggedIn}
        userName={userName}
        onLogout={logout}
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
      />
      <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <Routes>
          <Route path="/login" element={!isLoggedIn ? <Login onLogin={login} /> : <Navigate to="/tournament" />} />
          
          <Route path="/profile" element={
            isLoggedIn ? (
              <Profile 
                userName={userName}
                ratings={ratings}
                onUpdateRatings={updateRatings}
              />
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/tournament" element={
            isLoggedIn ? (
              tournamentComplete ? (
                <Results 
                  ratings={ratings}
                  userName={userName}
                  onUpdateRatings={updateRatings}
                  currentTournamentNames={tournamentNames}
                  voteHistory={voteHistory}
                  onStartNewTournament={async () => {
                    try {
                      await startTournament();
                      return true;
                    } catch (error) {
                      console.error('Failed to start tournament:', error);
                      return false;
                    }
                  }}
                />
              ) : !tournamentNames || tournamentNames.length === 0 ? (
                <TournamentSetup 
                  onStart={startTournament}
                  userName={userName}
                  existingRatings={ratings}
                />
              ) : (
                <Tournament 
                  names={tournamentNames}
                  existingRatings={ratings}
                  onComplete={updateRatings}
                  userName={userName}
                  onVote={handleVote}
                />
              )
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/" element={<Navigate to="/tournament" />} />
        </Routes>
      </div>
      
      {isTournamentLoading && (
        <div className="global-loading-overlay">
          <LoadingSpinner text="Initializing Tournament..." />
        </div>
      )}
    </div>
  );
}

export default App;