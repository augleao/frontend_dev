import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    setNomeUsuario(usuario?.nome || 'Usuário');
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

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
    },
    {
      id: 'manutencao-servicos',
      title: 'PEDIDOS',
      description: 'Gerencie o ciclo completo de pedidos: entrada, cliente, pagamento, execução e entrega',
      icon: '📝',
      color: '#8e44ad',
      route: '/lista-servicos'
    },
    {
      id: 'atos-praticados',
      title: 'ATOS PRATICADOS',
      description: 'Gerencie os atos praticados no dia (atos selados)',
      icon: '🔗',
      color: '#27ae60',
      route: '/atos-praticados'
    },
    {
      id: 'pesquisa-atos',
      title: 'PESQUISA DE ATOS PRATICADOS',
      description: 'Pesquise e consulte atos praticados por período, escrevente e tipo',
      icon: '🔍',
      color: '#f39c12',
      route: '/pesquisa-atos-praticados'
    },
    {
      id: 'conciliacao',
      title: 'CONCILIAÇÃO ATOS PAGOS',
      description: 'Realize a conciliação e fechamento dos atos pagos',
      icon: '⚖️',
      color: '#3498db',
      route: '/conciliacao'
    },
    {
      id: 'relatorios',
      title: 'ATOS CONCILIADOS',
      description: 'Visualize relatórios e histórico de atos conciliados',
      icon: '⚖️',
      color: '#3498db',
      route: '/meus-relatorios'
    },
    {
      id: 'relatorio-cnj',
      title: 'RELATÓRIO SEMESTRAL CNJ',
      description: 'Processe arquivos PDF do TJMG para gerar relatório semestral',
      icon: '📊',
      color: '#e67e22',
      route: '/relatorio-cnj'
    }
  ];

  const futureFeatures = [
    {
      title: 'BACKUP AUTOMÁTICO',
      description: 'Em breve: Sistema de backup automático',
      icon: '💾',
      color: '#34495e'
    },
    {
      title: 'AUDITORIA',
      description: 'Em breve: Sistema de auditoria e logs',
      icon: '🔍',
      color: '#e74c3c'
    },
    {
      title: 'INTEGRAÇÃO API',
      description: 'Em breve: Integração com sistemas externos',
      icon: '🔗',
      color: '#16a085'
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        <h1 style={{
          color: 'white',
          margin: 0,
          fontSize: '24px',
          fontWeight: '600',
          letterSpacing: '0.5px'
        }}>
          Sistema Auxiliar do RCPN v1.4.92
        </h1>
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
            Bem-vindo ao Sistema Auxiliar do RCPN
          </h2>
          <p style={{
            fontSize: '20px',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            fontWeight: '300',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}>
            Gerencie eficientemente atos e conciliações no Registro Civil de Pessoas Naturais
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
            🚀 Mais Funcionalidades
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

export default Home;

