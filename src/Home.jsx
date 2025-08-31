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
        Ferramentas Extrajudiciais
      </h1>
      <p style={{
        fontSize: '1.4rem',
        color: '#555',
        maxWidth: '700px',
        lineHeight: '1.6',
        marginBottom: '40px'
      }}>
        Conjunto de ferramentas para auxiliar os <strong> Oficiais do Registro Civil das Pessoas Naturais</strong> na administração da serventia. Simplifique as tarefas e otimize a rotina dos seus colaboradores.
      </p>
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '30px'
      }}>

      </div>
    </div>
  );
}

export default Home;