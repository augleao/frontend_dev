import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserComponents } from './services/PermissionsService';
import './home2.css';

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
    ,
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

  // If allowedSet is null: permissions not loaded -> show all. If loaded (even empty), enforce.
  const filterByPermission = (items) => {
    if (allowedSet === null) return items;
    return items.filter((item) => !item.componentKey || allowedSet.has(item.componentKey));
  };

  const hubsPrincipaisFiltered = filterByPermission(hubsPrincipais);
  const hubsInteligentesFiltered = filterByPermission(hubsInteligentes);
  const atalhosFiltrados = filterByPermission(atalhos);

  return (
    <div className="home2-shell">

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
                className={`hub-card ${hub.id === 'caixa-hub' ? 'hub-card--caixa' : ''}`}
                onClick={() => navigate(hub.route)}
                style={{ borderColor: `${hub.color}22` }}
              >
                <div className={`hub-icon ${hub.id === 'caixa-hub' ? 'hub-icon--caixa' : ''}`} style={{ background: `${hub.color}22`, color: '#0b1d3a' }}>
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

