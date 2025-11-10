import React from 'react';

function DapTable({ items = [], onSelect, onDelete, loading }) {
  // eslint-disable-next-line no-console
  console.debug('DapTable render', { count: items.length, sample: items[0], allItems: items });
  if (items[0]) {
    // eslint-disable-next-line no-console
    console.debug('Primeiro item detalhado:', {
      ano: items[0].ano,
      mes: items[0].mes,
      retificadora: items[0].retificadora,
      data_transmissao: items[0].data_transmissao,
      dataTransmissao: items[0].dataTransmissao,
      nome_serventia: items[0].nome_serventia,
      nomeServentia: items[0].nomeServentia,
      todasChaves: Object.keys(items[0])
    });
  }
  return (
    <div style={containerStyle}>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th>Ano</th>
              <th>Mês</th>
              <th>Retificadora</th>
              <th>Data Transmissão</th>
              <th>Serventia</th>
              <th>Ações</th>
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
                  <td>{dap.ano ?? '—'}</td>
                  <td>{dap.mes ?? '—'}</td>
                  <td>
                    <span style={badgeStyle(dap.retificadora)}>
                      {dap.retificadora ? 'SIM' : 'NÃO'}
                    </span>
                  </td>
                  <td>{dap.data_transmissao ? new Date(dap.data_transmissao).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{dap.nome_serventia ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
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
