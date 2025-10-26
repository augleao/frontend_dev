import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AtosGratuitos() {
  const navigate = useNavigate();
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    setNomeUsuario(usuario?.nome || 'Usuário');
  }, []);

  const featureCards = [
    {
      id: 'certidoes-gratuitas',
      title: 'CERTIDÕES GRATUITAS',
      description: 'Registre e gerencie certidões gratuitas',
      icon: '✍️',
      color: '#27ae60',
      route: '/certidoes-gratuitas'
    },
    {
      id: 'averbacoes-gratuitas',
      title: 'AVERBAÇÕES GRATUITAS',
      description: 'Registre e gerencie averbações gratuitas',
      icon: '⚖️',
      color: '#16a085',
      route: '/averbacoes-gratuitas'
    },
    {
      id: 'procedimentos-gratuitos',
      title: 'PROCEDIMENTOS GRATUITOS',
      description: 'Registre e gerencie procedimentos gratuitos',
      icon: '📑',
      color: '#1abc9c',
      route: '/procedimentos-gratuitos'
    },
    {
      id: 'consultar-atos-gratuitos',
      title: 'CONSULTAR ATOS GRATUITOS',
      description: 'Consulte e pesquise atos gratuitos registrados',
      icon: '🔍',
      color: '#16a085',
      route: '/consultar-atos-gratuitos'
    },
    {
      id: 'relatorio-atos-gratuitos',
      title: 'RELATÓRIOS',
      description: 'Gere relatórios de atos gratuitos por período',
      icon: '📊',
      color: '#1abc9c',
      route: '/relatorio-atos-gratuitos'
    }
  ];

  const futureFeatures = [
    {
      title: 'ESTATÍSTICAS',
      description: 'Em breve: Estatísticas detalhadas de atos gratuitos',
      icon: '📈',
      color: '#27ae60'
    },
    {
      title: 'EXPORTAÇÃO',
      description: 'Em breve: Exportar dados para diferentes formatos',
      icon: '💾',
      color: '#16a085'
    },
    {
      title: 'VALIDAÇÃO AUTOMÁTICA',
      description: 'Em breve: Validação automática de requisitos',
      icon: '✅',
      color: '#1abc9c'
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
      background: 'linear-gradient(135deg, #16a085 0%, #27ae60 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(44, 62, 80, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/home2')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            ← Voltar
          </button>
          <h1 style={{
            color: 'white',
            margin: 0,
            fontSize: '24px',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>
            Sistema Auxiliar do RCPN - Atos Gratuitos
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '60px 32px'
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
            📋 Gestão de Atos Gratuitos
          </h2>
          <p style={{
            fontSize: '20px',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            fontWeight: '300',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}>
            Gerencie e acompanhe todos os atos gratuitos do seu cartório
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

export default AtosGratuitos;
