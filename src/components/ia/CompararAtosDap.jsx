import React, { useEffect, useMemo, useState } from 'react';
import { listDaps, getDapById } from '../../services/dapService';
import { apiURL } from '../../config';

function padMonthValue(value) { return String(value).padStart(2, '0'); }
function buildMonthKey(year, month) { return `${year}-${padMonthValue(month)}`; }
function getLastMonths(n) {
  const today = new Date();
  const months = [];
  for (let offset = 0; offset < n; offset += 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, key: buildMonthKey(d.getFullYear(), d.getMonth() + 1), label: `${padMonthValue(d.getMonth() + 1)}/${d.getFullYear()}` });
  }
  return months;
}

async function fetchAtosMes({ year, month }) {
  const token = localStorage.getItem('token');
  const start = `${year}-${padMonthValue(month)}-01`;
  const end = `${year}-${padMonthValue(month)}-${padMonthValue(new Date(year, month, 0).getDate())}`;
  const params = new URLSearchParams({ dataInicial: start, dataFinal: end, tributacao: '01' });
  const res = await fetch(`${apiURL}/busca-atos/pesquisa?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Erro ao buscar atos');
  const atos = Array.isArray(data.atos) ? data.atos : [];
  const counts = {};
  atos.forEach((ato) => {
    const codigo = String(ato.codigo || ato.codigo_ato || '').trim();
    const trib = String(ato.tributacao || ato.tributacao_codigo || '').padStart(2, '0');
    const qty = Number(ato.quantidade || 0) || 0;
    if (trib === '01' && codigo) {
      counts[codigo] = (counts[codigo] || 0) + qty;
    }
  });
  return counts;
}

export default function CompararAtosDap() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { year: prev.getFullYear(), month: prev.getMonth() + 1, key: buildMonthKey(prev.getFullYear(), prev.getMonth() + 1), label: `${padMonthValue(prev.getMonth() + 1)}/${prev.getFullYear()}` };
  });
  const [dadosMes, setDadosMes] = useState({ key: '', label: '', sistema: {}, dap: {} });

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      setLoading(true); setErro('');
      const m = selectedMonth;
      try {
        // descobrir token de serventia do usuário logado (mesma lógica usada em outros componentes)
        let usuario = {};
        try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}'); } catch (_) { usuario = {}; }
        const getFinalToken = (s) => {
          if (!s || typeof s !== 'string') return '';
          const parts = s.trim().split(/\s+/).filter(Boolean);
          if (parts.length === 0) return '';
          return parts[parts.length - 1].replace(/[^\p{L}\p{N}_-]+/gu, '');
        };
        const userToken = String(getFinalToken(usuario?.serventia || usuario?.nome_abreviado || usuario?.nomeAbreviado || usuario?.serventiaNome || '')).toLowerCase();

        // DAPs do mês selecionado
        const dapCounts = {};
        try {
          const listResp = await listDaps({ ano: m.year, mes: m.month });
          const items = Array.isArray(listResp.items) ? listResp.items : [];
          let filteredItems = items;
          if (userToken) {
            filteredItems = items.filter((dap) => {
              const servDisplay = dap?.serventia_nome ?? dap?.serventiaNome ?? dap?.serventia ?? dap?.nome_serventia ?? dap?.nomeServentia ?? '';
              const finalToken = String(getFinalToken(servDisplay || '')).toLowerCase();
              return finalToken && userToken.includes(finalToken);
            });
          }
          console.log('[CompararAtosDap] listDaps mês', { ano: m.year, mes: m.month, total: items.length, filtered: filteredItems.length, userToken, sample: filteredItems.slice(0, 3) });
          const promises = filteredItems.map((dap) => {
            console.log('[CompararAtosDap] getDapById start', { dapId: dap.id, ano: m.year, mes: m.month });
            return getDapById(dap.id).then((full) => ({ dap, full })).catch((e) => ({ dap, error: e }));
          });
          const results = await Promise.allSettled(promises);
          results.forEach((r) => {
            if (r.status !== 'fulfilled') return;
            const res = r.value;
            if (!res || res.error || !res.full) {
              console.error('[CompararAtosDap] erro detalhe DAP', { dap: res?.dap, error: res?.error });
              return;
            }
            const periodos = res.full.periodos ?? res.full.dap_periodos ?? [];
            console.log('[CompararAtosDap] detalhe DAP agregado', { dapId: (res.dap || res.full)?.id, key: m.key, periodos: periodos.length, atos: periodos.flatMap((p) => p.atos ?? p.dap_atos ?? []).length });
            periodos.forEach((pItem) => {
              const atos = pItem.atos ?? pItem.dap_atos ?? [];
              atos.forEach((ato) => {
                const codigo = String(ato.codigo ?? ato.codigo_ato ?? ato.ato_codigo ?? '').trim();
                const trib = Number(ato.tributacao ?? ato.tributacao_codigo ?? ato.trib ?? 0) || 0;
                const qty = Number(ato.quantidade ?? ato.qtde ?? ato.qtd ?? 0) || 0;
                if (trib === 1 && codigo) {
                  dapCounts[codigo] = (dapCounts[codigo] || 0) + qty;
                }
              });
            });
          });
        } catch (e) {
          console.error('[CompararAtosDap] erro ao buscar DAP do mês', m, e);
        }

        // Atos do sistema para o mês (tributacao 01)
        let sistemaCounts = {};
        try {
          sistemaCounts = await fetchAtosMes({ year: m.year, month: m.month });
        } catch (e) {
          console.error('[CompararAtosDap] erro fetch atos', e);
          sistemaCounts = {};
        }

        if (cancel) return;
        setDadosMes({ key: m.key, label: m.label, sistema: sistemaCounts || {}, dap: dapCounts || {} });
      } catch (err) {
        console.error('[CompararAtosDap] erro geral', err);
        if (!cancel) setErro('Não foi possível carregar os dados para comparação.');
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    run();
    return () => { cancel = true; };
  }, [selectedMonth]);

  const resumoPorCodigo = useMemo(() => {
    const m = dadosMes;
    const acc = {};
    const codes = new Set([...Object.keys(m.sistema || {}), ...Object.keys(m.dap || {})]);
    codes.forEach((c) => {
      const sis = Number(m.sistema?.[c] || 0) || 0;
      const dp = Number(m.dap?.[c] || 0) || 0;
      acc[c] = { codigo: c, sistema: sis, dap: dp };
    });
    return Object.values(acc).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [dadosMes]);

  const monthsOptions = useMemo(() => getLastMonths(12), []);
  const totalSistema = useMemo(() => Object.values(dadosMes.sistema || {}).reduce((acc, v) => acc + (Number(v) || 0), 0), [dadosMes]);
  const totalDap = useMemo(() => Object.values(dadosMes.dap || {}).reduce((acc, v) => acc + (Number(v) || 0), 0), [dadosMes]);
  const diffTotal = totalSistema - totalDap;

  return (
    <div style={pageWrapper}>
      <div style={headerArea}>
        <div>
          <h2 style={{ margin: 0 }}>Comparação Atos Pagos (Sistema x DAP)</h2>
          <p style={{ margin: '4px 0 0 0', color: '#475569' }}>Comparação mensal por código de ato (tributação 01), filtrada pela serventia do usuário.</p>
        </div>
        <div style={selectorRow}>
          <label style={{ fontSize: 13, color: '#475569' }}>Mês de referência:</label>
          <select
            value={selectedMonth.key}
            onChange={(e) => {
              const m = monthsOptions.find((opt) => opt.key === e.target.value);
              if (m) setSelectedMonth(m);
            }}
            style={selectStyle}
          >
            {monthsOptions.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <p style={{ color: '#475569' }}>Carregando dados...</p> : erro ? <p style={{ color: '#b91c1c' }}>{erro}</p> : (
        <>
          <div style={cardsGrid}>
            <div style={{ ...cardItem, borderTop: '4px solid #0ea5e9' }}>
              <div style={cardLabel}>Total Sistema</div>
              <div style={cardValue}>{totalSistema}</div>
            </div>
            <div style={{ ...cardItem, borderTop: '4px solid #6366f1' }}>
              <div style={cardLabel}>Total DAP</div>
              <div style={cardValue}>{totalDap}</div>
            </div>
            <div style={{ ...cardItem, borderTop: '4px solid #f97316' }}>
              <div style={cardLabel}>Diferença (Sis - DAP)</div>
              <div style={{ ...cardValue, color: diffTotal === 0 ? '#16a34a' : diffTotal > 0 ? '#ea580c' : '#0ea5e9' }}>{diffTotal}</div>
            </div>
          </div>

          <div style={panel}>
            <div style={panelHeader}>
              <h4 style={{ margin: 0 }}>Comparativo {selectedMonth.label}</h4>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Sistema x DAP por código</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Código</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Sistema</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>DAP</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoPorCodigo.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>Sem dados para este mês.</td></tr>
                  )}
                  {resumoPorCodigo.map((linha, idx) => {
                    const diff = linha.sistema - linha.dap;
                    return (
                      <tr key={linha.codigo} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={tdCode}>{linha.codigo}</td>
                        <td style={tdNumber}>{linha.sistema}</td>
                        <td style={tdNumber}>{linha.dap}</td>
                        <td style={{ ...tdNumber, color: diff === 0 ? '#16a34a' : diff > 0 ? '#ea580c' : '#0ea5e9' }}>{diff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const pageWrapper = {
  padding: '24px',
  maxWidth: '1100px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const headerArea = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const selectorRow = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const selectStyle = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  minWidth: 140,
};

const cardsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const cardItem = {
  background: 'white',
  borderRadius: 12,
  padding: '14px 16px',
  boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
};

const cardLabel = { color: '#475569', fontSize: 13, marginBottom: 6 };
const cardValue = { fontSize: 28, fontWeight: 700, color: '#0f172a' };

const panel = {
  background: 'white',
  borderRadius: 14,
  boxShadow: '0 12px 36px rgba(15,23,42,0.08)',
  padding: 16,
};

const panelHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 };

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle = { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 700 };
const tdCode = { padding: '10px 8px', fontWeight: 600, color: '#0f172a' };
const tdNumber = { padding: '10px 8px', textAlign: 'right', color: '#0f172a' };
