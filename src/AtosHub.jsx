import React from 'react';
import { useNavigate } from 'react-router-dom';
import './home2.css';

function AtosHub() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'atos-praticados',
      title: 'Atos Pagos',
      description: 'Gerencie atos praticados no dia (atos selados).',
      icon: '🔗',
      color: '#27ae60',
      route: '/atos-praticados',
    },
    {
      id: 'atos-gratuitos',
      title: 'Atos Gratuitos',
      description: 'Controle atos gratuitos e funcionalidades relacionadas.',
      icon: '📋',
      color: '#16a085',
      route: '/atos-gratuitos',
    },
    {
      id: 'pesquisa-atos',
      title: 'Pesquisa de Atos',
      description: 'Pesquise por período, escrevente e tipo de ato.',
      icon: '🔍',
      color: '#f39c12',
      route: '/pesquisa-atos-praticados',
    },
    {
      id: 'comparar-atos-dap',
      title: 'Comparar Atos x DAP',
      description: 'Compare atos pagos (tributação 01) versus DAP por código/mês.',
      icon: '📊',
      color: '#0ea5e9',
      route: '/comparar-atos-dap',
    },
    {
      id: 'conciliacao',
      title: 'Conciliação Atos Pagos',
      description: 'Realize a conciliação e fechamento dos atos pagos.',
      icon: '⚖️',
      color: '#3498db',
      route: '/conciliacao',
    },
  ];

  const quickLinks = [
    { label: 'Atos Pagos', icon: '💰', route: '/atos-praticados' },
    { label: 'Conciliação', icon: '🔁', route: '/conciliacao' },
    { label: 'Pesquisa', icon: '🔍', route: '/pesquisa-atos-praticados' },
  ];

  return (
    <div className="home2-shell">
      <div className="home2-watermark" />

      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Atos Praticados</div>
            <div className="hero-sub">Controle de atos pagos, gratuitos, conciliação e comparação com DAP.</div>
            <div className="hero-chips">
              <span className="hero-chip">Pagos</span>
              <span className="hero-chip">Gratuitos</span>
              <span className="hero-chip">Conciliação</span>
            </div>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/atos-praticados')}>Atos Pagos</button>
              <button className="btn btn-outline" onClick={() => navigate('/conciliacao')}>Conciliação</button>
              <button className="btn btn-outline" onClick={() => navigate('/comparar-atos-dap')}>Comparar DAP</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos Atos</span>
              <span style={{ color: '#6b7280', fontWeight: 700 }}>Rápido</span>
            </div>
            <div className="quick-links">
              {quickLinks.map((item) => (
                <div key={item.route} className="quick-link" onClick={() => navigate(item.route)}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cards-grid">
          {featureCards.map((card) => (
            <div
              key={card.id}
              className="hub-card"
              onClick={() => navigate(card.route)}
              style={{ borderColor: `${card.color}22` }}
            >
              <div className="hub-icon" style={{ background: `${card.color}22`, color: '#0b1d3a' }}>{card.icon}</div>
              <div className="hub-title">{card.title}</div>
              <div className="hub-desc">{card.description}</div>
              <div className="hub-tag" style={{ background: `${card.color}22`, color: '#0b1d3a' }}>Atos</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${card.color}66`, borderRadius: '0 0 16px 16px' }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default AtosHub;