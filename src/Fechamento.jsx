import React from 'react';
import FechamentoDiarioButton from './FechamentoDiarioButton';

export default function Fechamento({ onFechar }) {
  return (
    <div
      style={{
        textAlign: 'center',
        marginBottom: 32,
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <FechamentoDiarioButton onClick={onFechar} />
    </div>
  );
}