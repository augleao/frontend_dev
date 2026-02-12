import React from 'react';
import { useNavigate } from 'react-router-dom';

function Relatorios() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'analise-dap',
      title: 'CADASTRO DAS DAPs',
      description: 'Gerencie DAP mensais, versões retificadoras e atos detalhados',
      icon: '🧾',
      color: '#1d4ed8',
      route: '/relatorios/dap'
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
      id: 'relatorio-atos-conciliados',
      title: 'RELATÓRIO DE ATOS CONCILIADOS',
      description: 'Filtre e gere relatório dos atos conciliados por período, forma de pagamento e tipo de ato',
      icon: '🤝',
      color: '#8e44ad',
      route: '/relatorio-atos-conciliados'
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
              onClick={() => navigate(feature.route)}
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
