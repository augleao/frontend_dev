import React from 'react';
import { useNavigate } from 'react-router-dom';

function Relatorios() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'analise-dap',
      title: 'ANÁLISE DA DAP',
      description: 'Painel de análise da DAP (em breve)'.trim(),
      icon: '🧾',
      color: '#1d4ed8',
      route: null // em breve
    },
    {
      id: 'analise-atos-praticados',
      title: 'ANÁLISE DE ATOS PRATICADOS',
      description: 'Indicadores e consultas por período e escrevente',
      icon: '📊',
      color: '#2563eb',
      route: '/pesquisa-atos-praticados' // aproveita a tela existente de pesquisa
    },
    {
      id: 'relatorios-obrigatorios',
      title: 'RELATÓRIOS OBRIGATÓRIOS',
      description: 'Registre envios mensais exigidos pelos órgãos públicos',
      icon: '📮',
      color: '#2ecc71',
      route: '/relatorios-obrigatorios'
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
      background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(10px)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/home2')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            ← Voltar
          </button>
          <h1 style={{
            color: 'white',
            margin: 0,
            fontSize: '24px',
            fontWeight: '700',
            letterSpacing: '0.5px'
          }}>
            Hub de Relatórios e Análises
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '60px 32px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{
            fontSize: '44px',
            fontWeight: '800',
            color: 'white',
            margin: '0 0 16px 0',
            textShadow: '0 6px 12px rgba(0, 0, 0, 0.25)'
          }}>
            📘 Relatórios
          </h2>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255, 255, 255, 0.92)',
            margin: 0,
            fontWeight: '300'
          }}>
            Acesse análises e indicadores para apoiar a gestão do cartório
          </p>
        </div>

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
              onClick={() => {
                if (feature.route) navigate(feature.route);
                else alert('Em breve: Análise da DAP');
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.2)';
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
                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15))'
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '800',
                color: '#0f172a',
                margin: '0 0 12px 0',
                letterSpacing: '0.6px'
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
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

export default Relatorios;
