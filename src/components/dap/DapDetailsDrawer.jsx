import React, { useEffect } from 'react';

function DapDetailsDrawer({ dap, onClose, loading }) {
  // keep hook order stable: always register useEffect (it will only attach listener when modal is open)
  useEffect(() => {
    if (!(dap || loading)) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && onClose) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dap, loading]);

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
            <InfoItem label="ID" value={dap.id ?? '—'} />
            <InfoItem label="Referência (M/A)" value={`${String(dap.mes_referencia ?? dap.mes ?? '').padStart(2, '0')}/${dap.ano_referencia ?? dap.ano ?? '—'}`} />
            <InfoItem label="Serventia" value={dap.serventia_nome ?? '—'} />
            <InfoItem label="Código Serventia" value={dap.codigo_serventia ?? '—'} />
            <InfoItem label="CNPJ" value={dap.cnpj ?? '—'} />
            <InfoItem label="Data de transmissão" value={dap.data_transmissao ? new Date(dap.data_transmissao).toLocaleString('pt-BR') : '—'} />
            <InfoItem label="Código do recibo" value={dap.codigo_recibo ?? '—'} />
            <InfoItem label="Retificadora" value={dap.retificadora ? 'Sim' : 'Não'} />
            <InfoItem label="Retificadora de" value={dap.retificadora_de_id ? `#${dap.retificadora_de_id}` : '—'} />
            <InfoItem label="Retificada por" value={dap.retificada_por_id ? `#${dap.retificada_por_id}` : '—'} />
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
                <span style={periodBadgeStyle}>Período {periodo.periodo_numero}</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>
                  Total de atos: {periodo.total_atos ?? '—'}
                </span>
              </header>
              <div style={periodStatsStyle}>
                <InfoItem label="Emolumentos" value={formatCurrency(periodo.total_emolumentos ?? periodo.emolumento_apurado)} />
                <InfoItem label="TED" value={formatCurrency(periodo.total_ted)} />
                <InfoItem label="ISS" value={formatCurrency(periodo.total_iss ?? periodo.issqn_recebido_usuarios)} />
                <InfoItem label="Total líquido" value={formatCurrency(periodo.total_liquido)} />
              </div>
              {renderAtos(periodo)}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function renderAtos(periodo) {
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
          {atos.map((ato) => {
            const tributacaoTexto = ato.tributacao
              || (ato.tributacao_codigo
                ? `${ato.tributacao_codigo}${ato.tributacao_descricao ? ' - ' + ato.tributacao_descricao : ''}`
                : '—');
              // DEBUG: inspecionar objeto `ato` no console para verificar campos
              console.log('[DEBUG][DAP ATOS]', ato);
              return (
                <tr key={ato.id ?? `${(ato.codigo || ato.codigo_ato || ato.ato_codigo || 'sem-codigo')}-${ato.descricao ?? ''}` } style={{ background: 'white' }}>
                  <td style={atoCellStyle}>{ato.codigo ?? ato.codigo_ato ?? ato.ato_codigo ?? '—'}</td>
                  <td style={atoCellStyle}>{ato.descricao ?? '—'}</td>
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
