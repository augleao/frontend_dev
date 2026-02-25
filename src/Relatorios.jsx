import React from 'react';
import { useNavigate } from 'react-router-dom';
import './home2.css';

function Relatorios() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'analise-dap',
      title: 'Cadastro das DAPs',
      description: 'Gerencie DAP mensais, versões retificadoras e atos detalhados.',
      icon: '🧾',
      color: '#1d4ed8',
      route: '/relatorios/dap',
      tag: 'DAP',
    },
    {
      id: 'analise-atos-praticados',
      title: 'Análise de Atos Praticados',
      description: 'Indicadores e consultas por período e escrevente.',
      icon: '📊',
      color: '#2563eb',
      route: '/pesquisa-atos-praticados',
      tag: 'Atos',
    },
    {
      id: 'relatorio-atos-conciliados',
      title: 'Relatório de Atos Conciliados',
      description: 'Filtre por período, forma de pagamento e tipo de ato.',
      icon: '🤝',
      color: '#8e44ad',
      route: '/relatorio-atos-conciliados',
      tag: 'Conciliação',
    },
    {
      id: 'relatorios-obrigatorios',
      title: 'Relatórios Obrigatórios',
      description: 'Registre envios mensais exigidos pelos órgãos públicos.',
      icon: '📮',
      color: '#2ecc71',
      route: '/relatorios-obrigatorios',
      tag: 'Fiscal',
    },
    {
      id: 'relatorio-cnj',
      title: 'Relatório Semestral CNJ',
      description: 'Processe PDFs do TJMG e gere o relatório semestral.',
      icon: '📑',
      color: '#e67e22',
      route: '/relatorio-cnj',
      tag: 'CNJ',
    },
  ];

  const quickLinks = [
    { label: 'DAP', icon: '🧾', route: '/relatorios/dap' },
    { label: 'Atos Conciliados', icon: '🤝', route: '/relatorio-atos-conciliados' },
    { label: 'Atos Praticados', icon: '📜', route: '/pesquisa-atos-praticados' },
    { label: 'Relatórios Obrigatórios', icon: '📮', route: '/relatorios-obrigatorios' },
    { label: 'CNJ Semestral', icon: '📑', route: '/relatorio-cnj' },
  ];

  return (
    <div className="home2-shell">
      <div className="home2-watermark" />

      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Relatórios</div>
            <div className="hero-sub">DAP, atos, conciliação e envios obrigatórios em um só painel.</div>
            <div className="hero-chips">
              <span className="hero-chip">DAP</span>
              <span className="hero-chip">Atos</span>
              <span className="hero-chip">CNJ</span>
            </div>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/relatorios/dap')}>DAP</button>
              <button className="btn btn-outline" onClick={() => navigate('/relatorio-atos-conciliados')}>Conciliados</button>
              <button className="btn btn-outline" onClick={() => navigate('/relatorios-obrigatorios')}>Obrigatórios</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos Relatórios</span>
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
          {featureCards.map((feature) => (
            <div
              key={feature.id}
              className="hub-card"
              onClick={() => navigate(feature.route)}
              style={{ borderColor: `${feature.color}22` }}
            >
              <div className="hub-icon" style={{ background: `${feature.color}22`, color: '#0b1d3a' }}>
                {feature.icon}
              </div>
              <div className="hub-title">{feature.title}</div>
              <div className="hub-desc">{feature.description}</div>
              <div className="hub-tag" style={{ background: `${feature.color}22`, color: '#0b1d3a' }}>{feature.tag}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${feature.color}66`, borderRadius: '0 0 16px 16px' }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Relatorios;
