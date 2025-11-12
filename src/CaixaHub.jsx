import React from 'react';
import { useNavigate } from 'react-router-dom';

function CaixaHub() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'caixa-diario',
      title: 'CAIXA DIÁRIO',
      description: 'Registre atos e pagamentos do movimento diário do caixa',
      icon: '💰',
      color: '#27ae60',
      route: '/caixa-diario'
    },
    {
      id: 'meus-fechamentos',
      title: 'CAIXAS FECHADOS',
      description: 'Visualize seus fechamentos de caixa',
      icon: '💰',
      color: '#27ae60',
      route: '/meus-fechamentos'
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
          fontSize: '24px',
          fontWeight: '600',
          letterSpacing: '0.5px'
        }}>
          Caixa - Sistema Auxiliar do RCPN
        </h1>
      </header>
      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '60px 32px'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '60px'
        }}>
          <h2 style={{
            fontSize: '40px',
            fontWeight: '700',
            color: 'white',
            margin: '0 0 16px 0',
            textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            letterSpacing: '-0.5px'
          }}>
            Gerencie o Caixa
          </h2>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            fontWeight: '300',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}>
            Acesse as funcionalidades de caixa diário e caixas fechados
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          marginBottom: '40px'
        }}>
          {featureCards.map((feature) => (
            <div
              key={feature.id}
              style={cardStyle(feature.color)}
              onClick={() => navigate(feature.route)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.15)';
                e.currentTarget.style.borderColor = feature.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))'
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#2c3e50',
                margin: '0 0 12px 0',
                letterSpacing: '0.5px'
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#7f8c8d',
                margin: 0,
                lineHeight: '1.5',
                fontWeight: '400'
              }}>
                {feature.description}
              </p>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${feature.color}, ${feature.color}88)`,
                borderRadius: '0 0 16px 16px'
              }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default CaixaHub;
