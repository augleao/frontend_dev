import React from 'react';
import { useNavigate } from 'react-router-dom';
import './home2.css';

function FerramentasIA() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'assistente-preenchimento',
      title: 'Assistente de Mandados',
      description: 'Analise mandados e gere averbações decorrentes automaticamente.',
      icon: '🧠',
      color: '#f1c40f',
      route: '/ferramentas-ia/assistente-mandados',
      tag: 'Assistente',
    },
    {
      id: 'analise-documentos',
      title: 'Leitura de Livros',
      description: 'Extração automática de dados manuscritos a partir de imagens.',
      icon: '📄',
      color: '#f39c12',
      route: '/ferramentas-ia/leitura-livros',
      tag: 'OCR',
    },
    {
      id: 'analise-dap',
      title: 'Análise de DAP',
      description: 'Análises inteligentes das DAPs da serventia.',
      icon: '📊',
      color: '#9b59b6',
      route: '/ferramentas-ia/analise-dap',
      tag: 'DAP',
    },
    {
      id: 'consulta-provimentos',
      title: 'Consulta Provimentos',
      description: 'Perguntas fundamentadas nos provimentos 149/2023 (CNJ) e 93/2020 (TJMG).',
      icon: '⚖️',
      color: '#10b981',
      route: '/ferramentas-ia/consulta-provimentos',
      tag: 'Normas',
    },
  ];

  const futureFeatures = [
    { title: 'Resumos Automáticos', description: 'Gere resumos de documentos longos.', icon: '📝' },
    { title: 'Tradução Contextual', description: 'Tradução com preservação de termos jurídicos.', icon: '🌐' },
    { title: 'Busca Semântica', description: 'Pesquisa inteligente em registros e PDFs.', icon: '🔎' },
  ];

  const quickLinks = [
    { label: 'Assistente Mandados', icon: '🧠', route: '/ferramentas-ia/assistente-mandados' },
    { label: 'Leitura de Livros', icon: '📄', route: '/ferramentas-ia/leitura-livros' },
    { label: 'Análise DAP', icon: '📊', route: '/ferramentas-ia/analise-dap' },
    { label: 'Consulta Provimentos', icon: '⚖️', route: '/ferramentas-ia/consulta-provimentos' },
  ];

  return (
    <div className="home2-shell">
      <div className="home2-watermark" />

      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Ferramentas de IA</div>
            <div className="hero-sub">Assistentes, leitura de livros e análises automáticas em um só lugar.</div>
            <div className="hero-chips">
              <span className="hero-chip">Assistentes</span>
              <span className="hero-chip">OCR</span>
              <span className="hero-chip">DAP</span>
            </div>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/ferramentas-ia/assistente-mandados')}>Abrir Assistente</button>
              <button className="btn btn-outline" onClick={() => navigate('/ferramentas-ia/leitura-livros')}>Leitura de Livros</button>
              <button className="btn btn-outline" onClick={() => navigate('/ferramentas-ia/analise-dap')}>Análise DAP</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos IA</span>
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

        <section>
          <div className="section-head">
            <div className="section-title">Próximas funcionalidades</div>
            <div className="section-sub">Itens em exploração/roadmap</div>
          </div>
          <div className="roadmap-grid">
            {futureFeatures.map((item) => (
              <div key={item.title} className="roadmap-card">
                <div className="roadmap-icon">{item.icon}</div>
                <div>
                  <div style={{ fontWeight: 800, color: '#111827', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.4 }}>{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default FerramentasIA;
