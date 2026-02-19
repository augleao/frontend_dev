import './AdminDashboard.css';
import {
  FaArchive,
  FaBalanceScale,
  FaBoxOpen,
  FaCalendarAlt,
  FaChartArea,
  FaChartBar,
  FaCloud,
  FaCog,
  FaKey,
  FaFileUpload,
  FaLayerGroup,
  FaMoneyBillWave,
  FaRobot,
  FaShareAlt,
  FaSignOutAlt,
  FaTachometerAlt,
  FaThumbsUp,
  FaUsers
} from 'react-icons/fa';
import ConfigurarServentia from './ConfigurarServentia';
import ConfigurarIA from './ConfigurarIA';
import { useMemo, useState, useEffect } from 'react';
import config from './config';
import { Link, useNavigate } from 'react-router-dom';
import { listDaps, getDapById } from './services/dapService';
import { SimpleLineChart as NasObLineChart, categories as nasObCategories } from './components/ia/HistoricoNasObModal';

const gradientVariants = {
  blue: 'btn-gradient-blue',
  green: 'btn-gradient-green',
  orange: 'btn-gradient-orange',
  red: 'btn-gradient-red'
};

const padMonthValue = (value) => String(value).padStart(2, '0');
const buildMonthKey = (year, month) => (!year || !month ? '' : `${year}-${padMonthValue(month)}`);
const getLastMonths = (months = 12) => {
  const today = new Date();
  const monthsArr = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    monthsArr.push({
      year,
      month,
      key: buildMonthKey(year, month),
      label: `${padMonthValue(month)}/${year}`,
      totals: nasObCategories.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {})
    });
  }
  return monthsArr;
};

const parseYearMonth = (dap) => {
  const anoCandidates = [dap?.ano_referencia, dap?.ano, dap?.ano_ref, dap?.anoReferencia, dap?.ano_referente];
  const mesCandidates = [dap?.mes_referencia, dap?.mes, dap?.mes_ref, dap?.mesReferencia, dap?.mes_referente];
  const anoVal = Number(anoCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
  const mesVal = Number(mesCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
  return { ano: anoVal, mes: mesVal };
};

const getFinalToken = (s) => {
  if (!s || typeof s !== 'string') return '';
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts[parts.length - 1].replace(/[^\p{L}\p{N}_-]+/gu, '');
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showConfigurar, setShowConfigurar] = useState(false);
  const [showConfigIA, setShowConfigIA] = useState(false);
  const [configModalFocus, setConfigModalFocus] = useState(null);
  const [configOpenAgents, setConfigOpenAgents] = useState(false);
  const [earning, setEarning] = useState(null);
  const [paidActsToday, setPaidActsToday] = useState(null);
  const [paidCertificatesToday, setPaidCertificatesToday] = useState(null);
  const [nasObHistory, setNasObHistory] = useState(() => getLastMonths(12));
  const [nasObLoading, setNasObLoading] = useState(false);
  const [nasObError, setNasObError] = useState('');
  const [usuarioLogado, setUsuarioLogado] = useState({ nome: '', email: '', cargo: '', serventia: '' });

  const getInitials = (nome) => {
    if (!nome) return 'US';
    return nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'US';
  };

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('usuario') || '{}');
      setUsuarioLogado({
        nome: stored?.nome || stored?.login || 'Usuário',
        email: stored?.email || stored?.login || 'email@dominio.com',
        cargo: stored?.cargo || 'Cargo não informado',
        serventia: stored?.serventia || stored?.serventia_nome || 'Serventia não informada'
      });
    } catch (e) {
      setUsuarioLogado({ nome: 'Usuário', email: 'email@dominio.com', cargo: 'Cargo não informado', serventia: 'Serventia não informada' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const monthsRange = 12;

    async function loadNasObHistory() {
      setNasObLoading(true);
      setNasObError('');
      setNasObHistory(getLastMonths(monthsRange));

      try {
        const listResp = await listDaps({});
        const items = Array.isArray(listResp?.items) ? listResp.items : [];

        let usuario = {};
        try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}'); } catch (_) { usuario = {}; }
        const userServentiaAbreviada = usuario?.serventia || usuario?.nome_abreviado || usuario?.nomeAbreviado || usuario?.serventiaNome || '';
        const userToken = String(getFinalToken(userServentiaAbreviada || usuario?.serventia || '')).toLowerCase();

        let filteredItems = items;
        if (userToken) {
          filteredItems = items.filter((dap) => {
            const servDisplay = dap?.serventia_nome ?? dap?.serventiaNome ?? dap?.serventia ?? dap?.nome_serventia ?? dap?.nomeServentia ?? '';
            const finalToken = String(getFinalToken(servDisplay || '')).toLowerCase();
            return finalToken && userToken.includes(finalToken);
          });
        }

        const monthsSet = new Set(getLastMonths(monthsRange).map((m) => m.key));
        const toFetch = filteredItems.filter((dap) => {
          const pm = parseYearMonth(dap);
          const key = buildMonthKey(pm.ano, pm.mes);
          return monthsSet.has(key);
        });

        const promises = toFetch.map((dap) =>
          getDapById(dap.id)
            .then((full) => ({ dap, full }))
            .catch((error) => ({ dap, error }))
        );

        promises.forEach((p) => {
          p.then((res) => {
            if (cancelled) return;
            if (res && res.full) {
              try {
                const full = res.full;
                const meta = res.dap || full;
                const pm = parseYearMonth(meta);
                const key = buildMonthKey(pm.ano, pm.mes);
                const periodos = full.periodos ?? full.dap_periodos ?? [];
                const counts = { nascimentosProprios: 0, nascimentosUI: 0, obitosProprios: 0, obitosUI: 0 };

                periodos.forEach((pItem) => {
                  const atos = pItem.atos ?? pItem.dap_atos ?? [];
                  atos.forEach((ato) => {
                    const code = String(ato.codigo ?? ato.codigo_ato ?? ato.ato_codigo ?? '').trim();
                    const tribRaw = ato.tributacao ?? ato.tributacao_codigo ?? ato.trib ?? ato.tributacao;
                    const tribNum = Number(tribRaw);
                    const qty = Number(ato.quantidade ?? ato.qtde ?? ato.qtd ?? 0) || 0;
                    if (code === '9101') {
                      if (tribNum === 26) counts.nascimentosProprios += qty;
                      if (tribNum === 29) counts.nascimentosUI += qty;
                    }
                    if (code === '9201') {
                      if (tribNum === 26) counts.obitosProprios += qty;
                      if (tribNum === 29) counts.obitosUI += qty;
                    }
                  });
                });

                setNasObHistory((prev) => {
                  const next = prev.map((m) => ({ ...m, totals: { ...m.totals } }));
                  const idx = next.findIndex((m) => m.key === key);
                  if (idx === -1) return next;
                  next[idx].totals.nascimentosProprios = (next[idx].totals.nascimentosProprios || 0) + counts.nascimentosProprios;
                  next[idx].totals.nascimentosUI = (next[idx].totals.nascimentosUI || 0) + counts.nascimentosUI;
                  next[idx].totals.obitosProprios = (next[idx].totals.obitosProprios || 0) + counts.obitosProprios;
                  next[idx].totals.obitosUI = (next[idx].totals.obitosUI || 0) + counts.obitosUI;
                  return next;
                });
              } catch (err) {
                console.error('[AdminDashboard] Erro processando DAP', { err, dap: res.dap });
              }
            } else if (res && res.error) {
              console.error('[AdminDashboard] Erro ao obter detalhes da DAP', { dap: res.dap, error: res.error });
            }
          }).catch((err) => console.error('[AdminDashboard] Promise erro DAP', err));
        });

        await Promise.allSettled(promises);
      } catch (error) {
        if (!cancelled) setNasObError('Não foi possível carregar histórico Nas/OB.');
      } finally {
        if (!cancelled) setNasObLoading(false);
      }
    }

    loadNasObHistory();
    return () => { cancelled = true; };
  }, []);

  const sidebarLinks = [
    { label: 'Visão Geral', icon: FaTachometerAlt, to: '/admin' },
    { label: 'Importar Atos', icon: FaFileUpload, to: '/admin/importar-atos' },
    { label: 'Versões TJMG', icon: FaLayerGroup, to: '/admin/atos-tabelas' },
    { label: 'Usuários', icon: FaUsers, to: '/admin/usuarios' },
    { label: 'Permissões de Usuários', icon: FaKey, to: '/admin/permissoes-usuarios' },
    { label: 'Atividades (tracker)', icon: FaChartArea, to: '/admin/tracker' },
    
    { label: 'Legislação', icon: FaBalanceScale, to: '/admin/legislacao' },
    { label: 'Backup', icon: FaArchive, to: '/admin/backup' },
    { label: 'OneDrive', icon: FaCloud, to: '/admin/onedrive' },
    { label: 'Backblaze B2', icon: FaCloud, to: '/admin/backblaze' },
    { label: 'Prompts IA', icon: FaRobot, to: '/admin/prompts-ia' }
  ];

  const kpiCards = [
    {
      label: 'Arrecadação hoje',
      value: earning == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(earning),
      caption: 'Atualizado há poucos instantes',
      icon: FaMoneyBillWave
    },
    {
      label: 'Atos pagos hoje',
      value: paidActsToday == null ? '—' : paidActsToday,
      caption: 'Somatório das quantidades de atos',
      icon: FaShareAlt
    },
    {
      label: 'Certidões pagas',
      value: paidCertificatesToday == null ? '—' : paidCertificatesToday,
      caption: 'Código 7802 na data de hoje',
      icon: FaThumbsUp
    }
  ];

  const nasObSummary = useMemo(
    () => nasObCategories.map((category) => ({
      ...category,
      total: nasObHistory.reduce((acc, entry) => acc + (entry.totals?.[category.id] ?? 0), 0)
    })),
    [nasObHistory]
  );

  const calendarMatrix = [
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
    [27, 28, 29, 30, null, null, null]
  ];

    const quickActions = [
    {
      label: 'Configurar Serventia',
      description: 'Atualize dados institucionais e branding.',
      icon: FaCog,
        variant: 'blue',
        onClick: () => { setShowConfigurar(true); setConfigModalFocus(null); setConfigOpenAgents(false); }
    },
    {
      label: 'Importar Atos',
      description: 'Suba novas tabelas 07/08 em minutos.',
      icon: FaFileUpload,
        to: '/admin/importar-atos',
        variant: 'orange'
    },
    {
      label: 'Versões TJMG',
      description: 'Selecione qual tabela de atos abastece o sistema.',
      icon: FaLayerGroup,
        to: '/admin/atos-tabelas',
        variant: 'blue'
    },
    {
      label: 'Backup Manual',
      description: 'Dispare uma cópia de segurança imediata.',
      icon: FaArchive,
        to: '/admin/backup',
        variant: 'red'
    },
    {
      label: 'Prompts IA',
      description: 'Edite assistentes e roteiros inteligentes.',
      icon: FaRobot,
        to: '/admin/prompts-ia',
        variant: 'green'
    }
    ,
    {
      label: 'Tipo de Caixa',
      description: 'Escolha o tipo de caixa para o sistema.',
      icon: FaMoneyBillWave,
      variant: 'green',
      onClick: () => { setShowConfigurar(true); setConfigModalFocus('caixa'); setConfigOpenAgents(false); }
    },
    {
      label: 'Agentes de IA',
      description: 'Gerencie agentes e permissões de IA.',
      icon: FaCog,
      variant: 'blue',
      onClick: () => { setShowConfigurar(true); setConfigModalFocus(null); setConfigOpenAgents(true); }
    },
    {
      label: 'Engine de IA',
      description: 'Configure o engine de IA padrão.',
      icon: FaRobot,
      variant: 'orange',
      onClick: () => setShowConfigIA(true)
    }
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="dashboard-root">
      <aside className="dashboard-sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            <span>{getInitials(usuarioLogado.nome)}</span>
          </div>
          <h2>{usuarioLogado.nome}</h2>
          <p>{usuarioLogado.email}</p>
          <p style={{ fontWeight: 600, color: '#cbd5e1' }}>
            {usuarioLogado.cargo} • {usuarioLogado.serventia}
          </p>
        </div>
        <nav className="sidebar-nav">
          {sidebarLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} className="sidebar-link">
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-logout">
          <button
            type="button"
            className="btn-gradient btn-gradient-red btn-block btn-compact sidebar-logout-btn"
            onClick={handleLogout}
          >
            <FaSignOutAlt size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-topbar">
      {/* Quick action buttons moved here (from dashboard-actions) */}
      <div className="top-quick-actions">
        {quickActions
          .filter((a) => ['Configurar Serventia', 'Importar Atos', 'Versões TJMG', 'Backup Manual', 'Prompts IA', 'Tipo de Caixa', 'Agentes de IA', 'Engine de IA'].includes(a.label))
          .map((action) => {
            const Icon = action.icon;
            const baseVariant = gradientVariants[action.variant] || gradientVariants.blue;
            const classes = `btn-gradient ${baseVariant} action-btn`;
            if (action.to) {
              return (
                <Link key={action.label} to={action.to} className={classes}>
                  <Icon size={16} />
                  <span style={{ display: 'inline-block', marginLeft: 8 }}>
                    <strong>{action.label}</strong>
                    <br />
                    <small style={{ display: 'block', fontWeight: 400 }}>{action.description}</small>
                  </span>
                </Link>
              );
            }
            return (
              <button
                type="button"
                key={action.label}
                className={classes}
                onClick={action.onClick}
              >
                <Icon size={16} />
                <span style={{ display: 'inline-block', marginLeft: 8 }}>
                  <strong>{action.label}</strong>
                  <br />
                  <small style={{ display: 'block', fontWeight: 400 }}>{action.description}</small>
                </span>
              </button>
            );
          })}
      </div>
        </div>

        <section className="dashboard-cards">
            {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="dashboard-card">
                <div className="card-icon">
                  <Icon size={18} />
                </div>
                <div className="card-info">
                  <span className="card-label">{card.label}</span>
                    <span className="card-value">{card.value}</span>
                  <span className="card-description">{card.caption}</span>
                </div>
              </div>
            );
          })}
        </section>

          {/* Fetch earning on mount */}
          <EarningFetcher
            setEarning={setEarning}
            setPaidActs={setPaidActsToday}
            setPaidCertificates={setPaidCertificatesToday}
          />

        <section className="chart-grid">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <strong>Histórico Nas/OB</strong>
                <span>Últimos 12 meses</span>
              </div>
              <button type="button" className="btn-gradient btn-gradient-green btn-pill btn-compact chart-pill" disabled>
                {nasObLoading ? 'Carregando' : 'Atualizado'}
              </button>
            </div>
            {nasObLoading ? (
              <p style={{ color: '#64748b', margin: '8px 0' }}>Carregando histórico...</p>
            ) : nasObError ? (
              <p style={{ color: '#b91c1c', margin: '8px 0' }}>{nasObError}</p>
            ) : (
              <>
                <div className="chart-area" style={{ background: '#0f172a', borderRadius: 12, padding: 12 }}>
                  <NasObLineChart data={nasObHistory} />
                </div>
                <div className="legend" style={{ flexWrap: 'wrap', gap: 12 }}>
                  {nasObCategories.map((category) => (
                    <span key={category.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '999px', background: category.color, display: 'inline-block' }} />
                      <span>{category.label}</span>
                    </span>
                  ))}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '999px', background: '#ef4444', display: 'inline-block' }} />
                    <span>Nasc.+Óbitos Próprios</span>
                  </span>
                </div>
                <div className="legend" style={{ flexWrap: 'wrap', gap: 12 }}>
                  {nasObSummary.map((entry) => (
                    <span key={`summary-${entry.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '999px', background: entry.color, display: 'inline-block' }} />
                      <span style={{ color: entry.color, fontWeight: 700 }}>{entry.total}</span>
                      <span style={{ color: '#475569' }}>{entry.label}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          
        </section>

        

        <section className="dashboard-actions">
          {quickActions
            .filter((a) => !['Configurar Serventia', 'Importar Atos', 'Versões TJMG', 'Backup Manual', 'Prompts IA', 'Tipo de Caixa', 'Agentes de IA', 'Engine de IA'].includes(a.label))
            .map((action) => {
            const Icon = action.icon;
            const baseVariant = gradientVariants[action.variant] || gradientVariants.blue;
            const classes = `btn-gradient ${baseVariant} action-btn`;
            if (action.to) {
              return (
                <Link key={action.label} to={action.to} className={classes}>
                  <Icon size={18} />
                  <span>
                    <strong>{action.label}</strong>
                    <br />
                    <span className="action-description">{action.description}</span>
                  </span>
                </Link>
              );
            }
            return (
              <button
                type="button"
                key={action.label}
                className={classes}
                onClick={action.onClick}
              >
                <Icon size={18} />
                <span>
                  <strong>{action.label}</strong>
                  <br />
                  <span className="action-description">{action.description}</span>
                </span>
              </button>
            );
          })}
        </section>
      </main>

      {showConfigurar && (
        <div className="dashboard-modal-overlay">
          <div className="dashboard-modal">
            <ConfigurarServentia onClose={() => { setShowConfigurar(false); setConfigModalFocus(null); setConfigOpenAgents(false); }} focusField={configModalFocus} openAgents={configOpenAgents} />
          </div>
        </div>
      )}

      {showConfigIA && (
        <div className="dashboard-modal-overlay">
          <div className="dashboard-modal">
            <ConfigurarIA onClose={() => setShowConfigIA(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function EarningFetcher({ setEarning, setPaidActs, setPaidCertificates }) {
  useEffect(() => {
    let mounted = true;
    async function fetchEarning() {
      try {
        const token = localStorage.getItem('token');
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        const serventia = usuario?.serventia;
        if (!token || !serventia) return;

        const headers = { Authorization: `Bearer ${token}` };

        // 1) Buscar todos os usuários e filtrar pela mesma serventia
        const resUsers = await fetch(`${config.apiURL}/users`, { headers });
        if (!resUsers.ok) return;
        const usersBody = await resUsers.json().catch(() => ({}));
        const usuarios = (usersBody.usuarios || usersBody || []).filter((u) => u?.serventia === serventia);

        const nomesUsuarios = (usuarios.length ? usuarios : [usuario]).map((u) => u.nome).filter(Boolean);
        if (!nomesUsuarios.length) return;

        const hoje = new Date();
        const dataHoje = hoje.toISOString().slice(0, 10);

        const normalizarLista = (dataAtos) => {
          if (Array.isArray(dataAtos)) return dataAtos;
          if (dataAtos?.atos && Array.isArray(dataAtos.atos)) return dataAtos.atos;
          if (dataAtos?.CaixaDiario && Array.isArray(dataAtos.CaixaDiario)) return dataAtos.CaixaDiario;
          return [];
        };

        const valorDoAto = (ato) => {
          const vDetalhe = ato?.detalhes_pagamentos?.valor_total;
          const vUnit = ato?.valor_unitario ?? ato?.valor_final;
          const bruto = vDetalhe ?? vUnit ?? 0;
          const n = Number(bruto);
          return Number.isFinite(n) ? n : 0;
        };

        const quantidadeDoAto = (ato) => {
          const q = Number(ato?.quantidade ?? 1);
          return Number.isFinite(q) && q > 0 ? q : 1;
        };

        const resAtos = await fetch(`${config.apiURL}/atos-praticados?data=${encodeURIComponent(dataHoje)}&_ts=${Date.now()}`, {
          headers,
          cache: 'no-store'
        });
        if (!resAtos.ok) return;
        const bodyAtos = await resAtos.json().catch(() => []);
        const listaAtos = normalizarLista(bodyAtos);

        const normalizarUsuario = (nome) => {
          if (!nome) return '';
          return String(nome)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, '')
            .trim();
        };

        const correspondeUsuario = (usuarioAto, usuarioRef) => {
          if (!usuarioAto || !usuarioRef) return false;
          if (usuarioAto === usuarioRef) return true;
          const a = normalizarUsuario(usuarioAto);
          const b = normalizarUsuario(usuarioRef);
          if (a === b) return true;
          const pa = a.split(/\s+/).filter(Boolean);
          const pb = b.split(/\s+/).filter(Boolean);
          if (pb.length === 1) return pa.includes(pb[0]);
          if (pa.length >= 2 && pb.length >= 2) {
            return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
          }
          return false;
        };

        const valores = nomesUsuarios.map((nome) => {
          const atosDoUsuario = listaAtos.filter((ato) => correspondeUsuario(ato?.usuario, nome));
          const totalValor = atosDoUsuario.reduce((acc, ato) => acc + valorDoAto(ato), 0);
          const totalQtd = atosDoUsuario.reduce((acc, ato) => acc + quantidadeDoAto(ato), 0);
          const totalCertidoes = atosDoUsuario
            .filter((ato) => String(ato?.codigo || '').trim() === '7802')
            .reduce((acc, ato) => acc + quantidadeDoAto(ato), 0);
          return { nome, totalValor, totalQtd, totalCertidoes };
        });

        const total = valores.reduce((acc, item) => acc + (Number.isFinite(item?.totalValor) ? item.totalValor : 0), 0);
        const totalAtos = valores.reduce((acc, item) => acc + (Number.isFinite(item?.totalQtd) ? item.totalQtd : 0), 0);
        const totalCertidoes = valores.reduce((acc, item) => acc + (Number.isFinite(item?.totalCertidoes) ? item.totalCertidoes : 0), 0);

        try {
          console.log('[AdminDashboard] Arrecadação hoje detalhada:', {
            data: dataHoje,
            serventia,
            porUsuario: valores,
            total,
            totalAtos,
            totalCertidoes
          });
        } catch (e) {
          // ignore
        }

        if (mounted) setEarning(total);
        if (mounted && setPaidActs) setPaidActs(totalAtos);
        if (mounted && setPaidCertificates) setPaidCertificates(totalCertidoes);
      } catch (e) {
        // ignore falhas silenciosamente
      }
    }

    fetchEarning();
    return () => { mounted = false; };
  }, [setEarning]);
  return null;
}