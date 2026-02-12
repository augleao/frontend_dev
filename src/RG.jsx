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
    ,{
      id: 'rg-relatorios',
      title: 'Relatórios Financeiros',
      description: 'Receitas, despesas e tributos projetados para a emissão de RG',
      icon: '📊',
      color: '#f59e0b',
      route: '/rg/relatorios'
    }
    ,{
      id: 'rg-fechamentos',
      title: 'Fechamentos de Caixa',
      description: 'Visualize os fechamentos diários do caixa RG',
      icon: '🗂️',
      color: '#1f8ef1',
      route: '/rg/meus-fechamentos'
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
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 32px',
        position: 'relative',
        zIndex: 1
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

        {/* botão de fechamentos agora apresentado como cartão entre os módulos */}
      </main>
    </div>
  );
}
