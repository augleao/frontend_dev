import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: 'center', marginTop: '80px' }}>
      <h1>Bem-vindo ao Controle de Caixa</h1>
      <p>Escolha uma funcionalidade:</p>
      <button
        style={{
          fontSize: '1.2rem',
          padding: '16px 32px',
          background: '#4CAF50',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
        onClick={() => navigate('/conciliacao')}
      >
        CONCILIAÇÃO DO CAIXA
      </button>
    </div>
  );
}

export default Home;