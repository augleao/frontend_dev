import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function FerramentasIA() {
  const navigate = useNavigate();
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    setNomeUsuario(usuario?.nome || 'Usuário');
  }, []);

  // Mantém o mesmo layout de AtosGratuitos/Home2, com fundo amarelo pastel
  const featureCards = [
    {
      id: 'assistente-preenchimento',
      title: 'ASSISTENTE DE MANDADOS',
      description: 'Analise mandados e gere averbações decorrentes de mandados',
      icon: '🧠',
      color: '#f1c40f',
      route: '/ferramentas-ia/assistente-mandados'
    },
    {
      id: 'analise-documentos',
      title: 'LEITURA DE LIVROS DE REGISTRO',
      description: 'Extração automática de dados manuscritos a partir de imagens',
      icon: '📄',
      color: '#f39c12',
      route: '/ferramentas-ia/leitura-livros'
    }
  ];

  // Adiciona cartão para Análise da DAP (integração com AnaliseDAP.jsx)
  featureCards.splice(2, 0, {
    id: 'analise-dap',
    title: 'ANÁLISE DE DAP',
    description: 'Análises inteligentes das DAPs da sua serventia',
    icon: '📊',
    color: '#9b59b6',
    route: '/ferramentas-ia/analise-dap'
  });

  const futureFeatures = [
    {
      title: 'RESUMOS AUTOMÁTICOS',
      description: 'Gere resumos de documentos longos',
      icon: '📝',
      color: '#f1c40f'
    },
    {
      title: 'TRADUÇÃO CONTEXTUAL',
      description: 'Tradução com preservação de termos jurídicos',
      icon: '🌐',
      color: '#f39c12'
    },
    {
      title: 'BUSCA INTELIGENTE',
      description: 'Pesquisa semântica em seus registros',
      icon: '🔎',
      color: '#f7b731'
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

  const futureCardStyle = {
    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
    textAlign: 'center',
    minHeight: '160px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    border: '2px dashed #dee2e6',
    opacity: 0.7
  };

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

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '60px 32px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Welcome Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: '60px'
        }}>
          <h2 style={{
            fontSize: '48px',
            fontWeight: '700',
            color: 'white',
            margin: '0 0 16px 0',
            textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            letterSpacing: '-0.5px'
          }}>
            🤖 Ferramentas de IA
          </h2>
          <p style={{
            fontSize: '20px',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            fontWeight: '300',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}>
            Acelere tarefas com utilitários inteligentes integrados ao seu fluxo
          </p>
        </div>

        {/* Feature Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          marginBottom: '80px'
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

        {/* Future Features Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '48px 32px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <h3 style={{
            fontSize: '32px',
            fontWeight: '600',
            color: 'white',
            textAlign: 'center',
            margin: '0 0 40px 0',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}>
            🚀 Próximas Funcionalidades
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {futureFeatures.map((feature, index) => (
              <div key={index} style={futureCardStyle}>
                <div style={{
                  fontSize: '32px',
                  marginBottom: '12px',
                  opacity: 0.7
                }}>
                  {feature.icon}
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#6c757d',
                  margin: '0 0 8px 0'
                }}>
                  {feature.title}
                </h4>
                <p style={{
                  fontSize: '12px',
                  color: '#868e96',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default FerramentasIA;
