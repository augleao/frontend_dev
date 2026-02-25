import React from 'react';
import { useNavigate } from 'react-router-dom';
import './home2.css';

function CaixaHub() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'caixa-diario',
      title: 'Movimento Diário do Caixa',
      description: 'Registrar atos e pagamentos do movimento diário.',
      icon: '💰',
      color: '#5ca9ff',
      route: '/caixa-diario',
    },
    {
      id: 'meus-fechamentos',
      title: 'Caixas Fechados',
      description: 'Visualize e consulte fechamentos de caixa anteriores.',
      icon: '📦',
      color: '#4aa3f7',
      route: '/meus-fechamentos',
    },
  ];

  const quickLinks = [
    { label: 'Relatórios', icon: '📊', route: '/caixa/relatorios' },
    { label: 'Conciliação', icon: '🔁', route: '/caixa/conciliacao' },
  ];

  return (
    <div className="home2-shell">
      <div className="home2-watermark" />

      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Gestão do Caixa</div>
            <div className="hero-sub">Abertura, fechamento, conciliação e relatórios em um só lugar.</div>
            <div className="hero-chips">
              <span className="hero-chip">Abertura</span>
              <span className="hero-chip">Fechamento</span>
              <span className="hero-chip">Conciliação</span>
            </div>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/caixa')}>Abrir Caixa</button>
              <button className="btn btn-outline" onClick={() => navigate('/caixa-diario')}>Movimentos</button>
              <button className="btn btn-outline" onClick={() => navigate('/caixa/relatorios')}>Relatórios</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos Caixa</span>
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
              className="hub-card hub-card--caixa"
              onClick={() => navigate(card.route)}
              style={{ borderColor: `${card.color}22` }}
            >
              <div className="hub-caixa-inner">
                <div className="hub-caixa-main">
                  <div className="hub-icon hub-icon--caixa" style={{ background: `${card.color}22`, color: '#fff' }}>{card.icon}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="hub-title">{card.title}</div>
                    <div className="hub-desc">{card.description}</div>
                  </div>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${card.color}66`, borderRadius: '0 0 16px 16px' }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default CaixaHub;