import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserComponents } from './services/PermissionsService';
import './styles/home2.css';

function Home2() {
  const navigate = useNavigate();
  const [nomeUsuario, setNomeUsuario] = useState('Usuário');
  const [allowedSet, setAllowedSet] = useState(null); // null = não aplicado ainda
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  return (
    <div className="home2-shell">
          font-weight: 800;
          color: var(--navy);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .quick-links {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 8px;
        }

        .quick-link {
          background: linear-gradient(145deg, #ffffff, #f7f9fb);
          border: 1px solid rgba(16,41,78,0.06);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: var(--navy);
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .quick-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.12);
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          color: var(--white);
          padding: 4px 4px 0;
        }

        .section-title {
          font-size: 20px;
          font-weight: 800;
        }

        .section-sub {
          font-size: 14px;
          opacity: 0.85;
        }

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

        .hub-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 46px rgba(0,0,0,0.15);
        }

        .hub-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 22px;
          font-weight: 800;
          color: var(--navy);
          background: rgba(16,41,78,0.08);
        }

        .hub-title {
          font-size: 16px;
          font-weight: 800;
          color: var(--navy);
        }

        .hub-desc {
          color: var(--text-soft);
          font-size: 14px;
          line-height: 1.4;
        }

        .hub-tag {
          align-self: flex-start;
          padding: 6px 10px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 12px;
          background: rgba(16,41,78,0.08);
          color: var(--navy);
        }

        .roadmap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
          margin-top: 10px;
        }

        .roadmap-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 16px;
          padding: 14px;
          border: 1px dashed #d1d5db;
          color: #4b5563;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .roadmap-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(16,41,78,0.08);
          display: grid;
          place-items: center;
          font-size: 20px;
        }

        @media (max-width: 1024px) {
          .home2-nav { padding: 16px 20px; flex-wrap: wrap; gap: 10px; }
          .hero-panel { grid-template-columns: 1fr; padding: 20px; }
          .home2-main { padding: 24px 20px 46px; }
        }

        @media (max-width: 640px) {
          .home2-actions { width: 100%; justify-content: flex-start; }
          .hero-title { font-size: 24px; }
          .hero-panel { gap: 16px; }
        }
      `}</style>

      <div className="home2-watermark" />



      <main className="home2-main">
        <div className="hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Navegue pelas ferramentas de gestão.</div>
            <div className="hero-sub">
              Controle de caixa, pedidos, atos praticados, relatórios e IA, tudo a um clique.
            </div>
            <div className="hero-chips">
              <span className="hero-chip">Fluxo diário</span>
              <span className="hero-chip">Monitoramento em tempo real</span>
              <span className="hero-chip">Segurança e trilhas</span>
            </div>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/lista-servicos')}>Abrir pedidos</button>
              <button className="btn btn-outline" onClick={() => navigate('/caixa')}>Ir para caixa</button>
              <button className="btn btn-outline" onClick={() => navigate('/ferramentas-ia')}>Usar IA</button>
            </div>
          </div>

          <div className="mini-panel">
            <div className="mini-title">
              <span>Atalhos diretos</span>
              <span style={{ color: '#6b7280', fontWeight: 700 }}>Tudo em 1 clique</span>
            </div>
            <div className="quick-links">
              {atalhosFiltrados.map((item) => (
                <div key={item.route} className="quick-link" onClick={() => navigate(item.route)}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section>
          <div className="section-head">
            <div className="section-title">Hubs principais</div>
            <div className="section-sub">Operações do dia, finanças e relatórios</div>
          </div>
          <div className="cards-grid">
            {hubsPrincipaisFiltered.map((hub) => (
              <div
                key={hub.id}
                className="hub-card"
                onClick={() => navigate(hub.route)}
                style={{ borderColor: `${hub.color}22` }}
              >
                <div className="hub-icon" style={{ background: `${hub.color}22`, color: '#0b1d3a' }}>
                  {hub.icon}
                </div>
                <div className="hub-title">{hub.title}</div>
                <div className="hub-desc">{hub.description}</div>
                <div className="hub-tag" style={{ background: `${hub.color}22`, color: '#0b1d3a' }}>{hub.tag}</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${hub.color}66`, borderRadius: '0 0 16px 16px' }} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <div className="section-title">IA, Identificação e integrações</div>
            <div className="section-sub">Ferramentas inteligentes e módulos dedicados</div>
          </div>
          <div className="cards-grid">
            {hubsInteligentesFiltered.map((hub) => (
              <div
                key={hub.id}
                className="hub-card"
                onClick={() => navigate(hub.route)}
                style={{ borderColor: `${hub.color}22` }}
              >
                <div className="hub-icon" style={{ background: `${hub.color}22`, color: '#0b1d3a' }}>
                  {hub.icon}
                </div>
                <div className="hub-title">{hub.title}</div>
                <div className="hub-desc">{hub.description}</div>
                <div className="hub-tag" style={{ background: `${hub.color}22`, color: '#0b1d3a' }}>{hub.tag}</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `${hub.color}66`, borderRadius: '0 0 16px 16px' }} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <div className="section-title">Roadmap e novidades</div>
            <div className="section-sub">Próximos hubs e integrações em desenvolvimento</div>
          </div>
          <div className="roadmap-grid">
            {roadmap.map((item) => (
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

export default Home2;

