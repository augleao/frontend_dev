import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export default function PrivateRoute({ children }) {
  const { token } = useContext(AuthContext);
  console.log('[PrivateRoute] rendering, token present?', !!token, 'currentPath=', window.location.pathname);
  return token ? children : <Navigate to="/login" replace />;
}