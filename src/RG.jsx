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
    },
    {
      id: 'rg-relatorios',
      title: 'Relatórios Financeiros',
      description: 'Receitas, despesas e tributos projetados para a emissão de RG',
      icon: '📊',
      color: '#f59e0b',
      route: '/rg/relatorios'
    },
    {
      id: 'rg-fechamentos',
      title: 'Fechamentos de Caixa',
      description: 'Visualize os fechamentos diários do caixa RG',
      icon: '🗂️',
      color: '#1f8ef1',
      route: '/rg/meus-fechamentos'
    }
  ];

  return (
    <div className="home2-shell">
      <style>{`
        :root {
          --navy-deep: #0b1d3a;
          --navy: #10294e;
          --navy-soft: #152f56;
          --gray-bg: #f3f4f6;
          --gray-soft: #e5e7eb;
          --white: #ffffff;
          --gold: #c9a646;
          --blue-cta: #5ca9ff;
          --text-main: #0b1324;
          --text-soft: #4b5563;
        }

        .home2-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          color: var(--text-main);
          background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 30%),
                      radial-gradient(circle at 80% 0%, rgba(92,169,255,0.1), transparent 35%),
                      linear-gradient(135deg, #0a1630 0%, #0e2145 50%, #0b1d3a 100%);
          position: relative;
          overflow: hidden;
        }

        .home2-watermark {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(135deg, rgba(201,166,70,0.05) 0 20%, transparent 20% 100%),
            radial-gradient(circle at 30% 40%, rgba(255,255,255,0.06), transparent 50%),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 12px);
          opacity: 0.6;
        }

        .home2-main {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: 0 auto;
          padding: 30px 36px 64px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .section-head { color: var(--white); }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }

        .hub-card {
          position: relative;
          background: var(--white);
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 14px 32px rgba(0,0,0,0.12);
          border: 1px solid rgba(16,41,78,0.08);
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.2s ease;
        }

        .hub-card:hover { transform: translateY(-4px); box-shadow: 0 18px 46px rgba(0,0,0,0.15); }

        .hub-icon { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; font-size:22px; font-weight:800; color:var(--navy); background: rgba(16,41,78,0.08); }
        .hub-title { font-size:16px; font-weight:800; color:var(--navy); }
        .hub-desc { color:var(--text-soft); font-size:14px; line-height:1.4; }

        @media (max-width: 1024px) { .home2-main { padding: 24px 20px 46px; } }
      `}</style>

      <div className="home2-watermark" />

      <main className="home2-main">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, color: 'white', margin: 0, textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>Módulo RG — Gestão Financeira e Agenda</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 8, fontWeight: 300 }}>Acesse e gerencie o caixa e os atendimentos para emissão da carteira de identidade.</p>
        </div>

        <div className="cards-grid">
          {modules.map((m) => (
            <div
              key={m.id}
              className="hub-card"
              onClick={() => navigate(m.route)}
              style={{ borderColor: `${m.color}22` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = m.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${m.color}22`; }}
            >
              <div className="hub-icon" style={{ background: `${m.color}22`, color: '#0b1d3a' }}>{m.icon}</div>
              <div className="hub-title">{m.title}</div>
              <div className="hub-desc">{m.description}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${m.color}66`, borderRadius: '0 0 16px 16px' }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
