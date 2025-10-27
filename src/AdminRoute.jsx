import React from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const role = (usuario.cargo || '').toLowerCase();
  const allowed = role === 'registrador' || role === 'substituto';
  if (!allowed) {
    return <Navigate to="/home2" />;
  }
  return children;
}