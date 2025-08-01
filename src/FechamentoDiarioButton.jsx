// FechamentoDiarioButton.jsx
import React from 'react';

export default function FechamentoDiarioButton({ onClick }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 16 }}>
      <button
        style={{
          padding: '10px 10px',
            background: '#27ae60',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
        }}
        onClick={onClick}
      >
        Fechamento Diário do Caixa
      </button>
    </div>
  );
}