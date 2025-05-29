/**
 * @module ErrorBoundary
 * @description A React error boundary component that catches JavaScript errors
 * anywhere in the child component tree and displays a fallback UI.
 */

import React from 'react';
import styles from './ErrorBoundary.module.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    
    // Log the error to your error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.icon}>⚠️</div>
            <h2 className={styles.title}>Something went wrong</h2>
            <p className={styles.message}>
              We're sorry, but something unexpected happened. You can try refreshing the page or contact support if the problem persists.
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <>
                  <br />
                  <br />
                  <strong>Error details (development only):</strong>
                  <br />
                  {this.state.error.toString()}
                </>
              )}
            </p>
            <button
              onClick={this.handleRefresh}
              className={styles.refreshButton}
            >
              <span className={styles.refreshIcon}>↻</span>
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary; 