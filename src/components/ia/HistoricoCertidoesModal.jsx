import React, { useEffect, useMemo, useState } from 'react';
import { listDaps, getDapById } from '../../services/dapService';

const categories = [
  { id: 'certidoesPago', label: 'Certidões Pagas (7802, trib 01)', color: '#f97316' },
  { id: 'certidoesGratis', label: 'Certidões Gratuitas (7802, trib 11)', color: '#2563eb' },
  { id: 'transmissaoPaga', label: 'Transmissão de Dados Paga (7140, trib 01)', color: '#16a34a' },
  { id: 'transmissaoGratis', label: 'Transmissão de Dados Gratuita (7140, trib 11)', color: '#c026d3' },
];

function padMonthValue(value) { return String(value).padStart(2, '0'); }
function buildMonthKey(year, month) { if (!year || !month) return ''; return `${year}-${padMonthValue(month)}`; }
function getLastMonths(n) {
  const today = new Date();
  const months = [];
  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    months.push({ year, month, key: buildMonthKey(year, month), label: `${padMonthValue(month)}/${year}` });
  }
  return months;
}

function buildEmptyHistory(n = 12) {
  return getLastMonths(n).map((m) => ({ ...m, totals: categories.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {}) }));
}

function SimpleLineChart({ data = [] }) {
  const [hover, setHover] = useState(null);
  if (!Array.isArray(data) || data.length === 0) return null;
  const width = 720; const height = 260; const padding = 40;
  const plotWidth = width - padding * 2; const plotHeight = height - padding * 2;
  const rawMax = Math.max(...data.flatMap((entry) => categories.map((c) => entry.totals[c.id] ?? 0)), 0);
  const combinedMax = Math.max(rawMax, 1);
  const paddedMax = Math.ceil(combinedMax * 1.12);
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const seriesPaths = categories.map((category) => {
    const points = data.map((entry, index) => {
      const value = entry.totals[category.id] ?? 0;
      const x = padding + (data.length === 1 ? plotWidth / 2 : xStep * index);
      const y = padding + plotHeight - (value / paddedMax) * plotHeight;
      return { x, y };
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return { ...category, path, points };
  });

  const horizontalLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ y: padding + plotHeight - ratio * plotHeight, value: Math.round(paddedMax * ratio) }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Histórico mensal certidões" style={{ width: '100%', height: 'auto' }}>
      <rect x={padding} y={padding} width={plotWidth} height={plotHeight} fill="#0f172a" rx={12} />
      {horizontalLines.map((line) => (
        <g key={line.y}>
          <line x1={padding} x2={padding + plotWidth} y1={line.y} y2={line.y} stroke="rgba(148, 163, 184, 0.5)" strokeDasharray="4 6" />
          <text x={padding - 10} y={line.y + 4} textAnchor="end" fill="white" fontSize={10}>{line.value}</text>
        </g>
      ))}
      {seriesPaths.map((series) => (
        <g key={series.id}>
          <path d={series.path} fill="none" stroke={series.color} strokeWidth={2} strokeLinecap="round" />
          {series.points.map((pt, idx) => (
            <circle key={`pt-${series.id}-${idx}`} cx={pt.x} cy={pt.y} r={4} fill={series.color} stroke="#fff" strokeWidth={1}
              onMouseEnter={() => setHover({ x: pt.x, y: pt.y, value: data[idx].totals[series.id] ?? 0, label: data[idx].label, color: series.color })}
              onMouseLeave={() => setHover(null)} />
          ))}
        </g>
      ))}
      {data.map((entry, index) => {
        const x = padding + (data.length === 1 ? plotWidth / 2 : xStep * index);
        return (<text key={`axis-${entry.key}`} x={x} y={height - 12} fontSize={10} fill="#e2e8f0" textAnchor="middle">{entry.label}</text>);
      })}
      {hover && (
        <g pointerEvents="none">
          <rect x={Math.max(padding, Math.min( width - padding - 80, hover.x - 40 ))} y={hover.y - 36} width={80} height={28} rx={6} fill="#ffffff" stroke="#0f172a" />
          <text x={Math.max(padding + 8, Math.min( width - padding - 16, hover.x ))} y={hover.y - 16} fontSize={12} fill="#0f172a" textAnchor="middle" fontWeight={700}>{String(hover.value)}</text>
        </g>
      )}
    </svg>
  );
}

export default function HistoricoCertidoesModal({ open, onClose }) {
  const [historico, setHistorico] = useState(() => buildEmptyHistory(12));
  const [monthsRange, setMonthsRange] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true); setError('');
    setHistorico(() => {
      const months = getLastMonths(monthsRange).map((m) => ({ ...m, totals: categories.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {}) }));
      return months;
    });

    (async () => {
      try {
        const listResp = await listDaps({});
        const items = Array.isArray(listResp.items) ? listResp.items : [];
        let usuario = {};
        try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}'); } catch (_) { usuario = {}; }
        const getFinalToken = (s) => {
          if (!s || typeof s !== 'string') return '';
          const parts = s.trim().split(/\s+/).filter(Boolean);
          if (parts.length === 0) return '';
          return parts[parts.length - 1].replace(/[^\p{L}\p{N}_-]+/gu, '');
        };
        const userToken = String(getFinalToken(usuario?.serventia || usuario?.nome_abreviado || '')).toLowerCase();
        let filteredItems = items;
        if (userToken) {
          filteredItems = items.filter((dap) => {
            const servDisplay = dap?.serventia_nome ?? dap?.serventiaNome ?? dap?.serventia ?? '';
            const finalToken = String(getFinalToken(servDisplay || '')).toLowerCase();
            return finalToken && String(userToken).includes(finalToken);
          });
        }

        const parseYearMonth = (dap) => {
          const anoCandidates = [dap?.ano_referencia, dap?.ano, dap?.ano_ref, dap?.anoReferencia];
          const mesCandidates = [dap?.mes_referencia, dap?.mes, dap?.mes_ref, dap?.mesReferencia];
          const anoVal = Number(anoCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
          const mesVal = Number(mesCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
          return { ano: anoVal, mes: mesVal };
        };

        const monthsSet = new Set(getLastMonths(monthsRange).map((m) => m.key));

        const toFetch = filteredItems.filter((dap) => {
          const pm = parseYearMonth(dap);
          const key = buildMonthKey(pm.ano, pm.mes);
          return monthsSet.has(key);
        });

        const promises = toFetch.map((dap) => getDapById(dap.id).then((full) => ({ dap, full })).catch((e) => ({ dap, error: e })));

        promises.forEach((p) => {
          p.then((res) => {
            if (cancelled) return;
            if (res && res.full) {
              try {
                const full = res.full; const meta = res.dap || full;
                const pm = parseYearMonth(meta); const key = buildMonthKey(pm.ano, pm.mes);
                const periodos = full.periodos ?? full.dap_periodos ?? [];
                const counts = { certidoesPago: 0, certidoesGratis: 0, transmissaoPaga: 0, transmissaoGratis: 0 };
                periodos.forEach((pItem) => {
                  const atos = pItem.atos ?? pItem.dap_atos ?? [];
                  atos.forEach((ato) => {
                    const code = String(ato.codigo ?? ato.codigo_ato ?? ato.ato_codigo ?? '').trim();
                    const tribNum = Number(ato.tributacao ?? ato.tributacao_codigo ?? ato.trib ?? 0) || 0;
                    const qty = Number(ato.quantidade ?? ato.qtde ?? ato.qtd ?? 0) || 0;
                    if (code === '7802') {
                      if (tribNum === 1) counts.certidoesPago += qty;
                      if (tribNum === 11) counts.certidoesGratis += qty;
                    }
                    if (code === '7140') {
                      if (tribNum === 1) counts.transmissaoPaga += qty;
                      if (tribNum === 11) counts.transmissaoGratis += qty;
                    }
                  });
                });
                setHistorico((prev) => {
                  const next = prev.map((m) => ({ ...m, totals: { ...m.totals } }));
                  const idx = next.findIndex((m) => m.key === key);
                  if (idx === -1) return next;
                  next[idx].totals.certidoesPago = (next[idx].totals.certidoesPago || 0) + counts.certidoesPago;
                  next[idx].totals.certidoesGratis = (next[idx].totals.certidoesGratis || 0) + counts.certidoesGratis;
                  next[idx].totals.transmissaoPaga = (next[idx].totals.transmissaoPaga || 0) + counts.transmissaoPaga;
                  next[idx].totals.transmissaoGratis = (next[idx].totals.transmissaoGratis || 0) + counts.transmissaoGratis;
                  return next;
                });
              } catch (e) {
                console.error('[HistoricoCertidoesModal] erro processando dap', { error: e, dap: res.dap });
              }
            } else if (res && res.error) {
              console.error('[HistoricoCertidoesModal] erro ao obter detalhes da DAP', { dap: res.dap, error: res.error });
            }
          }).catch((err) => { console.error('[HistoricoCertidoesModal] promise erro', err); });
        });

        await Promise.allSettled(promises);
      } catch (err) {
        console.error('[HistoricoCertidoesModal] erro ao carregar historico', err);
        if (!cancelled) setError('Não foi possível carregar os registros solicitados.');
      } finally { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [open, monthsRange]);

  const summary = useMemo(() => {
    const windowSize = 3;
    const n = Math.min(windowSize, historico.length);
    const start = Math.max(0, historico.length - n);
    return categories.map((category) => {
      const total = historico.slice(start).reduce((acc, e) => acc + (e.totals[category.id] ?? 0), 0);
      return { ...category, total };
    });
  }, [historico]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top:0,left:0,right:0,bottom:0, background:'rgba(15,23,42,0.65)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, zIndex:2100 }}>
      <div style={{ width: 'min(960px,100%)', background:'white', borderRadius:20, padding:24, boxShadow:'0 30px 60px rgba(15,23,42,0.35)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Histórico Certidões</h3>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
              <div style={{ fontSize:12, color:'#94a3b8' }}>Período:</div>
              {[6,12,24,48].map((m) => (
                <button key={m} type="button" onClick={() => setMonthsRange(m)} style={{ padding:'6px 10px', borderRadius:6, border: monthsRange===m ? '2px solid #0f172a' : '1px solid #e2e8f0', background: monthsRange===m ? '#0f172a' : 'white', color: monthsRange===m ? 'white' : '#0f172a', cursor:'pointer' }}>{m} meses</button>
              ))}
            </div>
            <p style={{ margin:'8px 0 0 0', fontSize:12, color:'#94a3b8' }}>Últimos {monthsRange} meses de registros de certidões e transmissão por tributação.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background:'#0f172a', color:'white', border:'none', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:600 }}>Fechar</button>
        </div>
        <div style={{ minHeight:320 }}>
          {loading ? <p style={{ color:'#475569' }}>Carregando os dados das DAPs...</p> : error ? <p style={{ color:'#b91c1c' }}>{error}</p> : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
                {summary.map((entry) => (
                  <div key={entry.id} style={{ padding:12, borderRadius:14, background:'#f8fafc', display:'flex', flexDirection:'column', gap:6 }}>
                    <span style={{ fontSize:11, color:'#64748b' }}>{entry.label}</span>
                    <span style={{ fontSize:18, fontWeight:700, color: entry.color }}>{entry.total}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16 }}>
                <div style={{ background:'#0f172a', borderRadius:16, padding:16 }}>
                  <SimpleLineChart data={historico} />
                </div>
                <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:12 }}>
                  {categories.map((category) => (
                    <div key={category.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#1e293b' }}>
                      <span style={{ width:12, height:12, borderRadius:999, display:'inline-block', background: category.color }} />
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
