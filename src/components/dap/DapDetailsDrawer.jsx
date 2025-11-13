import React, { useEffect, useState } from 'react';
import { apiURL } from '../../config';

function DapDetailsDrawer({ dap, onClose, loading }) {
  const [descricaoMap, setDescricaoMap] = useState({});
  // keep hook order stable: always register useEffect (it will only attach listener when modal is open)
  useEffect(() => {
    if (!(dap || loading)) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && onClose) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dap, loading]);

  // Populate missing ato descriptions by querying the backend `/atos?search=` route.
  useEffect(() => {
    if (!dap) return undefined;
    const periodosLocal = dap.periodos ?? dap.dap_periodos ?? [];
    const codesSet = new Set();
    periodosLocal.forEach((p) => {
      const atos = p.atos ?? p.dap_atos ?? [];
      atos.forEach((a) => {
        const code = a.codigo ?? a.codigo_ato ?? a.ato_codigo;
        if (code && code !== '—' && !descricaoMap[String(code)]) codesSet.add(String(code));
      });
    });
    const codes = Array.from(codesSet);
    if (codes.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const results = await Promise.all(codes.map(async (code) => {
          try {
            const res = await fetch(`${apiURL}/atos?search=${encodeURIComponent(code)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) return null;
            const json = await res.json();
            const found = (json.atos || []).find((it) => String(it.codigo) === String(code) || String(it.codigo_ato) === String(code));
            if (found) return { code, descricao: found.descricao ?? found.descricao_ato ?? found.nome ?? null };
            return null;
          } catch (e) {
            return null;
          }
        }));
        if (cancelled) return;
        const newMap = { ...descricaoMap };
        let changed = false;
        results.forEach((r) => {
          if (r && r.code && !newMap[r.code]) {
            newMap[r.code] = r.descricao ?? '—';
            changed = true;
          }
        });
        if (changed) setDescricaoMap(newMap);
      } catch (e) {
        // ignore
        // console.error('Erro ao buscar descrições de atos', e);
      }
    })();
    return () => { cancelled = true; };
  }, [dap, descricaoMap]);

  if (!dap && !loading) {
    return null;
  }

  if (loading) {
    return (
      <div style={drawerOverlayStyle} onClick={(e) => e.currentTarget === e.target && onClose && onClose()}>
        <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#0f172a' }}>Carregando detalhes...</h2>
            <button type="button" onClick={onClose} style={closeButtonStyle}>
              ×
            </button>
          </div>
          <p style={{ color: '#475569' }}>Buscando informações completas da DAP selecionada.</p>
        </div>
      </div>
    );
  }

  const periodos = dap.periodos ?? dap.dap_periodos ?? [];

  return (
    <div style={drawerOverlayStyle} onClick={(e) => e.currentTarget === e.target && onClose && onClose()}>
      <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        <div style={drawerHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a' }}>Detalhes da DAP</h2>
            <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>
              {String(dap.mes_referencia ?? dap.mes ?? '').padStart(2, '0')}/{dap.ano_referencia ?? dap.ano ?? ''} · {dap.tipo ?? 'ORIGINAL'} · {dap.status ?? 'ATIVA'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Fechar detalhes">
            ×
          </button>
        </div>

        <section style={{ marginBottom: 24 }}>
          <h3 style={sectionTitleStyle}>Resumo</h3>
          <div style={infoGridStyle}>
            <InfoItem label="Referência (M/A)" value={getReferencia(dap)} />
            <InfoItem label="Serventia" value={getServentiaName(dap)} />
            <InfoItem label="Código Serventia" value={getCodigoServentia(dap)} />
            <InfoItem label="CNPJ" value={dap.cnpj ?? '—'} />
            <InfoItem label="Data de transmissão" value={getDataTransmissao(dap)} />
            <InfoItem label="Código do recibo" value={getCodigoRecibo(dap)} />
            <InfoItem label="Retificadora" value={dap.retificadora ? 'Sim' : 'Não'} />
            {/* IDs de retificação removidos do resumo conforme solicitado */}
          </div>
          {/* Observações removidas conforme solicitação */}
        </section>

        <section>
          <h3 style={sectionTitleStyle}>Atos Praticados</h3>
          {periodos.length === 0 && (
            <p style={{ color: '#64748b', fontSize: '13px' }}>Nenhum período registrado para esta DAP.</p>
          )}
          {periodos.map((periodo) => (
            <div key={periodo.id ?? periodo.periodo_numero} style={periodCardStyle}>
              <header style={periodHeaderStyle}>
                <span style={periodBadgeStyle}>{periodo.periodo_numero}</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>
                  Total de atos: {periodo.total_atos ?? '—'}
                </span>
              </header>
              {/* Métricas removidas: Emolumentos, TED, ISS, Total líquido (solicitado) */}
              {renderAtos(periodo, descricaoMap)}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function renderAtos(periodo, descricaoMap) {
  const atos = periodo.atos ?? periodo.dap_atos ?? [];
  if (!Array.isArray(atos) || atos.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <table style={atosTableStyle}>
        <thead>
          <tr>
            <th style={atoHeaderCellStyle}>Código</th>
            <th style={atoHeaderCellStyle}>Descrição</th>
            <th style={atoHeaderCellStyle}>Trib.</th>
            <th style={atoHeaderCellStyle}>Qtd</th>
            <th style={atoHeaderCellStyle}>Emolumentos</th>
            <th style={atoHeaderCellStyle}>ISS</th>
            <th style={atoHeaderCellStyle}>Valor líquido</th>
          </tr>
        </thead>
        <tbody>
          {atos.map((ato, i) => {
            const tributacaoTexto = ato.tributacao
              || (ato.tributacao_codigo
                ? `${ato.tributacao_codigo}${ato.tributacao_descricao ? ' - ' + ato.tributacao_descricao : ''}`
                : '—');
            // DEBUG: inspecionar objeto `ato` no console para verificar campos
            console.log('[DEBUG][DAP ATOS]', ato);
            const rowBg = i % 2 === 0 ? 'white' : '#e6e6e6';
            return (
              <tr
                key={ato.id ?? `${(ato.codigo || ato.codigo_ato || ato.ato_codigo || 'sem-codigo')}-${ato.descricao ?? ''}` }
                style={{ background: rowBg }}
              >
                <td style={atoCellStyle}>{ato.codigo ?? ato.codigo_ato ?? ato.ato_codigo ?? '—'}</td>
                <td style={atoCellStyle}>{
                  (() => {
                    const codeKey = ato.codigo ?? ato.codigo_ato ?? ato.ato_codigo ?? '';
                    if (codeKey && descricaoMap[String(codeKey)]) return descricaoMap[String(codeKey)];
                    return ato.descricao ?? '—';
                  })()
                }</td>
                <td style={atoCellStyle}>{tributacaoTexto}</td>
                <td style={atoCellStyle}>{ato.quantidade ?? '—'}</td>
                <td style={atoCellStyle}>{formatCurrency(ato.emolumentos)}</td>
                <td style={atoCellStyle}>{formatCurrency(ato.taxa_iss)}</td>
                <td style={atoCellStyle}>{formatCurrency(ato.valor_liquido)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.4px' }}>
        {label}
      </span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{value ?? '—'}</span>
    </div>
  );
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return '—';
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getReferencia(dap) {
  if (!dap) return '—';
  // Se existir um campo combinado em string, tente extrair MM/YYYY ou YYYY/MM
  if (dap.referencia && typeof dap.referencia === 'string') {
    const m = dap.referencia.match(/(\d{1,2})[\/\-](\d{4})/);
    if (m) return String(m[1]).padStart(2, '0') + '/' + m[2];
    const m2 = dap.referencia.match(/(\d{4})[\/\-](\d{1,2})/);
    if (m2) return String(m2[2]).padStart(2, '0') + '/' + m2[1];
  }

  // possíveis nomes de campo usados na base/serialização
  const mesCandidates = [
    dap.mes_referencia,
    dap.mes,
    dap.mes_ref,
    dap.mesReferencia,
    dap.mes_referente,
  ];
  const anoCandidates = [
    dap.ano_referencia,
    dap.ano,
    dap.ano_ref,
    dap.anoReferencia,
    dap.ano_referente,
  ];

  const mes = mesCandidates.find((v) => v !== undefined && v !== null && v !== '');
  const ano = anoCandidates.find((v) => v !== undefined && v !== null && v !== '');

  if (mes || ano) {
    const mesStr = mes === undefined || mes === null || mes === '' ? '—' : String(mes).padStart(2, '0');
    const anoStr = ano === undefined || ano === null || ano === '' ? '—' : String(ano);
    if (mesStr === '—' && anoStr === '—') return '—';
    return `${mesStr}/${anoStr}`;
  }

  return '—';
}

function getServentiaName(dap) {
  if (!dap) return '—';
  return (
    dap.serventia_nome
    ?? dap.serventiaNome
    ?? dap.serventia
    ?? dap.nome_serventia
    ?? dap.nomeServentia
    ?? '—'
  );
}

function getCodigoServentia(dap) {
  if (!dap) return '—';
  return (
    dap.codigo_serventia
    ?? dap.codigoServentia
    ?? dap.serventia_codigo
    ?? dap.codigo_ser
    ?? '—'
  );
}

function getDataTransmissao(dap) {
  if (!dap) return '—';
  const candidates = [
    dap.data_transmissao,
    dap.dataTransmissao,
    dap.transmissao_data,
    dap.data_envio,
    dap.data_enviado,
  ];
  for (const v of candidates) {
    if (v === undefined || v === null || v === '') continue;
    const date = new Date(v);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('pt-BR');
  }
  return '—';
}

function getCodigoRecibo(dap) {
  if (!dap) return '—';
  return (
    dap.codigo_recibo
    ?? dap.codigoRecibo
    ?? dap.recibo_codigo
    ?? dap.codigo_recibo_dap
    ?? '—'
  );
}

const drawerOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 999,
};

const drawerStyle = {
  width: '100%',
  maxWidth: '1200px',
  height: '100%',
  background: '#f8fafc',
  boxShadow: '0 8px 40px rgba(15, 23, 42, 0.45)',
  padding: '28px',
  overflowY: 'auto',
  borderRadius: 0,
  display: 'flex',
  flexDirection: 'column',
};

const drawerHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '24px',
};

const closeButtonStyle = {
  background: 'transparent',
  border: 'none',
  fontSize: '28px',
  cursor: 'pointer',
  color: '#334155',
};

const sectionTitleStyle = {
  fontSize: '16px',
  color: '#1e3a8a',
  margin: '0 0 12px 0',
  letterSpacing: '0.4px',
};

const infoGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '16px',
  padding: '16px',
  background: 'white',
  borderRadius: '16px',
  boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
};

const noteBoxStyle = {
  marginTop: 16,
  background: '#e0ecff',
  borderRadius: '12px',
  padding: '12px 16px',
  color: '#1d4ed8',
};

const periodCardStyle = {
  background: '#eef2ff',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '16px',
  boxShadow: '0 12px 32px rgba(79, 70, 229, 0.12)',
};

const periodHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
};

const periodBadgeStyle = {
  background: 'white',
  color: '#4338ca',
  padding: '6px 12px',
  borderRadius: '999px',
  fontWeight: 700,
  fontSize: '12px',
};

const periodStatsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '12px',
  background: 'white',
  borderRadius: '12px',
  padding: '12px',
};

const atosTableStyle = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0',
  borderRadius: '12px',
  overflow: 'hidden',
  fontSize: '12px',
  boxShadow: '0 6px 16px rgba(15, 23, 42, 0.1)',
};

const atoHeaderCellStyle = {
  padding: '10px 12px',
  textAlign: 'center',
  background: '#f1f5f9',
  fontWeight: 700,
  color: '#0f172a',
  borderBottom: '1px solid #e6e6e6'
};

const atoCellStyle = {
  padding: '10px 12px',
  textAlign: 'center',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'middle'
};

export default DapDetailsDrawer;
