import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function RG() {
  const navigate = useNavigate();

  const modules = [
    {
      id: 'rg-caixa',
      title: 'Financeiro (Caixa)',
      description: 'Abertura/fechamento e movimentação do caixa para emissão de RG',
      icon: '💰',
      color: '#27ae60',
      route: '/rg/caixa'
    },
    {
      id: 'rg-agenda',
      title: 'Agenda de Atendimentos',
      description: 'Gerencie os agendamentos para emissão de RG',
      icon: '📅',
      color: '#2563eb',
      route: '/rg/agenda'
    }
  ];

  const cardStyle = (color) => ({
    background: 'white',
    borderRadius: '16px',
    padding: '32px 24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: `3px solid transparent`,
    textAlign: 'center',
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <header style={{
        background: 'rgba(44, 62, 80, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          color: 'white',
          margin: 0,
          fontSize: '20px',
          fontWeight: '600',
          letterSpacing: '0.5px'
        }}>
          RG — Emissão da Carteira de Identidade
        </h1>
      </header>

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 32px'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: '700',
            color: 'white',
            margin: '0 0 8px 0',
            textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
          }}>
            Módulo RG — Gestão Financeira e Agenda
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            fontWeight: '300'
          }}>
            Acesse e gerencie o caixa e os atendimentos para emissão da carteira de identidade.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {modules.map((m) => (
            <div
              key={m.id}
              style={cardStyle(m.color)}
              onClick={() => navigate(m.route)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.15)';
                e.currentTarget.style.borderColor = m.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div style={{
                fontSize: '40px',
                marginBottom: '12px',
                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))'
              }}>{m.icon}</div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#2c3e50',
                margin: '0 0 8px 0'
              }}>{m.title}</h3>
              <p style={{
                fontSize: '14px',
                color: '#7f8c8d',
                margin: 0
              }}>{m.description}</p>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${m.color}, ${m.color}88)`,
                borderRadius: '0 0 16px 16px'
              }} />
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            onClick={() => navigate('/rg/meus-fechamentos')}
            style={{
              background: '#1f8ef1',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Ver Fechamentos de Caixa (RG)
          </button>
        </div>
      </main>
    </div>
  );
}
