import React from 'react';
import { useNavigate } from 'react-router-dom';

function CaixaHub() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'caixa-diario',
      title: 'MOVIMENTO DIÁRIO DO CAIXA',
      description: 'Registre atos e pagamentos do movimento diário do caixa',
      icon: '💰',
      color: '#007bff',
      route: '/caixa-diario'
    },
    {
      id: 'meus-fechamentos',
      title: 'CAIXAS FECHADOS',
      description: 'Visualize seus fechamentos de caixa',
      icon: '💰',
      color: '#0056b3',
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
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      color: '#0b1324',
      background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 30%), radial-gradient(circle at 80% 0%, rgba(92,169,255,0.1), transparent 35%), linear-gradient(135deg, #0a1630 0%, #0e2145 50%, #0b1d3a 100%)",
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: 'linear-gradient(135deg, rgba(201,166,70,0.05) 0 20%, transparent 20% 100%), radial-gradient(circle at 30% 40%, rgba(255,255,255,0.06), transparent 50%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 12px)',
        opacity: 0.6,
        zIndex: 0
      }} />
        {/* Header removed to match Home visual */}
      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '60px 32px',
        position: 'relative',
        zIndex: 1
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
                color: '#053962',
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
