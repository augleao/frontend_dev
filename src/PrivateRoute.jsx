import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export default function PrivateRoute({ children }) {
  const { token, isLoggingOut } = useContext(AuthContext);
  console.log('[PrivateRoute] rendering, token present?', !!token, 'isLoggingOut=', !!isLoggingOut, 'currentPath=', window.location.pathname);
  if (isLoggingOut) {
    // During logout we avoid redirecting to /login to prevent a flash
    return null;
  }
  return token ? children : <Navigate to="/login" replace />;
}