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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.event) params.append('event', filters.event);
    if (filters.uid) params.append('uid', filters.uid);
    if (filters.path) params.append('path', filters.path);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    params.append('limit', '200');
    return params.toString();
  }, [filters]);

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

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '12px' }}>Atividades dos colaboradores</h2>
      <p style={{ marginTop: 0, marginBottom: '16px', color: '#555' }}>
        Eventos coletados pelo tracker (cookies/UID). Ajuste filtros para refinar resultados. Limite: 200.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <input
          placeholder="Evento (ex: login, pageview)"
          value={filters.event}
          onChange={(e) => setFilters((f) => ({ ...f, event: e.target.value }))}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <input
          placeholder="UID ou hash"
          value={filters.uid}
          onChange={(e) => setFilters((f) => ({ ...f, uid: e.target.value }))}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <input
          placeholder="Path contém..."
          value={filters.path}
          onChange={(e) => setFilters((f) => ({ ...f, path: e.target.value }))}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          type="button"
          onClick={() => setFilters({ event: '', uid: '', path: '', from: '', to: '' })}
          style={{ padding: '10px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer' }}
        >
          Limpar filtros
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '12px' }}>{error}</div>}
      {loading && <div style={{ marginBottom: '12px' }}>Carregando…</div>}

      <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              <th style={thStyle}>TS</th>
              <th style={thStyle}>Evento</th>
              <th style={thStyle}>Path</th>
              <th style={thStyle}>Usuário</th>
              <th style={thStyle}>UID (hash)</th>
              <th style={thStyle}>Data (JSON)</th>
              <th style={thStyle}>IP</th>
              <th style={thStyle}>UA</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: '#777' }}>
                  Nenhum evento encontrado.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={tdStyle}>{formatDate(row.ts || row.created_at)}</td>
                <td style={tdStyle}>{row.event || '-'}</td>
                <td style={tdStyle}>{row.path || '-'}</td>
                <td style={tdStyle}>{row.user_name || '-'}</td>
                <td style={tdStyle}>{truncate(row.hashed_uid || (row.data && row.data.uid))}</td>
                <td style={{ ...tdStyle, maxWidth: 520 }}>
                  <code style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{row.data ? JSON.stringify(row.data) : '-'}</code>
                </td>
                <td style={tdStyle}>{row.ip || '-'}</td>
                <td style={{ ...tdStyle, maxWidth: 240 }}>{truncate(row.ua, 60)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '10px', borderBottom: '1px solid #eee', fontWeight: 600 };
const tdStyle = { padding: '10px', verticalAlign: 'top' };
