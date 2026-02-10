// FechamentoDiarioButton.jsx
import React from 'react';

export default function FechamentoDiarioButton({ onClick }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 16 }}>
      <button
        type="button"
        className="btn-gradient btn-gradient-green"
        style={{ padding: '10px 16px', fontWeight: 'bold' }}
        onClick={onClick}
      >
        Fechamento Diário do Caixa
      </button>
    </div>
  );
}