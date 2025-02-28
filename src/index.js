/**
 * @module index
 * @description Application entry point. Renders the main App component
 * into the DOM and sets up React's StrictMode for development checks.
 * 
 * @requires React
 * @requires ReactDOM
 * @requires App
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AppProviders } from './contexts';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
);
