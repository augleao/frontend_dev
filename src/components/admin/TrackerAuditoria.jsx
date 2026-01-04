import React, { useEffect, useMemo, useState } from 'react';
import config from '../../config';

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR');
}

function truncate(str, len = 24) {
  if (!str) return '-';
  const s = String(str);
  if (s.length <= len) return s;
  return s.slice(0, len) + '…';
}

export default function TrackerAuditoria() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ event: '', uid: '', path: '', from: '', to: '' });
  const [expanded, setExpanded] = useState({});
  const [users, setUsers] = useState([]);
  const [purging, setPurging] = useState(false);
  const [activeCard, setActiveCard] = useState({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.event) params.append('event', filters.event);
    if (filters.uid) params.append('uid', filters.uid);
    if (filters.path) params.append('path', filters.path);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.userId) params.append('userId', filters.userId);
    params.append('limit', '200');
    return params.toString();
  }, [filters]);

  const stats = useMemo(() => {
    const total = rows.length;
    const uniqueUsers = new Set(rows.map((r) => r.user_name || r.hashed_uid || (r.data && r.data.uid))).size;
    const byEvent = rows.reduce((acc, r) => {
      const k = r.event || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    return { total, uniqueUsers, byEvent };
  }, [rows]);

  const groupedByUser = useMemo(() => {
    const groups = {};
    rows.forEach((row) => {
      const user = row.user_name || row.hashed_uid || (row.data && row.data.uid) || 'Anônimo';
      if (!groups[user]) groups[user] = [];
      groups[user].push(row);
    });
    // Sort within each user: newest first (DESC)
    Object.keys(groups).forEach((user) => {
      groups[user].sort((a, b) => new Date(b.ts || b.created_at) - new Date(a.ts || a.created_at));
    });
    // Initialize activeCard with first (newest) card of each user
    const initActive = {};
    Object.keys(groups).forEach((user) => {
      if (groups[user].length > 0) {
        initActive[user] = groups[user][0].id;
      }
    });
    if (Object.keys(initActive).length > 0) {
      setActiveCard((prev) => {
        const merged = { ...initActive, ...prev };
        return merged;
      });
    }
    return groups;
  }, [rows]);

  const palette = {
    login: '#10b981',
    pageview: '#3b82f6',
    click: '#f97316',
    error: '#ef4444',
    default: '#6366f1'
  };

  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/tracker/events?${queryString}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status} ${body}`);
        }
        const data = await res.json();
        if (!aborted) setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch (e) {
        if (!aborted) setError(e && e.message ? e.message : 'Erro ao carregar');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, [queryString]);

  // load users for dropdown
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`${config.apiURL}/tracker/users`, { credentials: 'include' });
        if (!res.ok) throw new Error('Falha ao carregar usuários');
        const data = await res.json();
        if (!aborted) setUsers(Array.isArray(data.rows) ? data.rows : []);
      } catch (e) {
        if (!aborted) setUsers([]);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  async function purgeAll() {
    if (purging) return;
    const sure = window.confirm('Excluir todos os registros de tracker? Esta ação não pode ser desfeita.');
    if (!sure) return;
    setPurging(true);
    setError('');
    try {
      const res = await fetch(`${config.apiURL}/tracker/events`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Falha ao excluir');
      }
      await res.json();
      // reload: bump a filter change to refetch immediately
      setFilters((f) => ({ ...f }));
      // also refresh data by calling load again via changing queryString dependency
      setRows([]);
    } catch (e) {
      setError(e && e.message ? e.message : 'Erro ao excluir');
    } finally {
      setPurging(false);
    }
  }

  return (
    <div style={pageStyle}>
      <h2 style={titleStyle}>Atividades dos colaboradores</h2>
      <p style={subtitleStyle}>Eventos coletados pelo tracker. Ajuste filtros e explore rapidamente.</p>

      <div style={statsGrid}>
        <StatCard label="Eventos" value={stats.total} accent="#3b82f6" />
        <StatCard label="Usuários únicos" value={stats.uniqueUsers} accent="#10b981" />
        <StatCard label="Logins" value={stats.byEvent.login || 0} accent="#f97316" />
        <StatCard label="Pageviews" value={stats.byEvent.pageview || 0} accent="#6366f1" />
      </div>

      <div style={filtersGrid}>
        <input
          placeholder="Evento (ex: login, pageview)"
          value={filters.event}
          onChange={(e) => setFilters((f) => ({ ...f, event: e.target.value }))}
          style={inputStyle}
        />
        <input
          placeholder="UID ou hash"
          value={filters.uid}
          onChange={(e) => setFilters((f) => ({ ...f, uid: e.target.value }))}
          style={inputStyle}
        />
        <input
          placeholder="Path contém..."
          value={filters.path}
          onChange={(e) => setFilters((f) => ({ ...f, path: e.target.value }))}
          style={inputStyle}
        />
        <select
          value={filters.userId || ''}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value || undefined }))}
          style={inputStyle}
        >
          <option value="">Todos os usuários</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          style={inputStyle}
        />
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => setFilters({ event: '', uid: '', path: '', from: '', to: '' })}
          style={ghostButton}
        >
          Limpar filtros
        </button>
        <button
          type="button"
          onClick={purgeAll}
          disabled={purging}
          style={{ ...ghostButton, borderColor: '#dc2626', color: '#dc2626' }}
        >
          {purging ? 'Excluindo...' : 'Excluir tudo'}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {loading && <div style={infoStyle}>Carregando…</div>}

      {!loading && rows.length === 0 && <div style={infoStyle}>Nenhum evento encontrado.</div>}

      <div style={cardsWrap}>
        {Object.entries(groupedByUser).map(([userName, userRows]) => {
          const currentActive = activeCard[userName];
          const sortedCards = [...userRows];
          return (
            <div key={userName} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: 12 }}>
                {userName} ({sortedCards.length})
              </div>
              <div style={stackContainer}>
                {sortedCards.map((row, idx) => {
                  const isActive = row.id === currentActive;
                  const color = palette[row.event] || palette.default;
                  const isOpen = expanded[row.id];
                  const dataStr = row.data ? JSON.stringify(row.data, null, 2) : '-';
                  return (
                    <div
                      key={row.id}
                      style={{
                        ...card,
                        borderColor: color,
                        position: 'absolute',
                        width: 340,
                        transform: `translateX(${idx * 48}px) translateY(${idx * 2}px) ${isActive ? 'scale(1)' : 'scale(0.96)'}`,
                        zIndex: isActive ? 999 : sortedCards.length - idx,
                        opacity: isActive ? 1 : 0.75,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onClick={() => setActiveCard((prev) => ({ ...prev, [userName]: isActive ? null : row.id }))}
                      role="button"
                      tabIndex={0}
                    >
                      <div style={cardTop}>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{row.user_name || '—'}</div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ ...pill, background: color, color: '#fff' }}>{row.event || 'evento'}</span>
                          {row.event === 'pageview' && (
                            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: 4 }}>{truncate(row.path, 28)}</div>
                          )}
                          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: row.event === 'pageview' ? 2 : 6 }}>
                            {row.ts ? new Date(row.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                        </div>
                      </div>

                      {isActive && (
                        <>
                          <div style={{ fontSize: '13px', color: '#6b7280', borderTop: '1px solid #f1f5f9', paddingTop: 8, marginBottom: 10 }}>
                            <div style={{ marginBottom: 6 }}><strong>Path:</strong> {row.path || '-'}</div>
                            <div style={{ marginBottom: 6 }}><strong>Data:</strong> {formatDate(row.ts || row.created_at)}</div>
                            <div style={{ marginBottom: 6 }}><strong>UID:</strong> {truncate(row.hashed_uid || (row.data && row.data.uid))}</div>
                            <div><strong>IP:</strong> {row.ip || '-'}</div>
                          </div>
                          <div style={rowLine}>UA: <span style={{ color: '#111827' }}>{truncate(row.ua, 120)}</span></div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded((m) => ({ ...m, [row.id]: !isOpen }));
                            }}
                            style={expandBtn}
                          >
                            {isOpen ? 'Esconder dados' : 'Ver dados'}
                          </button>

                          {isOpen && (
                            <pre style={jsonBox}>{dataStr}</pre>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...statCard, borderColor: accent }}>
      <div style={{ color: '#6b7280', fontSize: '13px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ width: '100%', height: 4, background: `${accent}33`, borderRadius: 999, marginTop: 8 }}>
        <div style={{ width: '100%', height: '100%', background: accent, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const pageStyle = { padding: '24px', fontFamily: '"Manrope", "Segoe UI", sans-serif', background: '#f8fafc' };
const titleStyle = { marginBottom: '4px', color: '#0f172a' };
const subtitleStyle = { marginTop: 0, marginBottom: '20px', color: '#475569' };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: 16 };
const filtersGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' };
const inputStyle = { padding: '10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' };
const ghostButton = { padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f8fafc', cursor: 'pointer' };
const errorStyle = { color: '#dc2626', marginBottom: '12px' };
const infoStyle = { color: '#475569', marginBottom: '12px' };
const cardsWrap = { display: 'flex', flexDirection: 'column', gap: '24px' };
const stackContainer = { position: 'relative', height: 320, minHeight: 320 };
const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', display: 'flex', flexDirection: 'column', gap: 10 };
const cardTop = { display: 'flex', justifyContent: 'space-between', gap: 12 };
const pill = { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: '12px', fontWeight: 700, letterSpacing: '0.3px' };
const rowLine = { fontSize: '13px', color: '#6b7280', borderTop: '1px solid #f1f5f9', paddingTop: 8 };
const expandBtn = { alignSelf: 'flex-start', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '13px' };
const jsonBox = { background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, fontSize: '12px', maxHeight: 240, overflow: 'auto' };
const statCard = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, boxShadow: '0 8px 16px rgba(15, 23, 42, 0.04)' };
