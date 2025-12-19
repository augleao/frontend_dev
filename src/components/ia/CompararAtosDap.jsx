import React, { useEffect, useMemo, useState } from 'react';
import { listDaps, getDapById } from '../../services/dapService';
import { apiURL } from '../../config';

function padMonthValue(value) { return String(value).padStart(2, '0'); }
function buildMonthKey(year, month) { return `${year}-${padMonthValue(month)}`; }
function getLastMonths(n) {
  const today = new Date();
  const months = [];
  for (let offset = n - 1; offset >= 0; offset -= 1) {
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
  const [monthsRange, setMonthsRange] = useState(12);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState([]); // [{ key, label, sistema: {code:count}, dap: {code:count} }]

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      setLoading(true); setErro('');
      const months = getLastMonths(monthsRange);
      try {
        // 1) DAPs por mês (backend requer ano/mes na consulta)
        const dapAgg = months.reduce((acc, m) => ({ ...acc, [m.key]: {} }), {});
        const parseYM = (dap) => {
          const ano = Number(dap?.ano_referencia ?? dap?.ano ?? dap?.ano_ref ?? 0) || 0;
          const mes = Number(dap?.mes_referencia ?? dap?.mes ?? dap?.mes_ref ?? 0) || 0;
          return { ano, mes };
        };

        for (const m of months) {
          try {
            const listResp = await listDaps({ ano: m.year, mes: m.month });
            const items = Array.isArray(listResp.items) ? listResp.items : [];
            console.log('[CompararAtosDap] listDaps mês', { ano: m.year, mes: m.month, total: items.length, sample: items.slice(0, 3) });
            const promises = items.map((dap) => getDapById(dap.id).then((full) => ({ dap, full })).catch((e) => ({ dap, error: e })));
            const results = await Promise.allSettled(promises);
            results.forEach((r) => {
              if (r.status !== 'fulfilled') return;
              const res = r.value;
              if (!res || res.error || !res.full) {
                console.error('[CompararAtosDap] erro detalhe DAP', { dap: res?.dap, error: res?.error });
                return;
              }
              const meta = res.dap || res.full;
              const { ano, mes } = parseYM(meta);
              const key = buildMonthKey(ano, mes);
              if (key !== m.key) return;
              const periodos = res.full.periodos ?? res.full.dap_periodos ?? [];
              console.log('[CompararAtosDap] detalhe DAP agregado', { dapId: meta?.id, key, periodos: periodos.length });
              periodos.forEach((pItem) => {
                const atos = pItem.atos ?? pItem.dap_atos ?? [];
                atos.forEach((ato) => {
                  const codigo = String(ato.codigo ?? ato.codigo_ato ?? ato.ato_codigo ?? '').trim();
                  const trib = Number(ato.tributacao ?? ato.tributacao_codigo ?? ato.trib ?? 0) || 0;
                  const qty = Number(ato.quantidade ?? ato.qtde ?? ato.qtd ?? 0) || 0;
                  if (trib === 1 && codigo) {
                    dapAgg[key][codigo] = (dapAgg[key][codigo] || 0) + qty;
                  }
                });
              });
            });
          } catch (e) {
            console.error('[CompararAtosDap] erro ao buscar DAP do mês', m, e);
          }
          if (cancel) break;
        }

        // 2) Atos do sistema por mês (tributacao 01)
        const sistemaAgg = months.reduce((acc, m) => ({ ...acc, [m.key]: {} }), {});
        for (const m of months) {
          try {
            const counts = await fetchAtosMes({ year: m.year, month: m.month });
            sistemaAgg[m.key] = counts;
          } catch (e) {
            console.error('[CompararAtosDap] erro fetch atos', e);
            sistemaAgg[m.key] = {};
          }
        }

        if (cancel) return;
        const merged = months.map((m) => ({ key: m.key, label: m.label, sistema: sistemaAgg[m.key] || {}, dap: dapAgg[m.key] || {} }));
        setDados(merged);
      } catch (err) {
        console.error('[CompararAtosDap] erro geral', err);
        if (!cancel) setErro('Não foi possível carregar os dados para comparação.');
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    run();
    return () => { cancel = true; };
  }, [monthsRange]);

  const resumoPorCodigo = useMemo(() => {
    const acc = {};
    dados.forEach((m) => {
      const codes = new Set([...Object.keys(m.sistema || {}), ...Object.keys(m.dap || {})]);
      codes.forEach((c) => {
        const sis = Number(m.sistema?.[c] || 0) || 0;
        const dp = Number(m.dap?.[c] || 0) || 0;
        if (!acc[c]) acc[c] = { codigo: c, sistema: 0, dap: 0 };
        acc[c].sistema += sis;
        acc[c].dap += dp;
      });
    });
    return Object.values(acc).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [dados]);

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 12 }}>Comparação Atos Pagos (Sistema x DAP)</h2>
      <p style={{ marginTop: 0, color: '#475569' }}>Comparação mensal por código de ato (tributação 01) entre atos lançados no sistema e atos constantes da DAP.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>Período:</span>
        {[6, 12, 24].map((m) => (
          <button key={m} type="button" onClick={() => setMonthsRange(m)} style={{ padding: '6px 10px', borderRadius: 6, border: monthsRange === m ? '2px solid #0f172a' : '1px solid #e2e8f0', background: monthsRange === m ? '#0f172a' : 'white', color: monthsRange === m ? 'white' : '#0f172a', cursor: 'pointer' }}>{m} meses</button>
        ))}
      </div>

      {loading ? <p style={{ color: '#475569' }}>Carregando dados...</p> : erro ? <p style={{ color: '#b91c1c' }}>{erro}</p> : (
        <>
          <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.08)', marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Resumo por código (soma do período selecionado)</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>Código</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>Sistema</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>DAP</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoPorCodigo.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 10, textAlign: 'center', color: '#94a3b8' }}>Sem dados para o período.</td></tr>
                  )}
                  {resumoPorCodigo.map((linha, idx) => {
                    const diff = linha.sistema - linha.dap;
                    return (
                      <tr key={linha.codigo} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{linha.codigo}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{linha.sistema}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{linha.dap}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', color: diff === 0 ? '#16a34a' : diff > 0 ? '#ea580c' : '#0ea5e9' }}>{diff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Detalhe mensal</h4>
            {dados.map((m) => {
              const codes = Array.from(new Set([...Object.keys(m.sistema || {}), ...Object.keys(m.dap || {})])).sort();
              return (
                <div key={m.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{m.label}</div>
                  {codes.length === 0 ? (
                    <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, color: '#94a3b8' }}>Sem dados</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>Código</th>
                            <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>Sistema</th>
                            <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>DAP</th>
                            <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #e2e8f0' }}>Dif.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {codes.map((c, idx2) => {
                            const sis = Number(m.sistema?.[c] || 0) || 0;
                            const dp = Number(m.dap?.[c] || 0) || 0;
                            const diff = sis - dp;
                            return (
                              <tr key={`${m.key}-${c}`} style={{ background: idx2 % 2 === 0 ? 'white' : '#f8fafc' }}>
                                <td style={{ padding: '8px 6px', fontWeight: 600 }}>{c}</td>
                                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{sis}</td>
                                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{dp}</td>
                                <td style={{ padding: '8px 6px', textAlign: 'right', color: diff === 0 ? '#16a34a' : diff > 0 ? '#ea580c' : '#0ea5e9' }}>{diff}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
