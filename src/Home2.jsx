import React from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  const buttonStyle = {
    fontSize: '1.2rem',
    padding: '16px 32px',
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '16px',
    display: 'block',
    margin: '16px auto'
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '80px' }}>
      <h1>Bem-vindo ao Sistema Auxiliar do RCPN</h1>
      <p>Escolha uma funcionalidade:</p>
      
      <button
        style={buttonStyle}
        onClick={() => navigate('/conciliacao')}
      >
        CONCILIAÇÃO DO CAIXA
      </button>
      
      <button
        style={buttonStyle}
        onClick={() => navigate('/meus-relatorios')}
      >
        CAIXAS CONCILIADOS
      </button>
    </div>
  );
}

export default Home;