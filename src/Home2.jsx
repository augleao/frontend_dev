import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserComponents } from './services/PermissionsService';

function Home2() {
  const navigate = useNavigate();
  const [nomeUsuario, setNomeUsuario] = useState('Usuário');
  const [allowedSet, setAllowedSet] = useState(null); // null = não aplicado ainda
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    setNomeUsuario(usuario?.nome || 'Usuário');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPermissions() {
      setPermissionsLoading(true);
      try {
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        if (!usuario?.id) {
          if (!cancelled) setAllowedSet(null);
          return;
        }
        const data = await fetchUserComponents(usuario.id);
        const keys = new Set((data.components || []).filter((c) => c.allowed).map((c) => c.key));
        if (!cancelled) setAllowedSet(keys);
      } catch (e) {
        if (!cancelled) setAllowedSet(null);
      } finally {
        if (!cancelled) setPermissionsLoading(false);
      }
    }
    loadPermissions();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const hubsPrincipais = [
    {
      id: 'caixa-hub',
      title: 'Caixa',
      description: 'Registrar movimentos, fechar caixas e acompanhar saldo do dia.',
      icon: '💰',
      color: '#5ca9ff',
      route: '/caixa',
      tag: 'Financeiro',
      componentKey: 'dashboard.hub.caixa'
    },
    {
      id: 'manutencao-servicos',
      title: 'Pedidos',
      description: 'Ciclo completo do pedido: entrada, cliente, pagamento, execução e entrega.',
      icon: '📝',
      color: '#c9a646',
      route: '/lista-servicos',
      tag: 'Atendimento',
      componentKey: 'dashboard.hub.pedidos'
    },
    {
      id: 'atos-hub',
      title: 'Atos Praticados',
      description: 'Consulta, conciliação e gestão de atos praticados.',
      icon: '📜',
      color: '#3dd598',
      route: '/atos',
      tag: 'Relatórios',
      componentKey: 'dashboard.hub.atos'
    },
    {
      id: 'relatorios-hub',
      title: 'Relatórios',
      description: 'Painéis auxiliares e análises (DAP, atos, CNJ).',
      icon: '📈',
      color: '#7c8cff',
      route: '/relatorios',
      tag: 'Insights',
      componentKey: 'dashboard.hub.relatorios'
    },
    {
      id: 'relatorios-dap',
      title: 'DAP',
      description: 'Envio e retificação de DAP com rastreabilidade.',
      icon: '🧾',
      color: '#ffa96a',
      route: '/relatorios/dap',
      tag: 'Fiscal',
      componentKey: 'dashboard.hub.dap'
    }
  ];

  const hubsInteligentes = [
    {
      id: 'ferramentas-ia',
      title: 'Ferramentas de IA',
      description: 'Aberturas automatizadas, leitura de livros e assistentes de texto.',
      icon: '🤖',
      color: '#ffd166',
      route: '/ferramentas-ia',
      tag: 'IA',
      componentKey: 'dashboard.hub.ia'
    },
    {
      id: 'rg-module',
      title: 'RG (Carteira de Identidade)',
      description: 'Agenda, cobrança e emissão de RG.',
      icon: '🪪',
      color: '#6bc9ff',
      route: '/rg',
      tag: 'Identificação',
      componentKey: 'dashboard.hub.rg'
    }
  ];

  const atalhos = [
    { label: 'Pedidos', icon: '➡️', route: '/lista-servicos', componentKey: 'dashboard.hub.pedidos' },
    { label: 'Caixa', icon: '💰', route: '/caixa-diario', componentKey: 'dashboard.hub.caixa' },
    { label: 'Atos Pagos Praticados', icon: '📜', route: '/atos-praticados', componentKey: 'dashboard.hub.atos' },
    { label: 'Conciliação dos Pagos', icon: '🤝', route: '/conciliacao', componentKey: 'dashboard.hub.atos' },
    { label: 'Ferramentas IA', icon: '⚡', route: '/ferramentas-ia', componentKey: 'dashboard.hub.ia' }
  ];

  const roadmap = [
    { title: 'Backup Automático', icon: '💾', description: 'Instantâneo diário com retenção segura.' },
    { title: 'Auditoria Expandida', icon: '🔍', description: 'Trilhas mais detalhadas por usuário e ato.' },
    { title: 'Integrações API', icon: '🔗', description: 'Conectores adicionais para plataformas externas.' }
  ];

  const filterByPermission = (items) => {
    if (!allowedSet || allowedSet.size === 0) return items;
    return items.filter((item) => !item.componentKey || allowedSet.has(item.componentKey));
  };

  const hubsPrincipaisFiltered = filterByPermission(hubsPrincipais);
  const hubsInteligentesFiltered = filterByPermission(hubsInteligentes);
  const atalhosFiltrados = filterByPermission(atalhos);

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

        .home2-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 48px;
          position: relative;
          z-index: 2;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--white);
          font-weight: 800;
          letter-spacing: 0.4px;
        }

        .brand-mark {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(92,169,255,0.35), rgba(201,166,70,0.5));
          display: grid;
          place-items: center;
          color: var(--white);
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.25);
        }

        .home2-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.18);
          color: var(--white);
          font-weight: 700;
          font-size: 13px;
        }

        .btn {
          border: none;
          border-radius: 12px;
          padding: 11px 16px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn:active { transform: translateY(1px); }

        .btn-outline {
          background: transparent;
          color: var(--white);
          border: 1.5px solid rgba(255,255,255,0.5);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }

        .btn-outline:hover {
          border-color: var(--blue-cta);
          color: var(--blue-cta);
          background: rgba(255,255,255,0.06);
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

        .hero-panel {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 22px;
          padding: 26px;
          display: grid;
          grid-template-columns: 1.2fr 0.9fr;
          gap: 20px;
          align-items: center;
          box-shadow: 0 18px 48px rgba(0,0,0,0.26);
        }

        .hero-copy {
          color: var(--white);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hero-title {
          font-size: clamp(28px, 3.6vw, 40px);
          font-weight: 800;
          line-height: 1.1;
        }

        .hero-sub {
          color: rgba(255,255,255,0.88);
          line-height: 1.5;
          font-size: 16px;
        }

        .hero-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }

        .hero-chip {
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.14);
          color: var(--white);
          font-weight: 700;
          font-size: 13px;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }

        .mini-panel {
          background: var(--white);
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 14px 32px rgba(0,0,0,0.16);
          border: 1px solid rgba(16,41,78,0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mini-title {
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

