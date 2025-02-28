import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase/supabaseClient';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('catNamesUser') || '';
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return '';
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(userName));
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const storedUser = localStorage.getItem('catNamesUser');
        if (storedUser) {
          const { data, error: dbError } = await supabase
            .from('app_users')
            .select('user_name')
            .eq('user_name', storedUser)
            .single();

          if (dbError || !data) {
            localStorage.removeItem('catNamesUser');
            setUserName('');
            setIsLoggedIn(false);
          } else {
            setUserName(storedUser);
            setIsLoggedIn(true);
          }
        }
      } catch (error) {
        console.error('Session initialization error:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeSession();
  }, []);

  const login = async (name) => {
    try {
      if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error('Please enter a valid name');
      }
      
      const trimmedName = name.trim();

      const { error: upsertError } = await supabase
        .from('app_users')
        .upsert({ 
          user_name: trimmedName,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_name',
          returning: 'minimal'
        });

      if (upsertError) throw upsertError;

      localStorage.setItem('catNamesUser', trimmedName);
      setUserName(trimmedName);
      setIsLoggedIn(true);
      setError(null);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem('catNamesUser');
    setUserName('');
    setIsLoggedIn(false);
    setError(null);
  };

  const value = {
    userName,
    isLoggedIn,
    error,
    login,
    logout,
    isInitialized
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
} 