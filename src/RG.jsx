import React from 'react';
import { useNavigate } from 'react-router-dom';
import './home2.css';

export default function RG() {
  const navigate = useNavigate();

  const modules = [
    { id: 'rg-agenda', title: 'Agenda', description: 'Gerenciar atendimentos agendados', icon: '📅', route: '/rg/agenda', color: '#2563eb' },
    { id: 'rg-caixa', title: 'Financeiro (Caixa)', description: 'Abertura/fechamento e movimentação do caixa', icon: '💰', route: '/rg/caixa', color: '#059669' },
    { id: 'rg-emissao', title: 'Emissão', description: 'Processo de emissão da carteira de identidade', icon: '🪪', route: '/rg/emissao', color: '#d97706' },
    { id: 'rg-relatorios', title: 'Relatórios', description: 'Relatórios e extrações', icon: '📊', route: '/rg/relatorios', color: '#7c3aed' },
  ];

  return (
    <div className="home2-shell">
      <div className="home2-watermark" />

      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Módulo RG — Gestão Financeira e Agenda</div>
            <div className="hero-sub">Acesse e gerencie o caixa e os atendimentos para emissão da carteira de identidade.</div>
            <div className="hero-chips">
              <span className="hero-chip">Agendamento</span>
              <span className="hero-chip">Emissão</span>
              <span className="hero-chip">Financeiro</span>
            </div>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/rg/agenda')}>Ver Agenda</button>
              <button className="btn btn-outline" onClick={() => navigate('/rg/caixa')}>Abrir Caixa</button>
              <button className="btn btn-outline" onClick={() => navigate('/rg/relatorios')}>Relatórios</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos RG</span>
              <span style={{ color: '#9ca3af', fontWeight: 700 }}>Tudo em 1 clique</span>
            </div>
            <div className="quick-links">
              {modules.slice(0,3).map((m) => (
                <div key={m.id} className="quick-link" onClick={() => navigate(m.route)}>
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  <span style={{ fontWeight:700 }}>{m.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cards-grid">
          {modules.map((m) => (
            <div key={m.id} className="hub-card" onClick={() => navigate(m.route)} style={{ borderColor: `${m.color}22` }}>
              <div className="hub-icon" style={{ background: `${m.color}22`, color: '#0b1d3a' }}>{m.icon}</div>
              <div className="hub-title">{m.title}</div>
              <div className="hub-desc">{m.description}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${m.color}66`, borderRadius: '0 0 12px 12px' }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
