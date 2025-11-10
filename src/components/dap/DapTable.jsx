import React from 'react';

function DapTable({ items = [], onSelect, onDelete, loading }) {
  return (
    <div style={containerStyle}>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Ano</th>
              <th style={thStyle}>Mês</th>
              <th style={thStyle}>Retificadora</th>
              <th style={thStyle}>Data Transmissão</th>
              <th style={thStyle}>Serventia</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={loadingCellStyle}>
                  Carregando declarações...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} style={emptyCellStyle}>
                  Nenhuma DAP cadastrada ainda. Utilize o botão "Nova DAP" para iniciar o histórico mensal.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((dap) => (
                <tr key={dap.id}
                  style={{ background: dap.retificadora ? '#fef3c7' : 'transparent' }}
                >
                  <td style={tdStyle}>{dap.anoReferencia ?? dap.ano ?? '—'}</td>
                  <td style={tdStyle}>{dap.mesReferencia ?? dap.mes ?? '—'}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(dap.retificadora)}>
                      {dap.retificadora ? 'SIM' : 'NÃO'}
                    </span>
                  </td>
                  <td style={tdStyle}>{dap.dataTransmissao ? new Date(dap.dataTransmissao).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={tdStyle}>{dap.serventiaNome ?? dap.nomeServentia ?? '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(dap)}
                      style={actionButtonStyle('#2563eb')}
                    >
                      Detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(dap)}
                      style={actionButtonStyle('#dc2626')}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const containerStyle = {
  background: 'white',
  borderRadius: '18px',
  padding: '24px',
  boxShadow: '0 20px 50px rgba(30, 64, 175, 0.12)',
};

const tableWrapperStyle = {
  overflowX: 'auto',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
};

const thStyle = {
  textAlign: 'center',
  padding: '12px',
  borderBottom: '2px solid #e2e8f0',
  fontWeight: 600,
  color: '#1e293b',
};

const tdStyle = {
  textAlign: 'center',
  padding: '12px',
  borderBottom: '1px solid #f1f5f9',
};

const loadingCellStyle = {
  padding: '24px',
  textAlign: 'center',
  fontWeight: 600,
  color: '#1e3a8a',
};

const emptyCellStyle = {
  padding: '24px',
  textAlign: 'center',
  color: '#475569',
};

const badgeStyle = (retificadora) => ({
  background: retificadora ? '#fef3c7' : '#dbeafe',
  color: retificadora ? '#b45309' : '#1d4ed8',
  padding: '6px 12px',
  borderRadius: '999px',
  fontWeight: 600,
  fontSize: '12px',
});

const actionButtonStyle = (color) => ({
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: '999px',
  padding: '8px 16px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  marginRight: '8px',
  boxShadow: `0 12px 24px ${color}33`,
});

actionButtonStyle.base = {
  marginRight: '8px',
};

export default DapTable;
