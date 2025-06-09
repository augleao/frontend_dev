import React from 'react';

function Home() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(120deg, #f8fafc 0%, #e8eaed 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      padding: '0 20px',
      textAlign: 'center'
    }}>
      <h1 style={{
        fontSize: '3.5rem',
        fontWeight: 600,
        marginBottom: '20px',
        color: '#333',
        textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
      }}>
        Controle de Caixa Diário
      </h1>
      <p style={{
        fontSize: '1.4rem',
        color: '#555',
        maxWidth: '700px',
        lineHeight: '1.6',
        marginBottom: '40px'
      }}>
        Sistema desenvolvido para auxiliar os <strong>Cartórios de Registro Civil das Pessoas Naturais</strong> no controle diário de caixa. Simplifique a conciliação financeira e otimize a rotina dos seus colaboradores.
      </p>
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <a href="/login" style={{
          padding: '12px 30px',
          fontSize: '1.1rem',
          fontWeight: 500,
          color: '#fff',
          background: '#007bff',
          borderRadius: '8px',
          textDecoration: 'none',
          transition: 'background 0.3s ease',
          ':hover': { background: '#0056b3' }
        }}>
          Login
        </a>
        <a href="/signup" style={{
          padding: '12px 30px',
          fontSize: '1.1rem',
          fontWeight: 500,
          color: '#555',
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: '8px',
          textDecoration: 'none',
          transition: 'background 0.3s ease',
          ':hover': { background: '#f0f0f0' }
        }}>
          Cadastre-se
        </a>
      </div>
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Notary_public_seal.svg/512px-Notary_public_seal.svg.png"
        alt="Cartório"
        style={{ width: 120, opacity: 0.12, position: 'absolute', bottom: 40, right: 40, pointerEvents: 'none' }}
      />
    </div>
  );
}

export default Home;