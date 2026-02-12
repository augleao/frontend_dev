import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  const login  = (u, t) => { console.log('[AuthContext] login', { user: u }); setUser(u); setToken(t); };
  const logout = () => {
    console.log('[AuthContext] logout - starting');
    setIsLoggingOut(true);
    // clear auth state
    setUser(null);
    setToken(null);
    console.log('[AuthContext] logout - cleared');
    // note: we intentionally keep isLoggingOut true briefly to let components avoid redirecting
    setTimeout(() => setIsLoggingOut(false), 1000);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoggingOut }}>
      {children}
    </AuthContext.Provider>
  );
}