import React, { useEffect, useMemo, useState } from 'react';
import { listDaps, getDapById } from '../../services/dapService';

const categories = [
  {
    id: 'nascimentosProprios',
    label: 'Registros de Nascimento Próprios (9101, trib 26)',
    code: '9101',
    trib: 26,
    color: '#f97316',
  },
  {
    id: 'nascimentosUI',
    label: 'Registros de Nascimento UI (9101, trib 29)',
    code: '9101',
    trib: 29,
    color: '#2563eb',
  },
  {
    id: 'obitosProprios',
    label: 'Registros de Óbito Próprios (9201, trib 26)',
    code: '9201',
    trib: 26,
    color: '#16a34a',
  },
  {
    id: 'obitosUI',
    label: 'Registros de Óbito UI (9201, trib 29)',
    code: '9201',
    trib: 29,
    color: '#c026d3',
  },
];

function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
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
      key: getMonthKey(year, month),
      label: `${String(month).padStart(2, '0')}/${year}`,
    });
  }
  return months;
}

function parseDapReference(dap) {
  if (!dap) return { year: null, month: null };
  const yearCandidates = [
    dap?.ano_referencia,
    dap?.anoReferencia,
    dap?.ano_ref,
    dap?.ano,
    dap?.ano_referente,
  ];
  const monthCandidates = [
    dap?.mes_referencia,
    dap?.mesReferencia,
    dap?.mes_ref,
    dap?.mes,
    dap?.mes_referente,
  ];
  const normalizedYear = yearCandidates.map((value) => Number(value)).find((value) => Number.isFinite(value));
  const normalizedMonth = monthCandidates.map((value) => Number(value)).find((value) => Number.isFinite(value));
  return {
    year: typeof normalizedYear === 'number' && Number.isFinite(normalizedYear) ? normalizedYear : null,
    month: typeof normalizedMonth === 'number' && Number.isFinite(normalizedMonth) ? normalizedMonth : null,
  };
}

function aggregateByMonth(results, months) {
  const map = new Map();
  months.forEach((month) => {
    map.set(month.key, {
      label: month.label,
      totals: categories.reduce((acc, category) => ({
        ...acc,
        [category.id]: 0,
      }), {}),
    });
  });

  results.forEach(({ dap, detail }) => {
    const reference = parseDapReference(dap);
    if (!reference.year || !reference.month) return;
    const key = getMonthKey(reference.year, reference.month);
    const entry = map.get(key);
    if (!entry) return;
    const periodos = detail?.periodos ?? detail?.dap_periodos ?? [];
    periodos.forEach((periodo) => {
      const atos = periodo?.atos ?? periodo?.dap_atos ?? [];
      atos.forEach((ato) => {
        const code = String(ato?.codigo ?? ato?.codigo_ato ?? ato?.ato_codigo ?? '').trim();
        const tribRaw = ato?.tributacao ?? ato?.tributacao_codigo ?? ato?.trib ?? ato?.tributacao;
        const tribNum = Number(String(tribRaw ?? '').replace(',', '.'));
        const quantidadeRaw = ato?.quantidade ?? ato?.qtde ?? ato?.qtd ?? 0;
        const quantidade = Number(String(quantidadeRaw ?? '0').replace(',', '.'));
        if (!code || Number.isNaN(tribNum) || Number.isNaN(quantidade)) return;
        categories.forEach((category) => {
          if (code === category.code && tribNum === category.trib) {
            entry.totals[category.id] += quantidade;
          }
        });
      });
    });
  });

  return months.map((month) => {
    const entry = map.get(month.key);
    return {
      key: month.key,
      label: month.label,
      totals: entry ? { ...entry.totals } : categories.reduce((acc, category) => ({ ...acc, [category.id]: 0 }), {}),
    };
  });
}

function SimpleLineChart({ data = [] }) {
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
        <path key={series.id} d={series.path} fill="none" stroke={series.color} strokeWidth={2} strokeLinecap="round" />
      ))}
      {data.map((entry, index) => {
        const x = padding + (data.length === 1 ? plotWidth / 2 : xStep * index);
        return (
          <text key={`axis-${entry.key}`} x={x} y={height - 12} fontSize={10} fill="#e2e8f0" textAnchor="middle">
            {entry.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function HistoricoNasObModal({ open, onClose }) {
  const [historico, setHistorico] = useState(() => getLast12Months().map((month) => ({ key: month.key, label: month.label, totals: categories.reduce((acc, category) => ({ ...acc, [category.id]: 0 }), {}) })));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const monthsRange = getLast12Months();
    setLoading(true);
    setError('');
    const years = Array.from(new Set(monthsRange.map((month) => month.year)));

    (async () => {
      try {
        const responses = await Promise.all(years.map((year) => listDaps({ ano: year })));
        if (cancelled) return;
        const items = responses.flatMap((res) => res?.items ?? []);
        const keys = new Set(monthsRange.map((month) => month.key));
        const relevant = items.filter((dap) => {
          if (!dap?.id) return false;
          const reference = parseDapReference(dap);
          if (!reference.year || !reference.month) return false;
          return keys.has(getMonthKey(reference.year, reference.month));
        });
        const unique = Array.from(new Map(relevant.map((dap) => [dap.id, dap])).values());
        const detailPromises = unique.map((dap) =>
          getDapById(dap.id)
            .then((detail) => ({ dap, detail }))
            .catch(() => null)
        );
        const results = (await Promise.all(detailPromises)).filter(Boolean);
        if (cancelled) return;
        const aggregated = aggregateByMonth(results, monthsRange);
        setHistorico(aggregated);
      } catch (e) {
        if (!cancelled) {
          setError('Não foi possível carregar os registros dos últimos 12 meses.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

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
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              Últimos 12 meses de registros de nascimento e óbito por tipo de tributação.
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
