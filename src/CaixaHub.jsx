import './home2.css';

function CaixaHub() {
  const navigate = useNavigate();

  const featureCards = [
    {
      id: 'caixa-diario',
      title: 'Movimento diário do caixa',
      description: 'Registre atos e pagamentos do movimento diário do caixa',
      icon: '💰',
      color: '#5ca9ff',
      route: '/caixa-diario'
    },
    {
      id: 'meus-fechamentos',
      title: 'Caixas fechados',
      description: 'Visualize seus fechamentos de caixa',
      icon: '📦',
      color: '#c9a646',
      route: '/meus-fechamentos'
    }
  ];

  return (
    <div className="home2-shell">
      <div className="home2-watermark" />

      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Gerencie o Caixa</div>
            <div className="hero-sub">Acesse o movimento diário e acompanhe fechamentos com segurança e rastreabilidade.</div>
            <div className="hero-chips">
              <span className="hero-chip">Movimento diário</span>
              <span className="hero-chip">Fechamentos</span>
              <span className="hero-chip">Relatórios</span>
            </div>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/caixa-diario')}>Abrir movimento diário</button>
              <button className="btn btn-outline" onClick={() => navigate('/meus-fechamentos')}>Ver fechamentos</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos diretos</span>
              <span style={{ color: '#6b7280', fontWeight: 700 }}>Tudo em 1 clique</span>
            </div>
            <div className="quick-links">
              {featureCards.map((f) => (
                <div key={f.id} className="quick-link" onClick={() => navigate(f.route)}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <span>{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section>
          <div className="section-head">
            <div className="section-title">Operações de caixa</div>
            <div className="section-sub">Movimento diário e fechamentos rápidos</div>
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
                <div className="hub-tag" style={{ background: `${feature.color}22`, color: '#0b1d3a' }}>Caixa</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${feature.color}66`, borderRadius: '0 0 16px 16px' }} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default CaixaHub;
