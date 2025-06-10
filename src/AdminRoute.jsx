import React from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  if (usuario.cargo !== 'Registrador') {
    return <Navigate to="/home2" />;
  }
  return children;
}