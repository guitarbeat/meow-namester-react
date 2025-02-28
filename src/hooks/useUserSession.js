/**
 * @module useUserSession
 * @description A custom React hook that manages user session state and authentication.
 * This is now a wrapper around the AuthContext for backward compatibility.
 * New components should use the AuthContext directly.
 * 
 * @example
 * // Using the hook in a component
 * const { userName, isLoggedIn, error, login, logout } = useUserSession();
 * 
 * // Login a user
 * await login('JohnDoe');
 * 
 * // Logout
 * await logout();
 * 
 * @deprecated Use the useAuth hook from contexts/AuthContext instead
 * 
 * @returns {Object} Session management object
 * @property {string} userName - Current user's username
 * @property {boolean} isLoggedIn - Whether a user is currently logged in
 * @property {string|null} error - Any error message from login/logout operations
 * @property {Function} login - Async function to log in a user
 * @property {Function} logout - Async function to log out the current user
 */

import { useAuth } from '../contexts';

function useUserSession() {
  const {
    userName,
    isLoggedIn,
    error,
    login,
    logout,
    isInitialized
  } = useAuth();

  return {
    userName,
    isLoggedIn,
    error,
    login,
    logout,
    isInitialized
  };
}

export default useUserSession; 