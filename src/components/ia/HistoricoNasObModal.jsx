import React, { useEffect, useMemo, useState } from 'react';
import { listDaps, getDapById } from '../../services/dapService';

const categories = [
  {
    id: 'nascimentosProprios',
    label: 'Registros de Nascimento Próprios (9101, trib 26)',
    color: '#f97316',
  },
  {
    id: 'nascimentosUI',
    label: 'Registros de Nascimento UI (9101, trib 29)',
    color: '#2563eb',
  },
  {
    id: 'obitosProprios',
    label: 'Registros de Óbito Próprios (9201, trib 26)',
    color: '#16a34a',
  },
  {
    id: 'obitosUI',
    label: 'Registros de Óbito UI (9201, trib 29)',
    color: '#c026d3',
  },
];

function padMonthValue(value) {
  return String(value).padStart(2, '0');
}

function buildMonthKey(year, month) {
  if (!year || !month) return '';
  return `${year}-${padMonthValue(month)}`;
}

function getLast12Months() {
  const today = new Date();
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const cursor = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    months.push({
      year,
      month,
      key: buildMonthKey(year, month),
      label: `${padMonthValue(month)}/${year}`,
    });
  }
  return months;
}

function buildEmptyHistory() {
  return getLast12Months().map((month) => ({
    ...month,
    totals: categories.reduce((acc, category) => ({
      ...acc,
      [category.id]: 0,
    }), {}),
  }));
}

function normalizeMonthPayload(month = {}) {
  const normalizedYear = Number(month.year);
  const normalizedMonth = Number(month.month);
  const hasYear = Number.isFinite(normalizedYear);
  const hasMonth = Number.isFinite(normalizedMonth);
  const totals = categories.reduce((acc, category) => ({
    ...acc,
    [category.id]: Number(month.totals?.[category.id]) || 0,
  }), {});
  return {
    key: month.key || (hasYear && hasMonth ? buildMonthKey(normalizedYear, normalizedMonth) : ''),
    label: month.label || (hasMonth && hasYear ? `${padMonthValue(normalizedMonth)}/${normalizedYear}` : '—'),
    year: hasYear ? normalizedYear : null,
    month: hasMonth ? normalizedMonth : null,
    totals,
  };
}

function SimpleLineChart({ data = [] }) {
  const [hover, setHover] = useState(null);
  if (!Array.isArray(data) || data.length === 0) return null;
  const width = 720;
  const height = 260;
  const padding = 40;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const maxValue = Math.max(...data.flatMap((entry) => categories.map((category) => entry.totals[category.id] ?? 0)));
  const safeMax = Math.max(maxValue, 1);
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  

  const seriesPaths = categories.map((category) => {
    const points = data.map((entry, index) => {
      const value = entry.totals[category.id] ?? 0;
      const x = padding + (data.length === 1 ? plotWidth / 2 : xStep * index);
      const y = padding + plotHeight - (value / safeMax) * plotHeight;
      return { x, y };
    });
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    return { ...category, path, points };
  });

  const horizontalLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padding + plotHeight - ratio * plotHeight;
    const value = Math.round(safeMax * ratio);
    return { y, value };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Histórico mensal de registros de nascimento e óbito"
      style={{ width: '100%', height: 'auto' }}
    >
      <rect x={padding} y={padding} width={plotWidth} height={plotHeight} fill="#0f172a" rx={12} />
      {horizontalLines.map((line) => (
        <g key={line.y}>
          <line
            x1={padding}
            x2={padding + plotWidth}
            y1={line.y}
            y2={line.y}
            stroke="rgba(148, 163, 184, 0.5)"
            strokeDasharray="4 6"
          />
          <text x={padding - 10} y={line.y + 4} textAnchor="end" fill="white" fontSize={10}>
            {line.value}
          </text>
        </g>
      ))}
      {seriesPaths.map((series) => (
        <g key={series.id}>
          <path d={series.path} fill="none" stroke={series.color} strokeWidth={2} strokeLinecap="round" />
          {series.points.map((pt, idx) => (
            <circle
              key={`pt-${series.id}-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={series.color}
              stroke="#fff"
              strokeWidth={1}
              onMouseEnter={() => setHover({ x: pt.x, y: pt.y, value: data[idx].totals[series.id] ?? 0, label: data[idx].label, color: series.color })}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
      ))}
      {data.map((entry, index) => {
        const x = padding + (data.length === 1 ? plotWidth / 2 : xStep * index);
        return (
          <text key={`axis-${entry.key}`} x={x} y={height - 12} fontSize={10} fill="#e2e8f0" textAnchor="middle">
            {entry.label}
          </text>
        );
      })}
      {hover && (
        <g pointerEvents="none">
          <rect
            x={Math.max(padding, Math.min( width - padding - 80, hover.x - 40 ))}
            y={hover.y - 36}
            width={80}
            height={28}
            rx={6}
            fill="#ffffff"
            stroke="#0f172a"
          />
          <text x={Math.max(padding + 8, Math.min( width - padding - 16, hover.x ))} y={hover.y - 16} fontSize={12} fill="#0f172a" textAnchor="middle" fontWeight={700}>
            {String(hover.value)}
          </text>
        </g>
      )}
    </svg>
  );
}

export default function HistoricoNasObModal({ open, onClose }) {
  const [historico, setHistorico] = useState(buildEmptyHistory);
  const [monthsRange, setMonthsRange] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setHistorico(() => {
      // build months array according to monthsRange
      const today = new Date();
      const months = [];
      for (let offset = monthsRange - 1; offset >= 0; offset -= 1) {
        const cursor = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1, key: buildMonthKey(cursor.getFullYear(), cursor.getMonth() + 1), label: `${padMonthValue(cursor.getMonth() + 1)}/${cursor.getFullYear()}`, totals: categories.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {}) });
      }
      return months;
    });

    (async () => {
      try {
        // 1) get DAP list and filter by months we need
        const listResp = await listDaps({});
        const items = Array.isArray(listResp.items) ? listResp.items : [];
        console.log('[HistoricoNasObModal] listDaps result', { total: items.length, sample: items.slice(0, 5), rawMeta: listResp.meta });
        // Filter by current user's serventia (same approach used in AnaliseDAP)
        let usuario = {};
        try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}'); } catch (_) { usuario = {}; }
        const userServentiaAbreviada = usuario?.serventia || usuario?.nome_abreviado || usuario?.nomeAbreviado || usuario?.serventiaNome || '';
        const getFinalToken = (s) => {
          if (!s || typeof s !== 'string') return '';
          const parts = s.trim().split(/\s+/).filter(Boolean);
          if (parts.length === 0) return '';
          return parts[parts.length - 1].replace(/[^\p{L}\p{N}_-]+/gu, '');
        };
        const userToken = String(getFinalToken(userServentiaAbreviada || usuario?.serventia || '')).toLowerCase();
        let filteredItems = items;
        if (userToken) {
          filteredItems = items.filter((dap) => {
            const servDisplay = dap?.serventia_nome ?? dap?.serventiaNome ?? dap?.serventia ?? dap?.nome_serventia ?? dap?.nomeServentia ?? '';
            const finalToken = String(getFinalToken(servDisplay || '')).toLowerCase();
            return finalToken && userToken.includes(finalToken);
          });
          console.log('[HistoricoNasObModal] filtered DAPs by serventia', { userToken, before: items.length, after: filteredItems.length });
        }
        // helper to parse year/month from dap record (similar to AnaliseDAP)
        const parseYearMonth = (dap) => {
          const anoCandidates = [dap?.ano_referencia, dap?.ano, dap?.ano_ref, dap?.anoReferencia, dap?.ano_referente];
          const mesCandidates = [dap?.mes_referencia, dap?.mes, dap?.mes_ref, dap?.mesReferencia, dap?.mes_referente];
          const anoVal = Number(anoCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
          const mesVal = Number(mesCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
          return { ano: anoVal, mes: mesVal };
        };

        const monthsSet = new Set((function buildSet() {
          const set = new Set();
          const today = new Date();
          for (let offset = monthsRange - 1; offset >= 0; offset -= 1) {
            const cursor = new Date(today.getFullYear(), today.getMonth() - offset, 1);
            set.add(buildMonthKey(cursor.getFullYear(), cursor.getMonth() + 1));
          }
          return set;
        }()));

        const toFetch = filteredItems.filter((dap) => {
          const pm = parseYearMonth(dap);
          const key = buildMonthKey(pm.ano, pm.mes);
          return monthsSet.has(key);
        });
        console.log('[HistoricoNasObModal] DAPs matching monthsRange', { monthsRange, candidates: toFetch.length, sample: toFetch.slice(0, 5) });

        // 2) for each DAP matching range, fetch full details and update aggregates progressively
        const promises = toFetch.map((dap) => getDapById(dap.id).then((full) => ({ dap, full })).catch((e) => ({ dap, error: e })));

        // process each promise as it resolves
        promises.forEach((p) => {
          p.then((res) => {
            if (cancelled) return;
            if (res && res.full) {
              try {
                const full = res.full;
                const meta = res.dap || full;
                const pm = parseYearMonth(meta);
                const key = buildMonthKey(pm.ano, pm.mes);
                // compute category counts from full.dap / full.periodos
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
                console.log('[HistoricoNasObModal] dap details processed', { dapId: meta.id || meta?.dap_id || meta?.id, key, counts });
                // apply counts to historico state
                setHistorico((prev) => {
                  const next = prev.map((m) => ({ ...m, totals: { ...m.totals } }));
                  const idx = next.findIndex((m) => m.key === key);
                  if (idx === -1) return next;
                  next[idx].totals.nascimentosProprios = (next[idx].totals.nascimentosProprios || 0) + counts.nascimentosProprios;
                  next[idx].totals.nascimentosUI = (next[idx].totals.nascimentosUI || 0) + counts.nascimentosUI;
                  next[idx].totals.obitosProprios = (next[idx].totals.obitosProprios || 0) + counts.obitosProprios;
                  next[idx].totals.obitosUI = (next[idx].totals.obitosUI || 0) + counts.obitosUI;
                  return next;
                });
              } catch (e) {
                console.error('[HistoricoNasObModal] erro processando dap', { error: e, dap: res.dap });
              }
            } else if (res && res.error) {
              console.error('[HistoricoNasObModal] erro ao obter detalhes da DAP', { dap: res.dap, error: res.error });
            }
          }).catch((err) => {
            console.error('[HistoricoNasObModal] promise erro', err);
          });
        });

        // wait all to finish to clear loading (but we updated progressively above)
        await Promise.allSettled(promises);
      } catch (err) {
        console.error('[HistoricoNasObModal] erro ao carregar historico via DAPs', err);
        if (!cancelled) setError('Não foi possível carregar os registros solicitados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      console.log('[HistoricoNasObModal] efeito encerrado, requests cancelados');
    };
  }, [open, monthsRange]);

  const summary = useMemo(() => categories.map((category) => ({
    ...category,
    total: historico.reduce((acc, entry) => acc + (entry.totals[category.id] ?? 0), 0),
  })), [historico]);

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ margin: 0 }}>Histórico Nas/OB</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Período:</div>
              {[6, 12, 24, 48].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonthsRange(m)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: monthsRange === m ? '2px solid #0f172a' : '1px solid #e2e8f0',
                    background: monthsRange === m ? '#0f172a' : 'white',
                    color: monthsRange === m ? 'white' : '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  {m} meses
                </button>
              ))}
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
              Últimos {monthsRange} meses de registros de nascimento e óbito por tipo de tributação.
            </p>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>
            Fechar
          </button>
        </div>
        <div style={contentStyle}>
          {loading ? (
            <p style={{ color: '#475569' }}>Carregando os dados das DAPs...</p>
          ) : error ? (
            <p style={{ color: '#b91c1c' }}>{error}</p>
          ) : (
            <>
              <div style={summaryGridStyle}>
                {summary.map((entry) => (
                  <div key={entry.id} style={summaryItemStyle}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{entry.label}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: entry.color }}>{entry.total}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={chartWrapperStyle}>
                  <SimpleLineChart data={historico} />
                </div>
                <div style={legendStyle}>
                  {categories.map((category) => (
                    <div key={category.id} style={legendItemStyle}>
                      <span style={{ ...legendDotStyle, background: category.color }} />
                      <span>{category.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 2100,
};

const modalStyle = {
  width: 'min(960px, 100%)',
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 30px 60px rgba(15, 23, 42, 0.35)',
};

const modalHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
};

const closeButtonStyle = {
  background: '#0f172a',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};

const contentStyle = {
  minHeight: '320px',
};

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '12px',
};

const summaryItemStyle = {
  padding: '12px',
  borderRadius: '14px',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const chartWrapperStyle = {
  background: '#0f172a',
  borderRadius: '16px',
  padding: '16px',
};

const legendStyle = {
  marginTop: 10,
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: 12,
  color: '#1e293b',
};

const legendDotStyle = {
  width: 12,
  height: 12,
  borderRadius: '999px',
  display: 'inline-block',
};
