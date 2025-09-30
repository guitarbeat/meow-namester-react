/**
 * @module ThemeDemo
 * @description Demo component to showcase the welcome screen in both light and dark modes
 */

import React, { useState, useEffect } from 'react';
import WelcomeScreen from '../shared/components/WelcomeScreen/WelcomeScreen';
import useTheme from '../core/hooks/useTheme';
import './ThemeDemo.css';

function ThemeDemo() {
  const { isLightTheme, toggleTheme, setTheme } = useTheme();
  const [showWelcome, setShowWelcome] = useState(true);
  const [catName, setCatName] = useState('Whiskers McFluffy');
  const [nameStats] = useState([
    {
      id: '1',
      name: 'Whiskers',
      description: 'A classic cat name',
      rating: 8.5,
      wins: 12,
      losses: 3,
      totalMatches: 15,
      winRate: 80,
      rank: 1,
      categories: ['classic', 'cute']
    },
    {
      id: '2',
      name: 'McFluffy',
      description: 'A playful surname',
      rating: 7.2,
      wins: 8,
      losses: 5,
      totalMatches: 13,
      winRate: 62,
      rank: 2,
      categories: ['playful', 'surname']
    }
  ]);

  const handleWelcomeContinue = () => {
    setShowWelcome(false);
  };

  const handleToggleTheme = () => {
    toggleTheme();
  };

  const handleSetLightTheme = () => {
    setTheme(true);
  };

  const handleSetDarkTheme = () => {
    setTheme(false);
  };

  if (showWelcome) {
    return (
      <div className="theme-demo">
        <div className="theme-demo-header">
          <h1>Welcome Screen Theme Demo</h1>
          <div className="theme-controls">
            <button 
              className={`theme-button ${isLightTheme ? 'active' : ''}`}
              onClick={handleSetLightTheme}
            >
              ☀️ Light Mode
            </button>
            <button 
              className={`theme-button ${!isLightTheme ? 'active' : ''}`}
              onClick={handleSetDarkTheme}
            >
              🌙 Dark Mode
            </button>
            <button 
              className="theme-toggle-button"
              onClick={handleToggleTheme}
            >
              {isLightTheme ? '🌙' : '☀️'} Toggle Theme
            </button>
          </div>
        </div>
        
        <div className="theme-info">
          <p>
            This demonstrates the welcome screen in both light and dark modes. 
            Use the buttons above to switch between themes and see how the welcome screen adapts.
          </p>
        </div>

        <WelcomeScreen
          catName={catName}
          nameStats={nameStats}
          onContinue={handleWelcomeContinue}
        />
      </div>
    );
  }

  return (
    <div className="theme-demo">
      <div className="theme-demo-header">
        <h1>Welcome Screen Theme Demo</h1>
        <div className="theme-controls">
          <button 
            className={`theme-button ${isLightTheme ? 'active' : ''}`}
            onClick={handleSetLightTheme}
          >
            ☀️ Light Mode
          </button>
          <button 
            className={`theme-button ${!isLightTheme ? 'active' : ''}`}
            onClick={handleSetDarkTheme}
          >
            🌙 Dark Mode
          </button>
          <button 
            className="theme-toggle-button"
            onClick={handleToggleTheme}
          >
            {isLightTheme ? '🌙' : '☀️'} Toggle Theme
          </button>
        </div>
      </div>
      
      <div className="theme-info">
        <p>
          Welcome screen completed! You can still toggle between themes to see how the interface adapts.
        </p>
        <button 
          className="restart-button"
          onClick={() => setShowWelcome(true)}
        >
          🔄 Restart Demo
        </button>
      </div>

      <div className="demo-content">
        <h2>Theme Demo Complete</h2>
        <p>
          The welcome screen has been demonstrated in both light and dark modes. 
          Notice how the colors, backgrounds, and overall appearance change between themes.
        </p>
        
        <div className="theme-comparison">
          <div className="comparison-item">
            <h3>Light Theme Features:</h3>
            <ul>
              <li>Lighter background colors</li>
              <li>Darker text for better contrast</li>
              <li>Subtle shadows and borders</li>
              <li>Warm, inviting color palette</li>
            </ul>
          </div>
          
          <div className="comparison-item">
            <h3>Dark Theme Features:</h3>
            <ul>
              <li>Darker background colors</li>
              <li>Light text for better contrast</li>
              <li>Enhanced shadows and glows</li>
              <li>Cool, modern color palette</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThemeDemo;